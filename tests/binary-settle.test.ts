import { describe, expect, it } from "vitest";
import { evaluateTrade, payoutRate } from "@/lib/binary-settle";

// These two functions decide WHETHER a binary trade wins and HOW MUCH it pays —
// the core of the binary money path. A regression here mis-settles real money,
// so the contract is pinned here for every side.

describe("evaluateTrade — win/lose per contract side", () => {
  it("Even wins on even exit digits (0 is even)", () => {
    expect(evaluateTrade("Even", 4, 0)).toBe(true);
    expect(evaluateTrade("Even", 0, 0)).toBe(true);
    expect(evaluateTrade("Even", 3, 0)).toBe(false);
  });

  it("Odd wins on odd exit digits", () => {
    expect(evaluateTrade("Odd", 7, 0)).toBe(true);
    expect(evaluateTrade("Odd", 9, 0)).toBe(true);
    expect(evaluateTrade("Odd", 2, 0)).toBe(false);
  });

  it("Matches/Differs compare against the target digit", () => {
    expect(evaluateTrade("Matches", 5, 5)).toBe(true);
    expect(evaluateTrade("Matches", 4, 5)).toBe(false);
    expect(evaluateTrade("Differs", 4, 5)).toBe(true);
    expect(evaluateTrade("Differs", 5, 5)).toBe(false);
  });

  it("Over/Under are strict; an exit equal to the barrier loses both", () => {
    expect(evaluateTrade("Over", 7, 5)).toBe(true);
    expect(evaluateTrade("Over", 5, 5)).toBe(false);
    expect(evaluateTrade("Over", 3, 5)).toBe(false);
    expect(evaluateTrade("Under", 3, 5)).toBe(true);
    expect(evaluateTrade("Under", 5, 5)).toBe(false);
    expect(evaluateTrade("Under", 7, 5)).toBe(false);
  });
});

describe("payoutRate — multiplier per side", () => {
  it("uses the fixed rates for Matches/Differs/Even/Odd", () => {
    expect(payoutRate("Matches", 5)).toBe(9.15);
    expect(payoutRate("Differs", 5)).toBe(1.05);
    expect(payoutRate("Even", 0)).toBe(1.9);
    expect(payoutRate("Odd", 0)).toBe(1.9);
  });

  it("Over pays more the fewer digits win", () => {
    expect(payoutRate("Over", 0)).toBeCloseTo(1.05, 2); // 9 winning digits
    expect(payoutRate("Over", 5)).toBeCloseTo(2.37, 2); // 4 winning digits
    expect(payoutRate("Over", 8)).toBe(9.5);            // 1 winning digit
  });

  it("Under pays more the smaller the target", () => {
    expect(payoutRate("Under", 1)).toBe(9.5);            // 1 winning digit
    expect(payoutRate("Under", 9)).toBeCloseTo(1.05, 2); // 9 winning digits
  });

  it("never divides by zero on an out-of-range barrier (returns 0)", () => {
    expect(payoutRate("Over", 9)).toBe(0);  // 9 - 9 = 0 winning digits
    expect(payoutRate("Under", 0)).toBe(0); // 0 winning digits
  });
});
