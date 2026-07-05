import { createClient } from "@/lib/supabase/server";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/get-or-create-user";
import { TransactionStatus, TransactionType } from "@prisma/client";
import { applyProfitRetention } from "@/lib/house-retention";
import { getServerTickHistory } from "@/lib/binary-price";
import { computeSigma, SIGMA_WINDOW } from "@/lib/accumulator";
import { payoutRate, vanillaPayoutPerPoint, contractWinProb, MAX_VANILLA_MULT, MAX_WIN_PROB, type DirectionalSide, type DirectionalKind } from "@/lib/directional";
import { isBetTypeDisabled } from "@/lib/game-guard";
import { CURRENCY_SYMBOL } from "@/lib/currency";

const VALID_MARKETS = ["1HZ10V", "1HZ25V", "1HZ50V", "1HZ75V", "1HZ100V", "R_10", "R_25", "R_50", "R_75", "R_100", "JD10"];
const VALID_KINDS = ["RISE_FALL", "HIGHER_LOWER", "TOUCH_NO_TOUCH", "VANILLA"];
const SIDES_BY_KIND: Record<string, DirectionalSide[]> = {
  RISE_FALL: ["RISE", "FALL"],
  HIGHER_LOWER: ["HIGHER", "LOWER"],
  TOUCH_NO_TOUCH: ["TOUCH", "NO_TOUCH"],
  VANILLA: ["CALL", "PUT"],
};
// Kinds that take a barrier/strike offset; offset must be non-zero except VANILLA
// (an at-the-money strike is valid).
const NEEDS_OFFSET = new Set(["HIGHER_LOWER", "TOUCH_NO_TOUCH", "VANILLA"]);
const MIN_STAKE = 10;
const MAX_STAKE = 10_000;
const LOOKBACK_SEC = 600;

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const rl = rateLimit(`directional-bet:${user.id}`, 30, 60_000);
  if (!rl.ok) return tooManyRequests(rl.retryAfterSec);

  let body: { market?: string; kind?: string; side?: string; stake?: number; durationTicks?: number; barrierOffset?: number };
  try { body = await req.json(); } catch { return Response.json({ error: "Invalid body" }, { status: 400 }); }

  const { market, kind, side, stake, durationTicks, barrierOffset } = body;

  if (!market || !VALID_MARKETS.includes(market))
    return Response.json({ error: "Invalid market" }, { status: 400 });
  if (!kind || !VALID_KINDS.includes(kind))
    return Response.json({ error: "Invalid kind" }, { status: 400 });
  if (await isBetTypeDisabled("directional", kind))
    return Response.json({ error: "This contract type is temporarily unavailable while we complete maintenance." }, { status: 503 });
  if (!side || !SIDES_BY_KIND[kind].includes(side as DirectionalSide))
    return Response.json({ error: "Invalid side" }, { status: 400 });
  if (!Number.isFinite(stake) || stake! < MIN_STAKE || stake! > MAX_STAKE)
    return Response.json({ error: `Stake must be between ${CURRENCY_SYMBOL} ${MIN_STAKE} and ${CURRENCY_SYMBOL} ${MAX_STAKE.toLocaleString()}` }, { status: 400 });
  if (!Number.isInteger(durationTicks) || durationTicks! < 1 || durationTicks! > 30)
    return Response.json({ error: "Duration must be 1–30 ticks" }, { status: 400 });
  const offset = barrierOffset == null ? 0 : Number(barrierOffset);
  if (NEEDS_OFFSET.has(kind) && !Number.isFinite(offset))
    return Response.json({ error: "Invalid barrier" }, { status: 400 });
  if ((kind === "HIGHER_LOWER" || kind === "TOUCH_NO_TOUCH") && offset === 0)
    return Response.json({ error: "Choose a barrier above or below the spot" }, { status: 400 });

  const stakeVal = stake!;
  const ticks    = durationTicks!;

  // Server-authoritative entry spot + volatility from the live feed.
  let entrySpot: number, entryEpoch: number, sigmaTick: number;
  try {
    const nowSec = Math.floor(Date.now() / 1000);
    const hist = await getServerTickHistory(market, nowSec - LOOKBACK_SEC, 1000);
    if (hist.length < SIGMA_WINDOW)
      return Response.json({ error: "Not enough market data, try again" }, { status: 503 });
    sigmaTick = computeSigma(hist.slice(-(SIGMA_WINDOW + 1)).map((h) => h.price));
    const entry = hist[hist.length - 1];
    entrySpot = entry.price;
    entryEpoch = entry.epoch;
  } catch (err) {
    console.error("directional/bet market data:", err instanceof Error ? err.message : err);
    return Response.json({ error: "Live feed unavailable, try again" }, { status: 503 });
  }

  const barrier = kind === "RISE_FALL" ? null : Number((entrySpot + offset).toFixed(5));

  // A barrier must be a real positive price. A large negative offset would push
  // entrySpot+offset at or below zero; a non-positive barrier bypasses the
  // win-prob guard below AND makes settlement (exitSpot > barrier) trivially true
  // — a guaranteed-win money printer. Reject it outright before pricing.
  if (kind !== "RISE_FALL" && !(barrier! > 0))
    return Response.json({ error: "Invalid barrier" }, { status: 400 });

  // Reject contracts the player has made near-certain. A deep in-the-money
  // barrier (e.g. LOWER far above spot, or NO_TOUCH far away) wins ~100% of the
  // time; paying it out at a rate ≥ its true probability is a risk-free +EV
  // money printer. VANILLA is priced continuously and is exempt.
  if (kind === "HIGHER_LOWER" || kind === "TOUCH_NO_TOUCH") {
    const winProb = contractWinProb({ kind, side: side as DirectionalSide, entrySpot, barrier, sigmaTick, durationTicks: ticks });
    if (winProb > MAX_WIN_PROB)
      return Response.json({ error: "Barrier too safe — choose a barrier closer to the current spot" }, { status: 400 });
  }

  let payoutVal = 0;            // fixed net payout (non-vanilla)
  let payoutPerPoint: number | null = null;
  let grossPayout = 0;
  if (kind === "VANILLA") {
    payoutPerPoint = Number(vanillaPayoutPerPoint({ entrySpot, strike: barrier!, side: side as "CALL" | "PUT", sigmaTick, durationTicks: ticks, stake: stakeVal }).toFixed(8));
  } else {
    const rate = payoutRate({ kind: kind as "RISE_FALL" | "HIGHER_LOWER" | "TOUCH_NO_TOUCH", side: side as DirectionalSide, entrySpot, barrier: barrier ?? undefined, sigmaTick, durationTicks: ticks });
    grossPayout = Number((stakeVal * rate).toFixed(2));
    payoutVal = applyProfitRetention(stakeVal, grossPayout);
  }
  const settleBefore = new Date(Date.now() + ticks * 3000 + 120_000); // generous: ticks may run up to ~3s apart

  const dbUser = await getOrCreateUser(user.id, { email: user.email });

  try {
    const trade = await db.$transaction(async (tx) => {
      const debited = await tx.user.updateMany({
        where: { id: dbUser.id, walletBalance: { gte: stakeVal } },
        data:  { walletBalance: { decrement: stakeVal } },
      });
      if (debited.count === 0) throw new Error("INSUFFICIENT_BALANCE");

      const created = await tx.directionalTrade.create({
        data: {
          userId: dbUser.id, market, kind: kind as DirectionalKind, side,
          stake: stakeVal, payout: payoutVal, payoutPerPoint,
          entrySpot, entryEpoch, barrier, durationTicks: ticks, settleBefore,
          status: "PENDING",
        },
      });
      await tx.transaction.create({
        data: {
          userId: dbUser.id,
          type: TransactionType.BET_STAKE,
          amount: stakeVal,
          currency: "KES",
          status: TransactionStatus.COMPLETED,
          reference: `directional-stake-${dbUser.id}-${created.id}`,
          provider: "directional",
          metadata: { game: "directional", tradeId: created.id, market, kind, side, barrier, payoutPerPoint, durationTicks: ticks, grossPayout },
        },
      });
      return created;
    });

    return Response.json({
      tradeId: trade.id, kind, side, entrySpot, entryEpoch, barrier, payoutPerPoint,
      durationTicks: ticks, payout: payoutVal,
      maxPayout: kind === "VANILLA" ? Number(applyProfitRetention(stakeVal, stakeVal * MAX_VANILLA_MULT).toFixed(2)) : undefined,
    }, { status: 201 });
  } catch (err) {
    if (err instanceof Error && err.message === "INSUFFICIENT_BALANCE")
      return Response.json({ error: "Insufficient balance" }, { status: 400 });
    console.error("directional/bet error:", err);
    return Response.json({ error: "Failed to place trade" }, { status: 500 });
  }
}
