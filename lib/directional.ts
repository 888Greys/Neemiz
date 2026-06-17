// Directional contract math — Rise/Fall and Higher/Lower. Pure functions shared
// by the client (display) and the server (pricing + settlement) so both agree.
//
// Rise/Fall is a ~50/50 bet (exit vs entry) priced like Even/Odd. Higher/Lower
// (exit vs a chosen barrier) is priced from the empirical volatility so the
// payout scales with win probability — no barrier ever gives the player +EV.
// Both apply the standard profit retention at settlement, like every other game.

import { applyProfitRetention } from "@/lib/house-retention";

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

export type DirectionalSide = "RISE" | "FALL" | "HIGHER" | "LOWER" | "TOUCH" | "NO_TOUCH" | "CALL" | "PUT";
export type DirectionalKind = "RISE_FALL" | "HIGHER_LOWER" | "TOUCH_NO_TOUCH" | "VANILLA";

// A vanilla's intrinsic payout is unbounded; cap the credit at this multiple of
// stake to bound house liability.
export const MAX_VANILLA_MULT = 50;

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

/**
 * Probability the spot touches a one-sided barrier within N ticks, under a
 * driftless Brownian model (reflection principle: P(max ≥ a) = 2·P(W_N ≥ a)).
 */
export function touchProbability(entrySpot: number, barrier: number, sigmaTick: number, durationTicks: number): number {
  const sigmaN = sigmaTick * Math.sqrt(Math.max(1, durationTicks));
  if (!(sigmaN > 0) || !(entrySpot > 0) || !(barrier > 0)) return barrier === entrySpot ? 1 : 0;
  const d = Math.abs(Math.log(barrier / entrySpot)) / sigmaN;
  return Math.min(0.98, 2 * (1 - normalCdf(d)));
}

/** Black–Scholes price (r=0) of a call/put with T = durationTicks, σ = sigmaTick. */
function blackScholes(entrySpot: number, strike: number, sigmaTick: number, durationTicks: number, isCall: boolean): number {
  const sigmaT = sigmaTick * Math.sqrt(Math.max(1, durationTicks));
  if (!(sigmaT > 0) || !(entrySpot > 0) || !(strike > 0)) {
    return Math.max(0, isCall ? entrySpot - strike : strike - entrySpot);
  }
  const d1 = (Math.log(entrySpot / strike) + 0.5 * sigmaT * sigmaT) / sigmaT;
  const d2 = d1 - sigmaT;
  return isCall
    ? entrySpot * normalCdf(d1) - strike * normalCdf(d2)
    : strike * normalCdf(-d2) - entrySpot * normalCdf(-d1);
}

/**
 * Vanilla payout-per-point: the player's `stake` buys this many "contracts",
 * each paying 1 per in-the-money point at expiry. Priced from Black–Scholes
 * plus the gross edge, so E[payout] = stake/(1+edge) — the house always has its
 * margin and there is no +EV strike.
 */
export function vanillaPayoutPerPoint(params: {
  entrySpot: number; strike: number; side: "CALL" | "PUT"; sigmaTick: number; durationTicks: number; stake: number;
}): number {
  const price = blackScholes(params.entrySpot, params.strike, params.sigmaTick, params.durationTicks, params.side === "CALL");
  const premium = Math.max(price * (1 + DIRECTIONAL_GROSS_EDGE), params.entrySpot * 1e-6);
  return params.stake / premium;
}

/** Gross payout rate for a FIXED-payout contract (before profit retention). */
export function payoutRate(params: {
  kind: "RISE_FALL" | "HIGHER_LOWER" | "TOUCH_NO_TOUCH";
  side: DirectionalSide;
  entrySpot?: number;
  barrier?: number;
  sigmaTick?: number;
  durationTicks?: number;
}): number {
  if (params.kind === "RISE_FALL") return RISE_FALL_RATE;
  if (params.kind === "TOUCH_NO_TOUCH") {
    const pt = touchProbability(params.entrySpot!, params.barrier!, params.sigmaTick!, params.durationTicks!);
    const p = params.side === "TOUCH" ? pt : 1 - pt;
    return rateFromProb(p);
  }
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

export type ContractResolution =
  | { ready: false }
  | { ready: true; won: boolean; credit: number; exitSpot: number };

export type ResolveParams = {
  kind: DirectionalKind;
  side: DirectionalSide;
  entrySpot: number;
  barrier: number | null;        // barrier (HIGHER_LOWER/TOUCH) or strike (VANILLA)
  durationTicks: number;
  stake: number;
  payout: number;                // fixed net payout (non-vanilla kinds)
  payoutPerPoint: number | null; // VANILLA only
};

/**
 * Resolve a contract against the tick path (chronological, strictly after
 * entry). Returns { ready: false } when the outcome isn't determined yet.
 * - TOUCH_NO_TOUCH walks the path and can resolve early on a touch.
 * - VANILLA / RISE_FALL / HIGHER_LOWER resolve on the durationTicks-th tick.
 */
export function resolveContract(p: ResolveParams, ticks: { price: number; epoch: number }[]): ContractResolution {
  if (p.kind === "TOUCH_NO_TOUCH") {
    const barrier = p.barrier!;
    const up = barrier > p.entrySpot;
    const window = ticks.slice(0, p.durationTicks);
    const touchIdx = window.findIndex((t) => (up ? t.price >= barrier : t.price <= barrier));
    if (touchIdx >= 0) {
      const won = p.side === "TOUCH";
      return { ready: true, won, credit: won ? p.payout : 0, exitSpot: window[touchIdx].price };
    }
    if (ticks.length >= p.durationTicks) {
      const won = p.side === "NO_TOUCH"; // full window elapsed, never touched
      return { ready: true, won, credit: won ? p.payout : 0, exitSpot: ticks[p.durationTicks - 1].price };
    }
    return { ready: false };
  }

  const exit = ticks[p.durationTicks - 1];
  if (!exit) return { ready: false };

  if (p.kind === "VANILLA") {
    const strike = p.barrier!;
    const intrinsic = p.side === "CALL" ? Math.max(0, exit.price - strike) : Math.max(0, strike - exit.price);
    const gross = Math.min((p.payoutPerPoint ?? 0) * intrinsic, p.stake * MAX_VANILLA_MULT);
    const credit = applyProfitRetention(p.stake, gross);
    return { ready: true, won: credit >= p.stake, credit, exitSpot: exit.price };
  }

  const won = evaluateDirectional({
    kind: p.kind as "RISE_FALL" | "HIGHER_LOWER",
    side: p.side, entrySpot: p.entrySpot, exitSpot: exit.price, barrier: p.barrier,
  });
  return { ready: true, won, credit: won ? p.payout : 0, exitSpot: exit.price };
}
