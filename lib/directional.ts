// Directional contract math — Rise/Fall and Higher/Lower. Pure functions shared
// by the client (display) and the server (pricing + settlement) so both agree.
//
// Rise/Fall is a ~50/50 bet (exit vs entry) priced like Even/Odd. Higher/Lower
// (exit vs a chosen barrier) is priced from the empirical volatility so the
// payout scales with win probability — no barrier ever gives the player +EV.
// Both apply the standard profit retention at settlement, like every other game.

export const DIRECTIONAL_GROSS_EDGE = 0.05;      // 5% gross edge baked into the rate
const RISE_FALL_RATE = 1.90;                     // ~50/50, mirrors Even/Odd
const MIN_RATE = 1.01;
const MAX_RATE = 50;
const MIN_WIN_PROB = 0.05;                        // clamp extreme barriers
const MAX_WIN_PROB = 0.95;

/** Standard normal CDF Φ (Abramowitz & Stegun 7.1.26 erf approximation). */
export function normalCdf(x: number): number {
  const t = 1 / (1 + 0.3275911 * Math.abs(x / Math.SQRT2));
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592)
    * t * Math.exp(-(x / Math.SQRT2) * (x / Math.SQRT2));
  const erf = x >= 0 ? y : -y;
  return 0.5 * (1 + erf);
}

function rateFromProb(p: number): number {
  const clamped = Math.min(MAX_WIN_PROB, Math.max(MIN_WIN_PROB, p));
  const raw = (1 - DIRECTIONAL_GROSS_EDGE) / clamped; // 0.95 / p
  return Math.min(MAX_RATE, Math.max(MIN_RATE, Math.floor(raw * 100) / 100));
}

export type DirectionalSide = "RISE" | "FALL" | "HIGHER" | "LOWER";

/** Win probability for a Higher/Lower bet under a zero-drift log-normal model. */
export function higherLowerWinProb(params: {
  entrySpot: number;
  barrier: number;
  side: "HIGHER" | "LOWER";
  sigmaTick: number;     // empirical per-tick fractional volatility
  durationTicks: number;
}): number {
  const { entrySpot, barrier, side, sigmaTick, durationTicks } = params;
  const sigmaN = sigmaTick * Math.sqrt(Math.max(1, durationTicks));
  if (!(sigmaN > 0) || !(entrySpot > 0) || !(barrier > 0)) return 0.5;
  const d = Math.log(barrier / entrySpot) / sigmaN;
  // P(exit > barrier) = 1 - Φ(d);  P(exit < barrier) = Φ(d)
  return side === "HIGHER" ? 1 - normalCdf(d) : normalCdf(d);
}

/** Gross payout rate for a contract (before profit retention). */
export function payoutRate(params: {
  kind: "RISE_FALL" | "HIGHER_LOWER";
  side: DirectionalSide;
  entrySpot?: number;
  barrier?: number;
  sigmaTick?: number;
  durationTicks?: number;
}): number {
  if (params.kind === "RISE_FALL") return RISE_FALL_RATE;
  const p = higherLowerWinProb({
    entrySpot: params.entrySpot!,
    barrier: params.barrier!,
    side: params.side as "HIGHER" | "LOWER",
    sigmaTick: params.sigmaTick!,
    durationTicks: params.durationTicks!,
  });
  return rateFromProb(p);
}

/** Did the contract win? Tie (exactly equal) is a loss, like Deriv. */
export function evaluateDirectional(params: {
  kind: "RISE_FALL" | "HIGHER_LOWER";
  side: DirectionalSide;
  entrySpot: number;
  exitSpot: number;
  barrier?: number | null;
}): boolean {
  const { kind, side, entrySpot, exitSpot } = params;
  if (kind === "RISE_FALL") {
    return side === "RISE" ? exitSpot > entrySpot : exitSpot < entrySpot;
  }
  const barrier = params.barrier ?? entrySpot;
  return side === "HIGHER" ? exitSpot > barrier : exitSpot < barrier;
}
