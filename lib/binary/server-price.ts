// ─────────────────────────────────────────────────────────────────────────────
// SERVER PRICING — the request-path entry to the engine.
//
// Converts a directional bet request + a real tick window into the stored net
// payout, using the exploit-proof engine (lib/binary/pricing.ts). Pure: ticks
// are injected, so it is unit-tested without a feed. VANILLA is continuous and
// priced elsewhere; this covers the fixed-payout kinds.
// ─────────────────────────────────────────────────────────────────────────────

import { priceDirectionalContract, priceDigitContract, DEFAULT_CONFIG, type PricingConfig } from "@/lib/binary/pricing";
import { exitDigitFromQuote, type DirectionalSide, type DigitSide } from "@/lib/binary/kernel";

export type FixedKind = "RISE_FALL" | "HIGHER_LOWER" | "TOUCH_NO_TOUCH";

export type DirectionalPrice =
  | { accepted: false; reason: string }
  | { accepted: true; payout: number; multiplier: number };

/** Minimum |barrier − spot| / spot for HIGHER_LOWER / TOUCH. Closer than this
 *  was the live bleed (engine HIGHER <0.05% → RTP ~2.4 on small samples). */
export const MIN_BARRIER_FRAC = 0.0005; // 0.05%

/** Extra edge floor for short-duration Rise/Fall on 1Hz synthetics. */
export const SHORT_1HZ_RISE_FALL_EDGE = 0.15;

/**
 * Minimum duration (ticks) for digit Over/Under. Very short Over/Under bets are
 * priced from window-sampled win frequency (unconditional) but PLAYED at a
 * chosen instant, so they exploit tick-to-tick digit autocorrelation the price
 * can't see. Live R_50 evidence: 1-tick RTP ~1.54, 3-tick ~1.31, decaying with
 * duration (both sides won ~79% at 1 tick). Requiring more ticks lets the
 * microstructure edge wash out. Mirrors the 1-tick Rise/Fall guard above.
 */
export const MIN_OVER_UNDER_TICKS = 5;

export function isOneHzMarket(market?: string | null): boolean {
  return !!market && market.startsWith("1HZ");
}

/**
 * Price a fixed-payout directional contract off a real tick window. Returns the
 * total net payout on a win (stake × multiplier). The engine multiplier already
 * carries the full house edge (fairness-proven RTP ≤ 1), so no extra retention
 * is applied. A rejection (near-certain, thin data, priced ≤ 1×) is surfaced,
 * never silently coerced into a price.
 */
export function priceDirectionalServer(params: {
  kind: FixedKind;
  side: DirectionalSide;
  entrySpot: number;
  barrier: number | null;   // absolute barrier price (null for RISE_FALL)
  durationTicks: number;
  stake: number;
  ticks: number[];
  market?: string;          // Deriv symbol — used for 1Hz short-duration gates
  edgeFloor?: number;       // per-symbol edge (see measureSymbolEdge); overrides the default
  cfg?: PricingConfig;
}): DirectionalPrice {
  const { kind, side, entrySpot, barrier, durationTicks, stake, ticks, market } = params;

  // 1-tick Rise/Fall on 1Hz was the live engine leak (1HZ10V RISE@1t → RTP ~134%).
  // Microstructure at a single tick isn't covered by the 8-tick edge calibration.
  if (kind === "RISE_FALL" && durationTicks < 2 && isOneHzMarket(market)) {
    return { accepted: false, reason: "1-tick Rise/Fall is unavailable on 1Hz markets — pick 2+ ticks" };
  }

  // The engine prices a RELATIVE barrier (fraction of entry); the trade's
  // absolute barrier is entrySpot·(1+frac), so frac = barrier/entrySpot − 1.
  const barrierFrac = kind === "RISE_FALL" || barrier == null || !(entrySpot > 0)
    ? null
    : barrier / entrySpot - 1;

  if ((kind === "HIGHER_LOWER" || kind === "TOUCH_NO_TOUCH") && barrierFrac != null
      && Math.abs(barrierFrac) + 1e-10 < MIN_BARRIER_FRAC) {
    return { accepted: false, reason: "barrier too close to spot — pick at least 0.05% away" };
  }

  let edgeFloor = params.edgeFloor ?? DEFAULT_CONFIG.edgeFloor;
  if (kind === "RISE_FALL" && isOneHzMarket(market) && durationTicks <= 3) {
    edgeFloor = Math.max(edgeFloor, SHORT_1HZ_RISE_FALL_EDGE);
  }

  const cfg: PricingConfig = params.cfg ?? { ...DEFAULT_CONFIG, edgeFloor };
  const q = priceDirectionalContract(kind, side, barrierFrac, durationTicks, ticks, cfg);
  if (!q.accepted) return { accepted: false, reason: q.reason };
  const payout = Number((stake * q.payoutMultiplier).toFixed(2));
  return { accepted: true, payout, multiplier: q.payoutMultiplier };
}

export type DigitPrice =
  | { accepted: false; reason: string }
  | { accepted: true; payout: number; multiplier: number };

export function resolveDigitEdgeFloor(side: DigitSide, targetDigit: number, edgeFloor?: number): number {
  let productFloor = 0.10;
  if (side === "Matches") {
    productFloor = 0.15;
  } else if (side === "Differs") {
    productFloor = 0.025; // 2.5% edge floor for Differs (90% win prob)
  } else if (side === "Over" && targetDigit === 0) {
    productFloor = 0.03;  // 3% edge floor for Over 0 (90% win prob)
  } else if (side === "Under" && targetDigit === 9) {
    productFloor = 0.03;  // 3% edge floor for Under 9 (90% win prob)
  } else if (side === "Under" && targetDigit >= 4 && targetDigit <= 6) {
    // Mid Under (esp. R_50 Under 4/5) ran RTP 1.30–1.33 live — widen the floor.
    productFloor = 0.18;
  }
  if (side === "Differs" || (side === "Over" && targetDigit === 0) || (side === "Under" && targetDigit === 9)) {
    return productFloor;
  }
  return Math.max(edgeFloor ?? productFloor, productFloor);
}

export function previewDigitPayout(stake: number, side: DigitSide, targetDigit: number): number {
  let winProb = 0.5;
  if (side === "Matches") winProb = 0.1;
  else if (side === "Differs") winProb = 0.9;
  else if (side === "Over") winProb = Math.max(0, 9 - targetDigit) / 10;
  else if (side === "Under") winProb = Math.max(0, targetDigit) / 10;

  if (!(winProb > 0)) return 0;
  const edgeFloor = resolveDigitEdgeFloor(side, targetDigit);
  const multiplier = Math.floor(((1 - edgeFloor) / winProb) * 100) / 100;
  return Number((stake * multiplier).toFixed(2));
}

/**
 * Price a digit contract off a real tick window. Returns the total net payout on a win.
 * Incorporates a stability gate for Matches and tailored edge floors.
 */
export function priceDigitServer(params: {
  side: DigitSide;
  targetDigit: number;
  durationTicks: number;
  stake: number;
  ticks: number[];
  edgeFloor?: number;
  cfg?: PricingConfig;
  /** Live entry digit. When supplied, Over/Under are priced CONDITIONALLY on it
   *  (removes the sticky-digit autocorrelation edge). */
  entryDigit?: number;
}): DigitPrice {
  const { side, targetDigit, durationTicks, stake, ticks, entryDigit } = params;

  // 0. Microstructure gate: reject too-short Over/Under (autocorrelation exploit).
  if ((side === "Over" || side === "Under") && durationTicks < MIN_OVER_UNDER_TICKS) {
    return { accepted: false, reason: `Over/Under needs at least ${MIN_OVER_UNDER_TICKS} ticks` };
  }

  // 1. Stability Gate (Matches only): check if the target digit distribution
  // in the calibration ticks is skewed (expected ~10%, reject if <7% or >13%)
  if (side === "Matches") {
    let targetCount = 0;
    for (const tick of ticks) {
      if (exitDigitFromQuote(tick) === targetDigit) {
        targetCount++;
      }
    }
    const freq = targetCount / ticks.length;
    if (freq < 0.07 || freq > 0.13) {
      return { accepted: false, reason: `digit distribution unstable (freq ${(freq * 100).toFixed(1)}%)` };
    }
  }

  // Baseline is 10% for Digits, but 15% for Matches to absorb tail-risk drift,
  // and 2.5% - 3.0% for high-probability contracts (Differs, Under 9, Over 0).
  const resolvedEdgeFloor = resolveDigitEdgeFloor(side, targetDigit, params.edgeFloor);

  // Raise the max win probability cap for high-probability contracts (90% base)
  let resolvedMaxWinProb = DEFAULT_CONFIG.maxWinProb;
  if (side === "Differs" || (side === "Over" && targetDigit === 0) || (side === "Under" && targetDigit === 9)) {
    resolvedMaxWinProb = 0.98;
  }

  const cfg: PricingConfig = params.cfg ?? {
    ...DEFAULT_CONFIG,
    edgeFloor: resolvedEdgeFloor,
    maxWinProb: resolvedMaxWinProb,
  };

  // Over/Under are priced conditionally on the live entry digit when we have it
  // (the sticky-digit exploit fix). Other digit families (Even/Odd/Matches/
  // Differs) are not entry-digit autocorrelated in an exploitable way, so they
  // keep the unconditional price.
  const condEntry = (side === "Over" || side === "Under") ? entryDigit : undefined;
  const q = priceDigitContract(side, targetDigit, durationTicks, ticks, cfg, 1, condEntry);
  if (!q.accepted) return { accepted: false, reason: q.reason };
  const payout = Number((stake * q.payoutMultiplier).toFixed(2));
  return { accepted: true, payout, multiplier: q.payoutMultiplier };
}
