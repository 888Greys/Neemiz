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

  // 2. Select appropriate edgeFloor
  // Baseline is 10% for Digits, but 15% for Matches to absorb tail-risk drift
  let resolvedEdgeFloor = params.edgeFloor;
  if (resolvedEdgeFloor == null) {
    resolvedEdgeFloor = side === "Matches" ? 0.15 : 0.10;
  }

  const cfg: PricingConfig = params.cfg ?? { ...DEFAULT_CONFIG, edgeFloor: resolvedEdgeFloor };

  const q = priceDigitContract(side, targetDigit, durationTicks, ticks, cfg);
  if (!q.accepted) return { accepted: false, reason: q.reason };
  const payout = Number((stake * q.payoutMultiplier).toFixed(2));
  return { accepted: true, payout, multiplier: q.payoutMultiplier };
}
