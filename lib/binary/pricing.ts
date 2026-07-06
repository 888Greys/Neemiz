// ─────────────────────────────────────────────────────────────────────────────
// PRICING ENGINE  (step 3 of docs/binary-architecture.md)
//
// Prices every binary contract the exploit-proof way: NOT from a closed-form
// probability (Black–Scholes / reflection principle — the models that BROKE,
// because Deriv's synthetics are discrete, jumpy and fat-tailed), but by
// simulating the SETTLEMENT KERNEL over REAL tick windows and measuring the
// win frequency. Price and settlement then share the same discrete process, so
// there is no model gap for a player to exploit.
//
// Three guarantees make it house-safe regardless of the market:
//   1. NONPARAMETRIC — win prob is measured, not assumed. No σ to under-measure,
//      no uniform-digit assumption, no continuous approximation. Jumps and
//      autocorrelation survive because we bootstrap CONTIGUOUS real windows.
//   2. CONSERVATIVE — we price off the UPPER confidence bound of the player's
//      win probability (Wilson), so sampling error always favours the house,
//      then apply a hard edge floor and round the payout DOWN.
//   3. FAIL-CLOSED — thin/insufficient data, or a contract the player can make
//      near-certain, is REJECTED (never sold on a guess).
//
// The realized RTP of anything this engine accepts is ≤ 1 by construction; that
// is asserted in tests/pricing.test.ts and demonstrated on live Deriv ticks in
// scripts/pricing-proof.ts.
// ─────────────────────────────────────────────────────────────────────────────

import { resolveContract, digitWonFromQuote, type DigitSide, type DirectionalKind, type DirectionalSide, type ResolveParams } from "@/lib/binary/kernel";
import { makeRng } from "@/lib/binary/fairness";

export type PricingConfig = {
  edgeFloor: number;      // minimum house edge baked into every price (e.g. 0.06)
  z: number;              // confidence multiplier for the win-prob upper bound (2.33 ≈ 99%)
  samples: number;        // bootstrap draws used to estimate the win prob
  maxWinProb: number;     // reject contracts the player can make this likely
  maxMultiplier: number;  // liability cap on the net payout multiple
  minTicks: number;       // refuse to quote on fewer real ticks than this
};

export const DEFAULT_CONFIG: PricingConfig = {
  // Edge floor deliberately conservative: it must absorb the regime drift a
  // synthetic index shows between calibration and settlement (measured up to
  // ~7% on the lowest-vol indices like 1HZ10V). 6% left 1HZ10V marginally +EV
  // out-of-sample; 9% covers it with headroom on every symbol.
  edgeFloor: 0.09,
  z: 2.58,               // ~99.5% one-sided win-prob upper bound
  samples: 4000,
  maxWinProb: 0.90,
  maxMultiplier: 50,
  minTicks: 500,
};

export type Quote =
  | { accepted: false; reason: string }
  | { accepted: true; winProb: number; winProbUpper: number; payoutMultiplier: number };

// ─── Estimation primitives ───────────────────────────────────────────────────

/** Wilson score UPPER bound for a binomial proportion — robust near 0 and 1,
 *  unlike the normal approximation. We price off this so undersampling the
 *  player's win rate can only cost the house margin, never create a +EV bet. */
export function wilsonUpper(wins: number, n: number, z: number): number {
  if (n === 0) return 1;
  const p = wins / n;
  const z2 = z * z;
  const denom = 1 + z2 / n;
  const center = (p + z2 / (2 * n)) / denom;
  const half = (z * Math.sqrt((p * (1 - p) + z2 / (4 * n)) / n)) / denom;
  return Math.min(1, center + half);
}

/** A contiguous real window: entry spot + the D forward ticks that settle it. */
export type Window = { entry: number; forward: number[] };

/** Block-bootstrap contiguous windows of `duration` forward ticks from a real
 *  tick series. Contiguous (not iid) sampling preserves volatility clustering,
 *  autocorrelation and jumps exactly as the market produced them. */
export function sampleWindows(ticks: number[], duration: number, count: number, rng: () => number): Window[] {
  const maxStart = ticks.length - duration - 1;
  const out: Window[] = [];
  if (maxStart < 1) return out;
  for (let i = 0; i < count; i++) {
    const s = Math.floor(rng() * maxStart);
    out.push({ entry: ticks[s], forward: ticks.slice(s + 1, s + 1 + duration) });
  }
  return out;
}

const toPath = (forward: number[]) => forward.map((price, k) => ({ price, epoch: k + 1 }));

/** Estimate the player's win probability by running the kernel over windows. */
function winFrequency(windows: Window[], settle: (w: Window) => boolean): { wins: number; n: number } {
  let wins = 0;
  for (const w of windows) if (settle(w)) wins++;
  return { wins, n: windows.length };
}

// ─── The house-safe price ────────────────────────────────────────────────────

/** Turn a kernel-measured win frequency into a quote: price off the Wilson
 *  upper bound with the edge floor, reject near-certain / over-liability. */
function quoteFromWinFrequency(wins: number, n: number, cfg: PricingConfig): Quote {
  const winProb = n > 0 ? wins / n : 1;
  const upper = wilsonUpper(wins, n, cfg.z);
  if (upper >= cfg.maxWinProb) return { accepted: false, reason: `win probability ${(upper * 100).toFixed(1)}% ≥ cap ${(cfg.maxWinProb * 100).toFixed(0)}%` };
  if (!(upper > 0)) return { accepted: false, reason: "contract cannot win" };
  // payout ≤ (1 − edge) / p_upper, rounded DOWN → house keeps ≥ edge at the true p.
  const raw = (1 - cfg.edgeFloor) / upper;
  const payoutMultiplier = Math.floor(Math.min(cfg.maxMultiplier, raw) * 100) / 100;
  if (payoutMultiplier <= 1.0) return { accepted: false, reason: "priced ≤ 1× (too likely to be worth offering)" };
  return { accepted: true, winProb, winProbUpper: upper, payoutMultiplier };
}

// ─── Public: price each contract family off a real tick series ────────────────

export function priceDigitContract(
  side: DigitSide, targetDigit: number, duration: number, ticks: number[], cfg: PricingConfig = DEFAULT_CONFIG, seed = 1,
): Quote {
  if (ticks.length < cfg.minTicks) return { accepted: false, reason: "insufficient market data" };
  const windows = sampleWindows(ticks, duration, cfg.samples, makeRng(seed));
  const { wins, n } = winFrequency(windows, (w) => digitWonFromQuote(side, targetDigit, w.forward[w.forward.length - 1]));
  return quoteFromWinFrequency(wins, n, cfg);
}

export function priceDirectionalContract(
  kind: Exclude<DirectionalKind, "VANILLA">, side: DirectionalSide, barrierFrac: number | null, duration: number,
  ticks: number[], cfg: PricingConfig = DEFAULT_CONFIG, seed = 1,
): Quote {
  if (ticks.length < cfg.minTicks) return { accepted: false, reason: "insufficient market data" };
  const windows = sampleWindows(ticks, duration, cfg.samples, makeRng(seed));
  const settle = (w: Window): boolean => {
    const barrier = barrierFrac == null ? null : w.entry * (1 + barrierFrac);
    const params: ResolveParams = { kind, side, entrySpot: w.entry, barrier, durationTicks: duration, stake: 1, payout: 1, payoutPerPoint: null };
    const r = resolveContract(params, toPath(w.forward));
    return r.ready ? r.won : false;
  };
  return quoteFromWinFrequency(windows.reduce((a, w) => a + (settle(w) ? 1 : 0), 0), windows.length, cfg);
}
