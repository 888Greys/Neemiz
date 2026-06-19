// Accumulator contract math — the single source of truth for barriers, payout
// growth, and tick-path replay. Pure functions only (no DB, no network) so the
// client (display) and the server (settlement) compute identical numbers.
//
// Model (see the design notes): each surviving tick multiplies the stake by
// (1 + g%). A tick "survives" when |spot/prevSpot - 1| <= barrierFrac. The
// barrier is the *fair* half-width δ = σ·z(g), where σ is the empirical one-tick
// volatility measured at buy time and z(g) = Φ⁻¹((1+p)/2), p = 1/(1+g). At the
// fair barrier the per-tick bet is a martingale (E[payout] = stake); the house
// edge comes solely from the standard 30% profit retention at settlement, so
// there is never a +EV path for the player.

export const GROWTH_RATES = [1, 2, 3, 4, 5] as const; // percent per surviving tick

// Per-rate hard cap on surviving ticks. Bounds house liability — every rate
// caps the payout at roughly 10–11× stake — and guarantees an abandoned
// contract resolves (rides to bust or cap) instead of growing forever.
export const MAX_TICKS_BY_RATE: Record<number, number> = { 1: 230, 2: 120, 3: 80, 4: 60, 5: 50 };

// Volatility window: number of pre-entry ticks used to measure σ.
export const SIGMA_WINDOW = 120;
// Guardrail on the barrier half-width so a momentary volatility spike cannot
// mint an absurd band. Do not impose a fixed lower floor: synthetic-index
// volatility can legitimately be below 0.05%, and widening a fair barrier at
// that point turns an accumulator into a near-guaranteed payout.
const MAX_BARRIER_FRAC = 0.05;
// Relative slack on the breach test so a move landing exactly on the barrier
// isn't a false bust from floating-point error.
const BREACH_EPS = 1e-9;

export function isValidGrowthRate(g: number): boolean {
  return (GROWTH_RATES as readonly number[]).includes(g);
}

export function maxTicksFor(growthRate: number): number {
  return MAX_TICKS_BY_RATE[growthRate] ?? 50;
}

/** Inverse standard-normal CDF (probit), Acklam's approximation (~1e-9 abs err). */
export function probit(p: number): number {
  if (p <= 0 || p >= 1) throw new Error(`probit domain: ${p}`);
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2, -3.066479806614716e1, 2.506628277459239];
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];
  const plow = 0.02425, phigh = 1 - plow;
  if (p < plow) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
           ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  if (p <= phigh) {
    const q = p - 0.5, r = q * q;
    return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
           (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  }
  const q = Math.sqrt(-2 * Math.log(1 - p));
  return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
          ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
}

/** z(g): how many σ the fair barrier sits at for a given growth rate. */
export function zForGrowth(growthRate: number): number {
  const p = 1 / (1 + growthRate / 100); // fair per-tick survival probability
  return probit((1 + p) / 2);
}

/** Empirical one-tick volatility σ (std of fractional returns) from recent spots. */
export function computeSigma(prices: number[]): number {
  const rets: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    const a = prices[i - 1], b = prices[i];
    if (a > 0 && Number.isFinite(a) && Number.isFinite(b)) rets.push(b / a - 1);
  }
  if (rets.length < 20) throw new Error("not enough ticks to measure volatility");
  const mean = rets.reduce((s, r) => s + r, 0) / rets.length;
  const variance = rets.reduce((s, r) => s + (r - mean) ** 2, 0) / (rets.length - 1);
  const sigma = Math.sqrt(variance);
  if (!(sigma > 0)) throw new Error("degenerate volatility");
  return sigma;
}

/** Fair barrier half-width δ (fraction of spot), clamped to sane guardrails. */
export function barrierFracFor(sigma: number, growthRate: number): number {
  const raw = sigma * zForGrowth(growthRate);
  return Math.min(MAX_BARRIER_FRAC, raw);
}

/** Grown payout after n surviving ticks (unrounded). */
export function payoutAtTick(stake: number, growthRate: number, n: number): number {
  return stake * (1 + growthRate / 100) ** n;
}

export type AccumulatorOutcome = {
  kind: "OPEN" | "CLOSED" | "BUSTED";
  reason: "live" | "take_profit" | "max_ticks" | "breach";
  ticksSurvived: number;
  exitSpot: number;
  payout: number; // unrounded; 0 for a bust
};

export type ReplayTick = { price: number; epoch: number };

/**
 * Replay the tick path from entry and return the contract outcome.
 *
 * Walks ticks in order (only those with epoch <= closeEpoch). The first tick
 * that breaches the band busts the contract (payout 0) — so a bust that already
 * happened can never be "out-cashed" by a late client request, because we settle
 * by tick epoch, not by request time. If take-profit or the max-ticks cap is hit
 * first, the contract closes there. If none of those happen up to closeEpoch the
 * outcome is OPEN (used by a cash-out: pay the grown amount at the last tick).
 */
export function replayAccumulator(params: {
  ticks: ReplayTick[];        // chronological spots strictly after entry
  entrySpot: number;
  growthRate: number;
  barrierFrac: number;
  maxTicks: number;
  stake: number;
  takeProfit?: number | null; // profit (KSh above stake) that auto-closes
  closeEpoch?: number;        // only count ticks at/under this epoch (default: all)
}): AccumulatorOutcome {
  const { ticks, entrySpot, growthRate, barrierFrac, maxTicks, stake } = params;
  const takeProfit = params.takeProfit ?? null;
  const closeEpoch = params.closeEpoch ?? Number.POSITIVE_INFINITY;

  let prev = entrySpot;
  let n = 0;

  for (const t of ticks) {
    if (t.epoch > closeEpoch) break;
    if (!(t.price > 0) || !Number.isFinite(t.price)) continue; // skip junk ticks
    n += 1;

    if (Math.abs(t.price / prev - 1) > barrierFrac + BREACH_EPS) {
      return { kind: "BUSTED", reason: "breach", ticksSurvived: n - 1, exitSpot: t.price, payout: 0 };
    }

    const payoutN = payoutAtTick(stake, growthRate, n);
    if (takeProfit != null && payoutN - stake >= takeProfit) {
      return { kind: "CLOSED", reason: "take_profit", ticksSurvived: n, exitSpot: t.price, payout: payoutN };
    }
    if (n >= maxTicks) {
      return { kind: "CLOSED", reason: "max_ticks", ticksSurvived: n, exitSpot: t.price, payout: payoutN };
    }
    prev = t.price;
  }

  // No terminal event up to closeEpoch — survived n ticks so far.
  return { kind: "OPEN", reason: "live", ticksSurvived: n, exitSpot: prev, payout: payoutAtTick(stake, growthRate, n) };
}
