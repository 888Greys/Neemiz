import { describe, it, expect } from "vitest";
import { makeRng, simulatePath } from "@/lib/binary/fairness";
import { priceDirectionalServer, priceDigitServer } from "@/lib/binary/server-price";

// The request-path pricing helper: turns a contract + real tick window into a
// stored payout via the engine. Ticks are injected, so no feed is needed.

const SIGMA = 0.002;
const START = 1000;
const ticks = simulatePath(makeRng(3), { start: START, sigmaTick: SIGMA, steps: 20_000 }).map((t) => t.price);

describe("priceDirectionalServer", () => {
  it("prices a Rise contract with a sane, >1× payout", () => {
    const r = priceDirectionalServer({ kind: "RISE_FALL", side: "RISE", entrySpot: START, barrier: null, durationTicks: 8, stake: 100, ticks });
    expect(r.accepted).toBe(true);
    if (r.accepted) {
      expect(r.multiplier).toBeGreaterThan(1);
      expect(r.payout).toBeCloseTo(100 * r.multiplier, 2);
    }
  });

  it("prices a near-the-money NO_TOUCH (the old exploit) and stays finite", () => {
    const barrier = START * (1 + 0.5 * SIGMA * Math.sqrt(8));
    const r = priceDirectionalServer({ kind: "TOUCH_NO_TOUCH", side: "NO_TOUCH", entrySpot: START, barrier, durationTicks: 8, stake: 100, ticks });
    expect(r.accepted).toBe(true);
    if (r.accepted) expect(r.multiplier).toBeLessThan(50);
  });

  it("rejects a deep-in-the-money (near-certain) barrier", () => {
    // LOWER barrier far above spot ⇒ exit almost always below ⇒ ~certain win.
    const barrier = START * (1 + 8 * SIGMA * Math.sqrt(8));
    const r = priceDirectionalServer({ kind: "HIGHER_LOWER", side: "LOWER", entrySpot: START, barrier, durationTicks: 8, stake: 100, ticks });
    expect(r.accepted).toBe(false);
  });

  it("rejects on thin market data", () => {
    const r = priceDirectionalServer({ kind: "RISE_FALL", side: "RISE", entrySpot: START, barrier: null, durationTicks: 8, stake: 100, ticks: ticks.slice(0, 100) });
    expect(r.accepted).toBe(false);
  });
});

describe("priceDigitServer", () => {
  it("prices Even/Odd/Matches/Differs contracts with sane payouts", () => {
    // 1. Even
    const rEven = priceDigitServer({ side: "Even", targetDigit: 0, durationTicks: 5, stake: 100, ticks });
    expect(rEven.accepted).toBe(true);
    if (rEven.accepted) expect(rEven.multiplier).toBeCloseTo(1.75, 1);

    // 2. Matches
    const rMatches = priceDigitServer({ side: "Matches", targetDigit: 5, durationTicks: 5, stake: 100, ticks });
    expect(rMatches.accepted).toBe(true);
    if (rMatches.accepted) expect(rMatches.multiplier).toBeGreaterThan(6.0);
  });

  it("rejects Matches when the digit distribution is highly skewed (stability gate)", () => {
    // Create highly skewed ticks where exit digits are always 5 (e.g. quote ends in .55555)
    const skewedTicks = Array.from({ length: 600 }, (_, i) => 100.55);
    
    // Target digit 5 has frequency 100% (unstable, > 13%)
    const rSkewedMatches = priceDigitServer({ side: "Matches", targetDigit: 5, durationTicks: 5, stake: 100, ticks: skewedTicks });
    expect(rSkewedMatches.accepted).toBe(false);
    if (!rSkewedMatches.accepted) {
      expect(rSkewedMatches.reason).toContain("digit distribution unstable");
    }

    // Target digit 0 has frequency 0% (unstable, < 7%)
    const rSkewedMatchesZero = priceDigitServer({ side: "Matches", targetDigit: 0, durationTicks: 5, stake: 100, ticks: skewedTicks });
    expect(rSkewedMatchesZero.accepted).toBe(false);
    if (!rSkewedMatchesZero.accepted) {
      expect(rSkewedMatchesZero.reason).toContain("digit distribution unstable");
    }
  });

  it("still allows Even/Odd on skewed ticks since they do not check digit stability", () => {
    const skewedTicks = Array.from({ length: 600 }, (_, i) => 100.55);
    const rSkewedEven = priceDigitServer({ side: "Even", targetDigit: 0, durationTicks: 5, stake: 100, ticks: skewedTicks });
    expect(rSkewedEven.accepted).toBe(true);
  });
});
