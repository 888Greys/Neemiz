import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/get-or-create-user";
import { TransactionStatus, TransactionType, type LeveragedKind } from "@prisma/client";
import { getServerTickHistory } from "@/lib/binary-price";
import { applyProfitRetention } from "@/lib/house-retention";
import { CURRENCY_SYMBOL } from "@/lib/currency";
import {
  isValidMultiplier, multiplierStopOutPrice, clampTurboBarrier, turboPayoutPerPoint,
  LEVERAGED_MAX_MULT, type LeveragedDirection,
} from "@/lib/leveraged";

const VALID_MARKETS = ["1HZ10V", "1HZ25V", "1HZ50V", "1HZ75V", "1HZ100V", "R_10", "R_25", "R_50", "R_75", "R_100", "JD10"];
const MIN_STAKE = 10;
const MAX_STAKE = 10_000;
const LOOKBACK_SEC = 120; // pull recent ticks to grab a fresh entry spot

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let body: {
    market?: string; kind?: string; direction?: string; stake?: number;
    multiplier?: number; barrierOffset?: number; takeProfit?: number | null; stopLoss?: number | null;
  };
  try { body = await req.json(); } catch { return Response.json({ error: "Invalid body" }, { status: 400 }); }

  const { market, kind, direction, stake, multiplier, barrierOffset } = body;

  if (!market || !VALID_MARKETS.includes(market))
    return Response.json({ error: "Invalid market" }, { status: 400 });
  if (kind !== "MULTIPLIER" && kind !== "TURBO")
    return Response.json({ error: "Invalid kind" }, { status: 400 });
  if (direction !== "UP" && direction !== "DOWN")
    return Response.json({ error: "Invalid direction" }, { status: 400 });
  if (!Number.isFinite(stake) || stake! < MIN_STAKE || stake! > MAX_STAKE)
    return Response.json({ error: `Stake must be between ${CURRENCY_SYMBOL} ${MIN_STAKE} and ${CURRENCY_SYMBOL} ${MAX_STAKE.toLocaleString()}` }, { status: 400 });
  if (kind === "MULTIPLIER" && (!Number.isInteger(multiplier) || !isValidMultiplier(multiplier!)))
    return Response.json({ error: "Invalid multiplier" }, { status: 400 });
  if (kind === "TURBO" && !Number.isFinite(barrierOffset))
    return Response.json({ error: "Invalid barrier" }, { status: 400 });

  const stakeVal = stake!;
  const dir = direction as LeveragedDirection;
  const maxGross = stakeVal * LEVERAGED_MAX_MULT;
  const maxPayout = applyProfitRetention(stakeVal, maxGross);

  // Optional take-profit / stop-loss (KSh). TP bounded by the gross cap; SL can't
  // exceed the stake (you can never lose more than you put in).
  const tp = body.takeProfit == null ? null : Number(body.takeProfit);
  const sl = body.stopLoss == null ? null : Number(body.stopLoss);
  if (tp != null && (!Number.isFinite(tp) || tp <= 0 || tp > maxGross - stakeVal))
    return Response.json({ error: "Invalid take profit" }, { status: 400 });
  if (sl != null && (!Number.isFinite(sl) || sl <= 0 || sl > stakeVal))
    return Response.json({ error: "Invalid stop loss" }, { status: 400 });

  // Entry spot from the live feed, server-side — the leverage/barrier a player
  // sees comes from this response, so it's exactly what the server settles on.
  let entrySpot: number, entryEpoch: number;
  try {
    const nowSec = Math.floor(Date.now() / 1000);
    const hist = await getServerTickHistory(market, nowSec - LOOKBACK_SEC, 300);
    if (hist.length === 0)
      return Response.json({ error: "Not enough market data, try again" }, { status: 503 });
    const entry = hist[hist.length - 1];
    entrySpot = entry.price;
    entryEpoch = entry.epoch;
  } catch (err) {
    console.error("leveraged/buy market data:", err instanceof Error ? err.message : err);
    return Response.json({ error: "Live feed unavailable, try again" }, { status: 503 });
  }

  let barrier: number | null = null;
  let payoutPerPoint: number | null = null;
  if (kind === "MULTIPLIER") {
    barrier = Number(multiplierStopOutPrice(entrySpot, multiplier!, dir).toFixed(5)); // stop-out price (display)
  } else {
    barrier = Number(clampTurboBarrier(entrySpot, entrySpot + barrierOffset!, dir).toFixed(5));
    payoutPerPoint = Number(turboPayoutPerPoint(stakeVal, entrySpot, barrier).toFixed(8));
  }

  const dbUser = await getOrCreateUser(user.id, { email: user.email });

  try {
    const trade = await db.$transaction(async (tx) => {
      const debited = await tx.user.updateMany({
        where: { id: dbUser.id, walletBalance: { gte: stakeVal } },
        data:  { walletBalance: { decrement: stakeVal } },
      });
      if (debited.count === 0) throw new Error("INSUFFICIENT_BALANCE");

      const created = await tx.leveragedTrade.create({
        data: {
          userId: dbUser.id,
          market,
          kind: kind as LeveragedKind,
          direction: dir,
          stake: stakeVal,
          multiplier: kind === "MULTIPLIER" ? multiplier! : null,
          barrier,
          payoutPerPoint,
          entrySpot,
          entryEpoch,
          takeProfit: tp,
          stopLoss: sl,
          maxPayout,
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
          reference: `leveraged-stake-${dbUser.id}-${created.id}`,
          provider: "leveraged",
          metadata: { game: "leveraged", tradeId: created.id, market, kind, direction: dir, multiplier: multiplier ?? null },
        },
      });

      return created;
    });

    return Response.json({
      tradeId: trade.id,
      market, kind, direction: dir,
      entrySpot, entryEpoch,
      multiplier: trade.multiplier,
      barrier,
      payoutPerPoint,
      maxPayout,
    }, { status: 201 });
  } catch (err) {
    if (err instanceof Error && err.message === "INSUFFICIENT_BALANCE")
      return Response.json({ error: "Insufficient balance" }, { status: 400 });
    console.error("leveraged/buy error:", err);
    return Response.json({ error: "Failed to place trade" }, { status: 500 });
  }
}
