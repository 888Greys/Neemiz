// ─────────────────────────────────────────────────────────────────────────────
// SERVER PRICING — the request-path entry to the engine.
//
// Converts a directional bet request + a real tick window into the stored net
// payout, using the exploit-proof engine (lib/binary/pricing.ts). Pure: ticks
// are injected, so it is unit-tested without a feed. VANILLA is continuous and
// priced elsewhere; this covers the fixed-payout kinds.
// ─────────────────────────────────────────────────────────────────────────────

import { priceDirectionalContract, DEFAULT_CONFIG, type PricingConfig } from "@/lib/binary/pricing";
import type { DirectionalSide } from "@/lib/binary/kernel";

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
