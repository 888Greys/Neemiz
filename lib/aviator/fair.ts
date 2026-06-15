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

// House edge / cap — MUST stay in sync with the Go engine
// (internal/game/provably_fair.go on the aviator service).
const HOUSE_EDGE = 0.03;     // 3% instant-crash
const MIN_MULTIPLIER = 1.00;
const MAX_MULTIPLIER = 250;  // engine cap

/**
 * Deterministic crash point — an exact port of the Go engine's
 * HashAndMapToMultiplier(serverSeed, clientSeed, nonce). This MUST match the
 * engine byte-for-byte or provably-fair verification fails.
 *
 *   message = `${clientSeed}:${nonce}`
 *   r       = first 16 hex chars (64-bit) of HMAC-SHA256(serverSeed, message) / 2^64
 *   r < 0.03            → 1.00 (instant crash)
 *   else crash = floor( 0.97 / (1 - r) , 2dp ), clamped to [1.00, 250.00]
 */
export function generateCrashPoint(serverSeed: string, clientSeed: string, nonce: number): number {
  const hmac = createHmac("sha256", serverSeed).update(`${clientSeed}:${nonce}`).digest("hex");
  // First 16 hex = 64 bits. Number(BigInt) matches Go's float64(uint64) conversion.
  const r = Number(BigInt("0x" + hmac.slice(0, 16))) / 2 ** 64;

  if (r < HOUSE_EDGE) return MIN_MULTIPLIER;

  const crashValue = (100 - HOUSE_EDGE * 100) / (100 - r * 100);
  const final = Math.floor(crashValue * 100) / 100;
  return Math.min(MAX_MULTIPLIER, Math.max(MIN_MULTIPLIER, final));
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
