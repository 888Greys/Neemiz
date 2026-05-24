/**
 * Aviator — Provably Fair Math
 *
 * Crash point:  HMAC-SHA256(serverSeed, roundId) → deterministic crash multiplier
 * Multiplier:   exponential growth from flyingStartedAt timestamp
 * Verifiable:   after crash, serverSeed is revealed; anyone can replay the formula
 */

import { createHmac, createHash, randomBytes } from "crypto";

// ─── Server seed ──────────────────────────────────────────────────────────────

/** Generate a random 32-byte hex server seed for a new round */
export function generateServerSeed(): string {
  return randomBytes(32).toString("hex");
}

/** SHA-256 of seed — shown to players BEFORE the round starts */
export function hashServerSeed(seed: string): string {
  return createHash("sha256").update(seed).digest("hex");
}

// ─── Crash point ─────────────────────────────────────────────────────────────

/**
 * Deterministic crash point from serverSeed + roundId.
 *
 * Distribution targets:
 *   ~5%  of rounds crash instantly at 1.00×  (h % 20 === 0)
 *   P(crash > 2×) ≈ 28–30%  →  70% loss rate for players cashing out at 2×
 *
 * Math: base Pareto(1,1) = e/(e−h) compressed by exponent 1/1.74 ≈ 0.575
 *   P(X > x) = 1 / x^1.74
 *   P(X > 2) ≈ 30%  →  total win rate ≈ 0.95 × 0.30 ≈ 28.5% at 2× cashout
 *
 * Returns a value ≥ 1.00.
 */
export function generateCrashPoint(serverSeed: string, roundId: string): number {
  const hmac = createHmac("sha256", serverSeed).update(roundId).digest("hex");
  const h    = parseInt(hmac.slice(0, 8), 16); // 32-bit integer
  const e    = 2 ** 32;

  // ~5% instant-crash house edge (1 in 20 rounds)
  if (h % 20 === 0) return 1.00;

  // Compress the Pareto distribution so high multipliers are rarer
  // Exponent 0.575 ≈ 1/1.74 → P(crash > x) = 1/x^1.74
  const pareto = e / (e - h);
  const raw    = Math.pow(pareto, 0.575);
  return Math.min(1000.00, Math.max(1.00, Math.floor(raw * 100) / 100));
}

// ─── Multiplier ───────────────────────────────────────────────────────────────

const GROWTH_RATE = 0.00006; // per millisecond

/**
 * Current multiplier based on how long the plane has been flying.
 * ~1.35x at 5s, ~1.82x at 10s, ~3.3x at 20s, ~6x at 30s, ~18x at 50s
 */
export function getMultiplier(flyingStartedAt: Date): number {
  const elapsed = Date.now() - flyingStartedAt.getTime();
  return Math.round(Math.exp(GROWTH_RATE * elapsed) * 100) / 100;
}

/**
 * How many ms must elapse from flyingStartedAt to reach targetMultiplier.
 * Used to pre-compute the exact crash time.
 */
export function elapsedMsAtMultiplier(targetMultiplier: number): number {
  return Math.log(targetMultiplier) / GROWTH_RATE;
}

/**
 * The exact Date when the round will crash, given when flying started.
 */
export function crashTimeFromStart(flyingStartedAt: Date, crashPoint: number): Date {
  const ms = elapsedMsAtMultiplier(crashPoint);
  return new Date(flyingStartedAt.getTime() + ms);
}
