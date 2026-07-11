import { createClient } from "@/lib/supabase/server";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { db } from "@/lib/db";
import { spendForPlay } from "@/lib/balance";
import { getOrCreateUser } from "@/lib/get-or-create-user";
import { TransactionStatus, TransactionType } from "@prisma/client";
import { applyProfitRetention } from "@/lib/house-retention";
import { computeSigma, SIGMA_WINDOW } from "@/lib/accumulator";
import { vanillaPayoutPerPoint, MAX_VANILLA_MULT, type DirectionalSide, type DirectionalKind } from "@/lib/directional";
import { isBetTypeDisabled, isBinaryContractServable, BINARY_MAINTENANCE_MESSAGE } from "@/lib/game-guard";
import { getCalibrationTicks } from "@/lib/binary/calibration";
import { getLiveEntrySpot } from "@/lib/binary-price";
import { buildProof, isProvablyFairConfigured, sha256 } from "@/lib/binary/provably-fair";
import { priceDirectionalServer, type FixedKind } from "@/lib/binary/server-price";
import { CURRENCY_SYMBOL } from "@/lib/currency";
import { registerDue } from "@/lib/settle-due-list";

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

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const rl = rateLimit(`directional-bet:${user.id}`, 30, 60_000);
  if (!rl.ok) return tooManyRequests(rl.retryAfterSec);

  let body: { market?: string; kind?: string; side?: string; stake?: number; durationTicks?: number; barrierOffset?: number; clientSeed?: string };
  try { body = await req.json(); } catch { return Response.json({ error: "Invalid body" }, { status: 400 }); }

  const { market, kind, side, stake, durationTicks, barrierOffset } = body;

  if (!market || !VALID_MARKETS.includes(market))
    return Response.json({ error: "Invalid market" }, { status: 400 });
  if (!kind || !VALID_KINDS.includes(kind))
    return Response.json({ error: "Invalid kind" }, { status: 400 });
  if (!(await isBinaryContractServable("directional", kind)))
    return Response.json({ error: BINARY_MAINTENANCE_MESSAGE }, { status: 503 });
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

  // Server-authoritative entry spot + a real tick window from the live feed.
  // The engine bootstraps this window to measure the win probability, so the
  // price it produces is proven house-safe (see lib/binary/pricing.ts).
  let entrySpot: number, entryEpoch: number, marketPrices: number[], symbolEdge = 0.09;
  try {
    // Pricing bootstraps from the cached recent window; the ENTRY spot must be a
    // FRESH live tick (never the cached one) to close the stale-entry timing edge.
    const [calib, entry] = await Promise.all([getCalibrationTicks(market), getLiveEntrySpot(market)]);
    marketPrices = calib.prices;
    symbolEdge = calib.edge;
    entrySpot = entry.spot;
    entryEpoch = entry.epoch;
  } catch (err) {
    console.error("directional/bet market data:", err instanceof Error ? err.message : err);
    return Response.json({ error: "Live feed unavailable, try again" }, { status: 503 });
  }
  if (marketPrices.length < SIGMA_WINDOW)
    return Response.json({ error: "Not enough market data, try again" }, { status: 503 });

  const barrier = kind === "RISE_FALL" ? null : Number((entrySpot + offset).toFixed(5));

  // A barrier must be a real positive price. A large negative offset would push
  // entrySpot+offset at or below zero; a non-positive barrier makes settlement
  // (exitSpot > barrier) trivially true — a guaranteed-win money printer.
  if (kind !== "RISE_FALL" && !(barrier! > 0))
    return Response.json({ error: "Invalid barrier" }, { status: 400 });

  let payoutVal = 0;            // fixed net payout (non-vanilla)
  let payoutPerPoint: number | null = null;
  let grossPayout = 0;
  let payoutMultiplier = 0;    // net multiple on a win (fixed kinds; for the fairness proof)
  if (kind === "VANILLA") {
    const sigmaTick = computeSigma(marketPrices.slice(-(SIGMA_WINDOW + 1)));
    payoutPerPoint = Number(vanillaPayoutPerPoint({ entrySpot, strike: barrier!, side: side as "CALL" | "PUT", sigmaTick, durationTicks: ticks, stake: stakeVal }).toFixed(8));
  } else {
    // Engine-priced. Rejects near-certain barriers and thin data (fail-closed),
    // so the deep-ITM "guaranteed win" class can't be sold.
    const priced = priceDirectionalServer({
      kind: kind as FixedKind, side: side as DirectionalSide, entrySpot, barrier,
      durationTicks: ticks, stake: stakeVal, ticks: marketPrices, market,
      edgeFloor: symbolEdge,
    });
    if (!priced.accepted)
      return Response.json({ error: `This contract isn't available right now (${priced.reason}). Try a barrier closer to the spot, or a different duration.` }, { status: 400 });
    payoutVal = priced.payout;
    grossPayout = priced.payout;
    payoutMultiplier = priced.multiplier;
  }
  const settleBefore = new Date(Date.now() + ticks * 3000 + 120_000); // generous: ticks may run up to ~3s apart

  const dbUser = await getOrCreateUser(user.id, { email: user.email });

  // Provably-fair proof: commit + sign the exact terms (incl. entryEpoch) so the
  // outcome — a replay of public Deriv ticks through the open-source kernel — can
  // be independently verified and can't be backdated or altered. Fixed kinds only.
  const clientSeed = typeof body.clientSeed === "string" && body.clientSeed ? body.clientSeed.slice(0, 128) : sha256(dbUser.id);
  const proof = (kind !== "VANILLA" && isProvablyFairConfigured())
    ? buildProof({ market, kind: kind as DirectionalKind, side: side as DirectionalSide, entrySpot, entryEpoch, barrier, durationTicks: ticks, payoutMultiplier, clientSeed, nonce: Date.now() })
    : null;

  try {
    const trade = await db.$transaction(async (tx) => {
      // Bonus-first stake (falls back to real balance; identical to prior
      // behaviour for users with no bonus).
      await spendForPlay(tx, dbUser.id, stakeVal);

      const created = await tx.directionalTrade.create({
        data: {
          userId: dbUser.id, market, kind: kind as DirectionalKind, side,
          stake: stakeVal, payout: payoutVal, payoutPerPoint,
          entrySpot, entryEpoch, barrier, durationTicks: ticks, settleBefore,
          pfServerSeed: proof?.serverSeed,
          pfCommitment: proof?.commitment,
          pfSignature: proof?.signature,
          pfClientSeed: proof ? clientSeed : undefined,
          pfNonce: proof ? String(proof.terms.nonce) : undefined,
          pfPayoutMultiplier: proof ? payoutMultiplier : undefined,
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
          metadata: {
            game: "directional", tradeId: created.id, market, kind, side, barrier, payoutPerPoint, durationTicks: ticks, grossPayout,
            ...(proof ? { pf: { commitment: proof.commitment, signature: proof.signature, clientSeed, nonce: proof.terms.nonce, payoutMultiplier } } : {}),
          },
        },
      });
      return created;
    });

    registerDue({
      kind: "directional",
      tradeId: trade.id,
      userId: trade.userId,
      market: trade.market,
      entryEpoch: trade.entryEpoch,
      durationTicks: trade.durationTicks,
      dueEpoch: trade.entryEpoch + 1,
      settleBeforeMs: trade.settleBefore.getTime(),
    });

    return Response.json({
      tradeId: trade.id, kind, side, entrySpot, entryEpoch, barrier, payoutPerPoint,
      durationTicks: ticks, payout: payoutVal,
      maxPayout: kind === "VANILLA" ? Number(applyProfitRetention(stakeVal, stakeVal * MAX_VANILLA_MULT).toFixed(2)) : undefined,
      ...(proof ? { provablyFair: { commitment: proof.commitment, signature: proof.signature, clientSeed, nonce: proof.terms.nonce } } : {}),
    }, { status: 201 });
  } catch (err) {
    if (err instanceof Error && err.message === "INSUFFICIENT_BALANCE")
      return Response.json({ error: "Insufficient balance" }, { status: 400 });
    console.error("directional/bet error:", err);
    return Response.json({ error: "Failed to place trade" }, { status: 500 });
  }
}
