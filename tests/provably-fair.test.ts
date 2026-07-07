import { describe, it, expect } from "vitest";
import {
  buildProof, verifyQuoteSignature, verifyReveal, commitmentOf, verifyOutcome, canonicalize,
  type QuoteTerms,
} from "@/lib/binary/provably-fair";

const base = {
  market: "R_100", kind: "RISE_FALL" as const, side: "RISE" as const,
  entrySpot: 1000, entryEpoch: 1_700_000_000, barrier: null,
  durationTicks: 5, payoutMultiplier: 1.85, clientSeed: "player-seed", nonce: 42,
};

describe("provably-fair", () => {
  it("commits, signs, and verifies a quote round-trip", () => {
    const p = buildProof(base);
    expect(p.commitment).toBe(commitmentOf(p.serverSeed));
    expect(verifyReveal(p.serverSeed, p.commitment)).toBe(true);
    expect(verifyQuoteSignature(p.terms, p.signature)).toBe(true);
  });

  it("detects a tampered term (payoutMultiplier bumped after signing)", () => {
    const p = buildProof(base);
    const tampered: QuoteTerms = { ...p.terms, payoutMultiplier: 99 };
    expect(verifyQuoteSignature(tampered, p.signature)).toBe(false);
  });

  it("detects a wrong revealed seed", () => {
    const p = buildProof(base);
    expect(verifyReveal("deadbeef", p.commitment)).toBe(false);
  });

  it("replays a RISE win from forward ticks", () => {
    // exit (5th tick) above entry ⇒ RISE wins
    const ticks = [1001, 1002, 1003, 1004, 1005].map((price, k) => ({ price, epoch: base.entryEpoch + k + 1 }));
    const r = verifyOutcome(base, ticks, 100);
    expect(r.ready).toBe(true);
    expect(r.won).toBe(true);
    expect(r.credit).toBeCloseTo(185, 2); // 100 * 1.85
  });

  it("replays a RISE loss when exit is below entry", () => {
    const ticks = [999, 998, 997, 996, 995].map((price, k) => ({ price, epoch: base.entryEpoch + k + 1 }));
    const r = verifyOutcome(base, ticks, 100);
    expect(r.won).toBe(false);
    expect(r.credit).toBe(0);
  });

  it("canonicalize is deterministic and term-sensitive", () => {
    const p = buildProof(base);
    expect(canonicalize(p.terms)).toBe(canonicalize({ ...p.terms }));
    expect(canonicalize(p.terms)).not.toBe(canonicalize({ ...p.terms, side: "FALL" }));
  });

  it("stake metadata can publish proof fields without revealing the server seed", () => {
    const p = buildProof(base);
    const stakeMetadata = {
      pf: {
        commitment: p.commitment,
        signature: p.signature,
        clientSeed: p.terms.clientSeed,
        nonce: p.terms.nonce,
        payoutMultiplier: p.terms.payoutMultiplier,
      },
    };
    expect(stakeMetadata.pf).not.toHaveProperty("serverSeed");
    expect(verifyReveal(p.serverSeed, stakeMetadata.pf.commitment)).toBe(true);
  });
});
