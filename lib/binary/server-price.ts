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
  edgeFloor?: number;       // per-symbol edge (see measureSymbolEdge); overrides the default
  cfg?: PricingConfig;
}): DirectionalPrice {
  const { kind, side, entrySpot, barrier, durationTicks, stake, ticks } = params;
  const cfg: PricingConfig = params.cfg ?? (params.edgeFloor != null
    ? { ...DEFAULT_CONFIG, edgeFloor: params.edgeFloor }
    : DEFAULT_CONFIG);
  // The engine prices a RELATIVE barrier (fraction of entry); the trade's
  // absolute barrier is entrySpot·(1+frac), so frac = barrier/entrySpot − 1.
  const barrierFrac = kind === "RISE_FALL" || barrier == null ? null : barrier / entrySpot - 1;
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
}): DigitPrice {
  const { side, targetDigit, durationTicks, stake, ticks } = params;

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

  const q = priceDigitContract(side, targetDigit, durationTicks, ticks, cfg);
  if (!q.accepted) return { accepted: false, reason: q.reason };
  const payout = Number((stake * q.payoutMultiplier).toFixed(2));
  return { accepted: true, payout, multiplier: q.payoutMultiplier };
}
