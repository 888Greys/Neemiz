import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/get-or-create-user";
import { TransactionStatus, TransactionType } from "@prisma/client";
import { getServerTickHistory } from "@/lib/binary-price";
import {
  SIGMA_WINDOW, computeSigma, barrierFracFor, maxTicksFor, isValidGrowthRate, payoutAtTick,
} from "@/lib/accumulator";

const VALID_MARKETS = ["R_10", "R_25", "R_50", "R_75", "R_100", "JD10"];
const MIN_STAKE = 10;
const MAX_STAKE = 10_000;
const LOOKBACK_SEC = 600; // pull ~600 recent ticks to measure volatility

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let body: { market?: string; stake?: number; growthRate?: number; takeProfit?: number | null };
  try { body = await req.json(); } catch { return Response.json({ error: "Invalid body" }, { status: 400 }); }

  const { market, stake, growthRate, takeProfit } = body;

  if (!market || !VALID_MARKETS.includes(market))
    return Response.json({ error: "Invalid market" }, { status: 400 });
  if (!Number.isFinite(stake) || stake! < MIN_STAKE || stake! > MAX_STAKE)
    return Response.json({ error: `Stake must be between KSh ${MIN_STAKE} and KSh ${MAX_STAKE.toLocaleString()}` }, { status: 400 });
  if (!Number.isInteger(growthRate) || !isValidGrowthRate(growthRate!))
    return Response.json({ error: "Invalid growth rate" }, { status: 400 });
  const tp = takeProfit == null ? null : Number(takeProfit);
  if (tp != null && (!Number.isFinite(tp) || tp <= 0))
    return Response.json({ error: "Invalid take profit" }, { status: 400 });

  const stakeVal  = stake!;
  const rate      = growthRate!;
  const maxTicks  = maxTicksFor(rate);

  // Measure volatility from the live feed and derive the (fair) barrier + entry,
  // server-side. The barrier the client draws comes from this response, so the
  // band a player sees is exactly the one the server settles against.
  let entrySpot: number, entryEpoch: number, barrierFrac: number;
  try {
    const nowSec = Math.floor(Date.now() / 1000);
    const hist = await getServerTickHistory(market, nowSec - LOOKBACK_SEC, 1000);
    if (hist.length < SIGMA_WINDOW)
      return Response.json({ error: "Not enough market data, try again" }, { status: 503 });
    const window = hist.slice(-(SIGMA_WINDOW + 1));
    const sigma = computeSigma(window.map((h) => h.price));
    barrierFrac = barrierFracFor(sigma, rate);
    const entry = hist[hist.length - 1];
    entrySpot = entry.price;
    entryEpoch = entry.epoch;
  } catch (err) {
    console.error("accumulator/buy market data:", err instanceof Error ? err.message : err);
    return Response.json({ error: "Live feed unavailable, try again" }, { status: 503 });
  }

  const dbUser = await getOrCreateUser(user.id, { email: user.email });

  try {
    const trade = await db.$transaction(async (tx) => {
      const debited = await tx.user.updateMany({
        where: { id: dbUser.id, walletBalance: { gte: stakeVal } },
        data:  { walletBalance: { decrement: stakeVal } },
      });
      if (debited.count === 0) throw new Error("INSUFFICIENT_BALANCE");

      const created = await tx.accumulatorTrade.create({
        data: {
          userId: dbUser.id,
          market,
          stake: stakeVal,
          growthRate: rate,
          entrySpot,
          entryEpoch,
          barrierFrac,
          maxTicks,
          takeProfit: tp,
          status: "OPEN",
        },
      });

      await tx.transaction.create({
        data: {
          userId: dbUser.id,
          type: TransactionType.BET_STAKE,
          amount: stakeVal,
          currency: "KES",
          status: TransactionStatus.COMPLETED,
          reference: `accumulator-stake-${dbUser.id}-${created.id}`,
          provider: "accumulator",
          metadata: { game: "accumulator", tradeId: created.id, market, growthRate: rate, takeProfit: tp },
        },
      });

      return created;
    });

    return Response.json({
      tradeId: trade.id,
      market,
      growthRate: rate,
      entrySpot,
      entryEpoch,
      barrierFrac,
      maxTicks,
      maxPayout: Number(payoutAtTick(stakeVal, rate, maxTicks).toFixed(2)),
    }, { status: 201 });
  } catch (err) {
    if (err instanceof Error && err.message === "INSUFFICIENT_BALANCE")
      return Response.json({ error: "Insufficient balance" }, { status: 400 });
    console.error("accumulator/buy error:", err);
    return Response.json({ error: "Failed to place trade" }, { status: 500 });
  }
}
