// ─────────────────────────────────────────────────────────────────────────────
// SERVER PRICING — the request-path entry to the engine.
//
// Converts a directional bet request + a real tick window into the stored net
// payout, using the exploit-proof engine (lib/binary/pricing.ts). Pure: ticks
// are injected, so it is unit-tested without a feed. VANILLA is continuous and
// priced elsewhere; this covers the fixed-payout kinds.
// ─────────────────────────────────────────────────────────────────────────────

import { priceDirectionalContract, priceDigitContract, DEFAULT_CONFIG, type PricingConfig } from "@/lib/binary/pricing";
import { exitDigitFromQuote, type DirectionalKind, type DirectionalSide, type DigitSide } from "@/lib/binary/kernel";
import { isUnderQuarantined } from "@/lib/binary/quarantine";

export type FixedKind = "RISE_FALL" | "HIGHER_LOWER" | "TOUCH_NO_TOUCH";

export type DirectionalPrice =
  | { accepted: false; reason: string }
  | { accepted: true; payout: number; multiplier: number };

/** Minimum |barrier − spot| / spot for HIGHER_LOWER / TOUCH. Closer than this
 *  was the live bleed (engine HIGHER <0.05% → RTP ~2.4 on small samples).
 *  Raised to 0.1% after autopsy: nearly all HL volume sat under 0.05%. */
export const MIN_BARRIER_FRAC = 0.001; // 0.1%

/**
 * UI barrier-offset floor (points) matching {@link MIN_BARRIER_FRAC}.
 * Ceiled to 2dp so a rounded picker value never lands under the server gate.
 */
export function minBarrierOffsetPts(spot: number): number {
  if (!(spot > 0)) return 0.01;
  return Math.max(0.01, Math.ceil(spot * MIN_BARRIER_FRAC * 100 - 1e-9) / 100);
}

/** Extra edge floor for short-duration Rise/Fall on 1Hz synthetics. */
export const SHORT_1HZ_RISE_FALL_EDGE = 0.15;

/** Extra edge floor for Higher/Lower (barrier contracts drift harder than RF). */
export const HIGHER_LOWER_EDGE_FLOOR = 0.14;

/** Deep-ITM Wilson cap for Higher/Lower — tighter than the engine default 90%. */
export const HIGHER_LOWER_MAX_WIN_PROB = 0.80;

/**
 * Minimum duration (ticks) for digit Over/Under. Very short Over/Under bets are
 * priced from window-sampled win frequency (unconditional) but PLAYED at a
 * chosen instant, so they exploit tick-to-tick digit autocorrelation the price
 * can't see. Live R_50 evidence: 1-tick RTP ~1.54, 3-tick ~1.31, decaying with
 * duration (both sides won ~79% at 1 tick). Requiring more ticks lets the
 * microstructure edge wash out. Mirrors the 1-tick Rise/Fall guard above.
 */
export const MIN_OVER_UNDER_TICKS = 5;

/**
 * Matches target-digit frequency band. Outside → refuse (biased digit).
 * Kept at [8%, 12%] after the R_50 sticky-Matches autopsy (live RTP ~2.5–3.4).
 * Do not widen without house-safe proof: conditional pricing + 20% edge floor
 * alone do not justify quoting clearly biased digits (e.g. ~17% on Vol 10).
 */
export const MATCHES_FREQ_LO = 0.08;
export const MATCHES_FREQ_HI = 0.12;

/**
 * Soft digit refusals no longer preach on the Buy button. The UI auto-hops
 * Matches off busy digits and dims them in the grid; Buy just stays quiet.
 * Kept as a short sentinel so disabled state stays truthy without a sermon.
 */
export const MATCHES_UNAVAILABLE_COPY = "—";

/** Quiet Over/Under soft-refusal sentinel (same idea as Matches). */
export const OVER_UNDER_UNAVAILABLE_COPY = "—";

/** True for soft availability refusals — never surface as a scary "Trade failed". */
export function isCalmDigitAvailabilityReject(reason: string): boolean {
  return (
    /digit distribution/i.test(reason) ||
    /insufficient conditional/i.test(reason) ||
    /isn't available right now/i.test(reason) ||
    /temporarily unavailable/i.test(reason)
  );
}

function isOverUnderSide(side?: DigitSide): boolean {
  return side === "Over" || side === "Under";
}

/** Family-aware calm copy for digit quote / bet soft refusals. */
export function digitUnavailableCopy(side?: DigitSide): string {
  return isOverUnderSide(side) ? OVER_UNDER_UNAVAILABLE_COPY : MATCHES_UNAVAILABLE_COPY;
}

/** Compact UI copy for priceDigitServer / quote rejection reasons. */
export function shortDigitRejectReason(reason: string, side?: DigitSide): string {
  const overUnder = isOverUnderSide(side);
  // Soft availability → quiet sentinel; UI hops / dims instead of lecturing.
  if (isCalmDigitAvailabilityReject(reason)) return digitUnavailableCopy(side);
  if (/insufficient market/i.test(reason)) return "Not enough data";
  if (/entry digit required/i.test(reason)) return "Pricing…";
  if (/needs at least/i.test(reason)) {
    return overUnder ? `Min ${MIN_OVER_UNDER_TICKS} ticks` : "Duration too short";
  }
  if (/priced ≤ 1×/i.test(reason)) return "Payout too low";
  if (/win (probability|chance)/i.test(reason)) {
    if (overUnder || side === "Matches") return digitUnavailableCopy(side);
    return "—";
  }
  if (/cannot win/i.test(reason)) return "Cannot win";
  return reason.length > 28 ? `${reason.slice(0, 27)}…` : reason;
}

/** Calm client copy when HL / Touch barrier is inside the server min distance. */
export const BARRIER_TOO_CLOSE_COPY = "Move barrier farther from spot";

/** Calm client copy when HL / Touch cannot be priced (win-prob / thin / near-certain). */
export const BARRIER_NOT_PRICEABLE_COPY =
  "Can't price this barrier right now — move it farther or change duration";

/** Soft directional refusals — never surface as a scary "Trade failed". */
export function isCalmDirectionalReject(reason: string): boolean {
  return /barrier too close/i.test(reason);
}

/** Compact UI copy for priceDirectionalServer / quote rejection reasons. */
export function shortDirectionalRejectReason(reason: string, kind?: DirectionalKind): string {
  if (isCalmDirectionalReject(reason)) return BARRIER_TOO_CLOSE_COPY;
  if (/insufficient market/i.test(reason)) return "Not enough data";
  if (/temporarily unavailable/i.test(reason)) return "Unavailable";
  if (/1-tick Rise\/Fall/i.test(reason)) return "Duration too short";
  if (/priced ≤ 1×/i.test(reason)) return "Payout too low";
  if (/win (probability|chance)|near.?certain/i.test(reason)) {
    return kind === "HIGHER_LOWER" || kind === "TOUCH_NO_TOUCH"
      ? BARRIER_NOT_PRICEABLE_COPY
      : "Unavailable";
  }
  if (/cannot win/i.test(reason)) return "Cannot win";
  if (/isn't available right now/i.test(reason)) return "Unavailable";
  return reason.length > 28 ? `${reason.slice(0, 27)}…` : reason;
}

// Under-quarantine list lives in a tiny shared module so the UI and this server
// gate share ONE source of truth (see lib/binary/quarantine.ts). Re-exported for
// back-compat with existing importers.
export { UNDER_QUARANTINED_MARKETS, isUnderQuarantined } from "@/lib/binary/quarantine";

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
    return { accepted: false, reason: "barrier too close to spot — pick at least 0.1% away" };
  }

  let edgeFloor = params.edgeFloor ?? DEFAULT_CONFIG.edgeFloor;
  if (kind === "RISE_FALL" && isOneHzMarket(market) && durationTicks <= 3) {
    edgeFloor = Math.max(edgeFloor, SHORT_1HZ_RISE_FALL_EDGE);
  }
  if (kind === "HIGHER_LOWER") {
    edgeFloor = Math.max(edgeFloor, HIGHER_LOWER_EDGE_FLOOR);
  }

  const maxWinProb = kind === "HIGHER_LOWER" ? HIGHER_LOWER_MAX_WIN_PROB : DEFAULT_CONFIG.maxWinProb;
  const cfg: PricingConfig = params.cfg ?? { ...DEFAULT_CONFIG, edgeFloor, maxWinProb };
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
    // Live R_50 sticky Matches: wr ~34% at ~7.6× (RTP ~3.4). Conditional pricing
    // is the primary fix; 20% floor absorbs residual regime drift.
    productFloor = 0.20;
  } else if (side === "Differs") {
    productFloor = 0.025; // 2.5% edge floor for Differs (90% win prob)
  } else if (side === "Over" && targetDigit === 0) {
    productFloor = 0.03;  // 3% edge floor for Over 0 (90% win prob)
  } else if (side === "Under" && targetDigit === 9) {
    productFloor = 0.03;  // 3% edge floor for Under 9 (90% win prob)
  } else if (side === "Under" && targetDigit >= 4 && targetDigit <= 6) {
    // Mid Under (esp. R_50 Under 4/5) ran RTP 1.30–1.33 live — widen the floor.
    productFloor = 0.18;
  } else if (side === "Over" && targetDigit >= 3 && targetDigit <= 5) {
    // Symmetric mid-Over cushion (R_50 Over short-duration was the other OU bleed).
    productFloor = 0.15;
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
  /** Deriv symbol — used to quarantine markets whose Under is mis-calibrated. */
  market?: string;
  /** Live entry digit. Required for Matches; when supplied, Over/Under are also
   *  priced CONDITIONALLY on it (removes the sticky-digit autocorrelation edge). */
  entryDigit?: number;
}): DigitPrice {
  const { side, targetDigit, durationTicks, stake, ticks, entryDigit, market } = params;

  // 0. Microstructure gate: reject too-short Over/Under (autocorrelation exploit).
  if ((side === "Over" || side === "Under") && durationTicks < MIN_OVER_UNDER_TICKS) {
    return { accepted: false, reason: `Over/Under needs at least ${MIN_OVER_UNDER_TICKS} ticks` };
  }

  // 0b. Calibration quarantine: fail closed on markets where Under is currently
  // priced +EV (see lib/binary/quarantine — R_50 Under mid-digit leak).
  if (side === "Under" && isUnderQuarantined(market)) {
    return { accepted: false, reason: "Under is temporarily unavailable on this market" };
  }

  // 1. Stability Gate (Matches only): reject biased target digits. Tightened
  // from [7%, 13%] → [8%, 12%] after R_50 sticky Matches autopsy (RTP ~3.0).
  if (side === "Matches") {
    if (ticks.length === 0) {
      return { accepted: false, reason: "insufficient market data" };
    }
    let targetCount = 0;
    for (const tick of ticks) {
      if (exitDigitFromQuote(tick) === targetDigit) {
        targetCount++;
      }
    }
    const freq = targetCount / ticks.length;
    if (freq < MATCHES_FREQ_LO || freq > MATCHES_FREQ_HI) {
      return { accepted: false, reason: `digit distribution unstable (freq ${(freq * 100).toFixed(1)}%)` };
    }
    // Sticky Matches MUST be priced conditionally — fail closed without entry digit.
    if (entryDigit == null || !Number.isInteger(entryDigit) || entryDigit < 0 || entryDigit > 9) {
      return { accepted: false, reason: "entry digit required for Matches" };
    }
  }

  // Baseline is 10% for Digits, but 20% for Matches to absorb sticky-digit drift,
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

  // Matches always prices conditionally (sticky entry=target was RTP ~3.4 live).
  // Over/Under use conditional when entryDigit is supplied (bet route always does).
  const condEntry =
    side === "Matches" || side === "Over" || side === "Under" ? entryDigit : undefined;
  const q = priceDigitContract(side, targetDigit, durationTicks, ticks, cfg, 1, condEntry);
  if (!q.accepted) return { accepted: false, reason: q.reason };
  const payout = Number((stake * q.payoutMultiplier).toFixed(2));
  return { accepted: true, payout, multiplier: q.payoutMultiplier };
}
