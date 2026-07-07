// ─────────────────────────────────────────────────────────────────────────────
// PROVABLY FAIR — directional
//
// A directional contract settles from REAL Deriv ticks (public, immutable,
// epoch-stamped). So the core fairness proof is not a server RNG the player has
// to trust — it is that the outcome is a deterministic REPLAY of public market
// data through the open-source settlement kernel. This module adds the
// tamper-evidence around that:
//
//   • COMMITMENT — at bet time the server draws a random serverSeed and
//     publishes commitment = SHA256(serverSeed). Revealed at/after settlement so
//     the player can check SHA256(serverSeed) === commitment. It proves the quote
//     existed BEFORE the outcome (anti-backdating / anti-grinding), bound to the
//     player's clientSeed + nonce.
//   • SIGNED QUOTE — the server HMAC-signs the exact terms INCLUDING entryEpoch
//     and payoutMultiplier. The signature is tamper-evident: the terms a trade
//     settles on cannot be altered after the fact without breaking it.
//   • VERIFY — anyone re-fetches the Deriv ticks from the committed entryEpoch,
//     replays the kernel, and confirms the won/lost + credit the server paid.
//     For a market-settled game the serverSeed does NOT affect the outcome (the
//     market does), so revealing it early is harmless — its job is pre-commitment.
// ─────────────────────────────────────────────────────────────────────────────

import { createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";
import { resolveContract, type ResolveParams, type DirectionalKind, type DirectionalSide } from "@/lib/binary/kernel";

const SECRET = process.env.PROVABLY_FAIR_SECRET || process.env.ADMIN_2FA_SECRET || "";

export function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}
export function newServerSeed(): string {
  return randomBytes(32).toString("hex");
}
export function commitmentOf(serverSeed: string): string {
  return sha256(serverSeed);
}

export type QuoteTerms = {
  market: string;
  kind: DirectionalKind;
  side: DirectionalSide;
  entrySpot: number;
  entryEpoch: number;
  barrier: number | null;
  durationTicks: number;
  payoutMultiplier: number;   // net multiple on a win (0 for VANILLA)
  commitment: string;         // SHA256(serverSeed)
  clientSeed: string;
  nonce: number;
};

/** Stable, order-independent serialization so the signature is reproducible. */
export function canonicalize(t: QuoteTerms): string {
  return [
    t.market, t.kind, t.side,
    t.entrySpot, t.entryEpoch,
    t.barrier ?? "null",
    t.durationTicks, t.payoutMultiplier,
    t.commitment, t.clientSeed, t.nonce,
  ].join("|");
}

export function signQuote(t: QuoteTerms): string {
  if (!SECRET) throw new Error("PROVABLY_FAIR_SECRET is not configured");
  return createHmac("sha256", SECRET).update(canonicalize(t)).digest("hex");
}

export function verifyQuoteSignature(t: QuoteTerms, signature: string): boolean {
  if (!SECRET) return false;
  const expected = signQuote(t);
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(signature, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Reveal check: does the revealed serverSeed match the published commitment? */
export function verifyReveal(serverSeed: string, commitment: string): boolean {
  return commitmentOf(serverSeed) === commitment;
}

/**
 * Replay the outcome from the committed terms + the real forward ticks (strictly
 * after entryEpoch). The heart of the fairness proof — pure, and identical to
 * how settlement decided. Non-vanilla only (fixed payout).
 */
export function verifyOutcome(
  t: Pick<QuoteTerms, "kind" | "side" | "entrySpot" | "barrier" | "durationTicks" | "payoutMultiplier">,
  forwardTicks: { price: number; epoch: number }[],
  stake: number,
): { ready: boolean; won: boolean; credit: number } {
  const params: ResolveParams = {
    kind: t.kind, side: t.side, entrySpot: t.entrySpot, barrier: t.barrier,
    durationTicks: t.durationTicks, stake,
    payout: Number((stake * t.payoutMultiplier).toFixed(2)),
    payoutPerPoint: null,
  };
  const r = resolveContract(params, forwardTicks);
  if (!r.ready) return { ready: false, won: false, credit: 0 };
  return { ready: true, won: r.won, credit: r.credit };
}

/** Build + sign a fresh proof envelope for a placed contract. */
export function buildProof(input: {
  market: string; kind: DirectionalKind; side: DirectionalSide;
  entrySpot: number; entryEpoch: number; barrier: number | null;
  durationTicks: number; payoutMultiplier: number; clientSeed: string; nonce: number;
}): { serverSeed: string; commitment: string; signature: string; terms: QuoteTerms } {
  const serverSeed = newServerSeed();
  const commitment = commitmentOf(serverSeed);
  const terms: QuoteTerms = { ...input, commitment };
  const signature = signQuote(terms);
  return { serverSeed, commitment, signature, terms };
}

export function isProvablyFairConfigured(): boolean {
  return SECRET.length > 0;
}
