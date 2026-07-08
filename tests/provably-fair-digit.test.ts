import { describe, it, expect } from "vitest";
import {
  buildDigitProof,
  verifyDigitQuoteSignature,
  verifyReveal,
  commitmentOf,
  verifyDigitOutcome,
  canonicalizeDigit,
  type DigitQuoteTerms,
} from "@/lib/binary/provably-fair";

const base = {
  market: "R_100", side: "Even" as const, targetDigit: 0,
  entryEpoch: 1_700_000_000, durationTicks: 5,
  payoutMultiplier: 1.9, clientSeed: "player-seed", nonce: 42,
};

// Integer prices → last digit 0 (even), so outcomes are deterministic and FP-safe.
const forward = (offset0: number[]) =>
  offset0.map((price, k) => ({ price, epoch: base.entryEpoch + k + 1 }));

describe("provably-fair (digit contracts)", () => {
  it("commits, signs, and verifies a quote round-trip", () => {
    const p = buildDigitProof(base);
    expect(p.commitment).toBe(commitmentOf(p.serverSeed));
    expect(verifyReveal(p.serverSeed, p.commitment)).toBe(true);
    expect(verifyDigitQuoteSignature(p.terms, p.signature)).toBe(true);
  });

  it("detects a tampered term (targetDigit changed after signing)", () => {
    const p = buildDigitProof(base);
    const tampered: DigitQuoteTerms = { ...p.terms, targetDigit: 7 };
    expect(verifyDigitQuoteSignature(tampered, p.signature)).toBe(false);
  });

  it("detects a wrong revealed seed", () => {
    const p = buildDigitProof(base);
    expect(verifyReveal("deadbeef", p.commitment)).toBe(false);
  });

  it("replays an Even win on the committed exit tick", () => {
    // 5 forward ticks; the 5th (exit) is integer → digit 0 → Even wins.
    const r = verifyDigitOutcome(base, forward([11, 22, 33, 44, 50]), 100);
    expect(r.ready).toBe(true);
    expect(r.won).toBe(true);
    expect(r.exitDigit).toBe(0);
    expect(r.credit).toBeCloseTo(190, 2); // 100 * 1.9
  });

  it("replays an Odd loss on the same committed tick", () => {
    const r = verifyDigitOutcome({ ...base, side: "Odd" }, forward([11, 22, 33, 44, 50]), 100);
    expect(r.won).toBe(false);
    expect(r.credit).toBe(0);
  });

  it("replays on the committed exit tick, not the latest streamed tick", () => {
    // Exit is the 5th tick (digit 0, Even wins). A 6th 'latest' odd-digit tick
    // must not change the outcome — settlement is anchored to the exit tick.
    const ticks = [...forward([11, 22, 33, 44, 50]), { price: 77.7, epoch: base.entryEpoch + 6 }];
    const r = verifyDigitOutcome(base, ticks, 100);
    expect(r.won).toBe(true);
    expect(r.exitDigit).toBe(0);
  });

  it("stays pending until the exit tick exists", () => {
    const r = verifyDigitOutcome(base, forward([11, 22]), 100);
    expect(r.ready).toBe(false);
    expect(r.credit).toBe(0);
  });

  it("canonicalize is deterministic and term-sensitive", () => {
    const p = buildDigitProof(base);
    expect(canonicalizeDigit(p.terms)).toBe(canonicalizeDigit({ ...p.terms }));
    expect(canonicalizeDigit(p.terms)).not.toBe(canonicalizeDigit({ ...p.terms, side: "Odd" }));
  });
});
