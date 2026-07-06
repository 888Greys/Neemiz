// ─────────────────────────────────────────────────────────────────────────────
// FAIRNESS HARNESS (pure core)
//
// The engine that proves a contract is house-safe. It never asserts a closed-
// form probability; it MEASURES realized RTP by drawing many tick paths and
// running the settlement kernel over each one — exactly how a real settlement
// would decide. Two consumers share this core:
//
//   • tests/fairness.test.ts — draws paths from a seeded synthetic process
//     (deterministic, no network) and asserts the architecture's invariant:
//     a contract PRICED by Monte-Carlo of the kernel has realized RTP ≤ 1.
//   • scripts/fairness-sim.ts — draws paths from REAL Deriv ticks and audits
//     the CURRENT live pricing, flagging any contract that is +EV for players.
//
// RTP (return-to-player) = E[payout] / stake. RTP < 1 ⇒ house edge ⇒ safe.
// RTP > 1 ⇒ player has positive expectation ⇒ exploitable.
// ─────────────────────────────────────────────────────────────────────────────

/** Deterministic PRNG (mulberry32) so simulations are reproducible/auditable. */
export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Standard normal via Box–Muller, driven by the supplied uniform RNG. */
export function gaussian(rng: () => number): number {
  let u = 0, v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export type TickPath = { price: number; epoch: number }[];

/** Simulate a discrete zero-drift log-normal tick path of `steps` ticks. This is
 *  a stand-in market model for tests; the live script uses real ticks instead. */
export function simulatePath(rng: () => number, opts: { start: number; sigmaTick: number; steps: number; epoch0?: number }): TickPath {
  const { start, sigmaTick, steps } = opts;
  const path: TickPath = [];
  let price = start;
  let epoch = opts.epoch0 ?? 0;
  for (let i = 0; i < steps; i++) {
    price = price * Math.exp(sigmaTick * gaussian(rng) - 0.5 * sigmaTick * sigmaTick);
    epoch += 1;
    path.push({ price, epoch });
  }
  return path;
}

// ─── The two measurements ────────────────────────────────────────────────────

export type Trial = {
  /** Draw one fresh tick path from the market model (synthetic or real). */
  drawPath: () => TickPath;
  /** Run the settlement KERNEL over the path: did the contract win? */
  settle: (path: TickPath) => boolean;
};

/** Monte-Carlo the kernel to estimate a contract's win probability. This is the
 *  ONLY probability a price may be built from — it comes from settlement itself. */
export function estimateWinProb(trial: Trial, trials: number): number {
  let wins = 0;
  for (let i = 0; i < trials; i++) if (trial.settle(trial.drawPath())) wins++;
  return wins / trials;
}

/** Realized RTP for a contract paid at `netMultiplierOnWin` × stake on a win.
 *  Draws fresh paths (independent of any used for pricing) and settles each. */
export function measureRtp(trial: Trial, netMultiplierOnWin: number, trials: number): { rtp: number; winRate: number } {
  let wins = 0;
  let payout = 0;
  for (let i = 0; i < trials; i++) {
    if (trial.settle(trial.drawPath())) { wins++; payout += netMultiplierOnWin; }
  }
  return { rtp: payout / trials, winRate: wins / trials };
}

/** Price a contract the house-safe way: from the kernel-measured win prob, with
 *  a hard edge floor and rounding that always favours the house. Returns the net
 *  payout multiplier on a win (stake = 1). Never returns a +EV price. */
export function safePayoutMultiplier(winProb: number, edgeFloor: number): number {
  if (!(winProb > 0)) return 0;                       // can't win ⇒ can't be sold
  const raw = (1 - edgeFloor) / winProb;
  return Math.floor(raw * 100) / 100;                 // round DOWN = house-safe
}

/** Empirical last-digit distribution of a price series (for digit-game audits). */
export function digitDistribution(prices: number[], toDigit: (q: number) => number): number[] {
  const freq = Array(10).fill(0);
  for (const p of prices) freq[toDigit(p)]++;
  return freq.map((f) => f / prices.length);
}
