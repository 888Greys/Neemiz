import { describe, it, expect } from "vitest";
import { makeRng, simulatePath } from "@/lib/binary/fairness";
import { priceDirectionalServer, priceDigitServer, previewDigitPayout, resolveDigitEdgeFloor } from "@/lib/binary/server-price";

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

  it("rejects 1-tick Rise/Fall on 1Hz markets (live RTP leak)", () => {
    const r = priceDirectionalServer({
      kind: "RISE_FALL", side: "RISE", entrySpot: START, barrier: null,
      durationTicks: 1, stake: 100, ticks, market: "1HZ10V",
    });
    expect(r.accepted).toBe(false);
    if (!r.accepted) expect(r.reason).toMatch(/1-tick/i);
  });

  it("still allows 1-tick Rise/Fall on non-1Hz markets", () => {
    const r = priceDirectionalServer({
      kind: "RISE_FALL", side: "RISE", entrySpot: START, barrier: null,
      durationTicks: 1, stake: 100, ticks, market: "R_100",
    });
    expect(r.accepted).toBe(true);
  });

  it("rejects HIGHER_LOWER barriers closer than 0.05% of spot", () => {
    const barrier = START * (1 + 0.0002); // 0.02%
    const r = priceDirectionalServer({
      kind: "HIGHER_LOWER", side: "HIGHER", entrySpot: START, barrier,
      durationTicks: 8, stake: 100, ticks, market: "1HZ10V",
    });
    expect(r.accepted).toBe(false);
    if (!r.accepted) expect(r.reason).toMatch(/too close/i);
  });

  it("accepts HIGHER_LOWER at exactly the 0.05% minimum distance", () => {
    const barrier = START * (1 + 0.0005);
    const r = priceDirectionalServer({
      kind: "HIGHER_LOWER", side: "HIGHER", entrySpot: START, barrier,
      durationTicks: 8, stake: 100, ticks, market: "1HZ25V",
    });
    // May still reject for other reasons (near-certain / thin), but not the distance gate.
    if (!r.accepted) expect(r.reason).not.toMatch(/too close/i);
  });
});

describe("priceDigitServer", () => {
  it("never lets per-symbol calibration lower the digit edge floors", () => {
    expect(resolveDigitEdgeFloor("Even", 0, 0.06)).toBe(0.10);
    expect(resolveDigitEdgeFloor("Matches", 5, 0.06)).toBe(0.15);
    expect(resolveDigitEdgeFloor("Odd", 0, 0.12)).toBe(0.12);
    expect(resolveDigitEdgeFloor("Matches", 5, 0.18)).toBe(0.18);
    expect(resolveDigitEdgeFloor("Under", 5, 0.06)).toBe(0.18);
    expect(resolveDigitEdgeFloor("Under", 4, 0.09)).toBe(0.18);
    expect(resolveDigitEdgeFloor("Under", 3, 0.06)).toBe(0.10);
  });

  it("prices Even/Odd/Matches/Differs contracts with sane payouts", () => {
    // 1. Even
    const rEven = priceDigitServer({ side: "Even", targetDigit: 0, durationTicks: 5, stake: 100, ticks });
    expect(rEven.accepted).toBe(true);
    if (rEven.accepted) expect(rEven.multiplier).toBeCloseTo(1.75, 1);

    // 2. Matches
    const rMatches = priceDigitServer({ side: "Matches", targetDigit: 5, durationTicks: 5, stake: 100, ticks });
    expect(rMatches.accepted).toBe(true);
    if (rMatches.accepted) expect(rMatches.multiplier).toBeGreaterThan(6.0);

    // 3. Differs: high-probability contracts must stay offerable instead of
    // being rejected as priced <= 1x when a symbol calibration edge is supplied.
    const differsEdge = resolveDigitEdgeFloor("Differs", 5, 0.09);
    const rDiffers = priceDigitServer({ side: "Differs", targetDigit: 5, durationTicks: 5, stake: 100, ticks, edgeFloor: differsEdge });
    expect(rDiffers.accepted).toBe(true);
    if (rDiffers.accepted) expect(rDiffers.multiplier).toBeGreaterThan(1);
  });

  it("keeps every digit action button offerable at the default target digit", () => {
    const sides = ["Even", "Odd", "Matches", "Differs", "Over", "Under"] as const;

    for (const side of sides) {
      const edge = resolveDigitEdgeFloor(side, 5, 0.09);
      const result = priceDigitServer({ side, targetDigit: 5, durationTicks: 5, stake: 100, ticks, edgeFloor: edge });
      expect(result, side).toMatchObject({ accepted: true });
    }
  });

  it("previews digit payouts with the same floor-based math as request pricing", () => {
    expect(previewDigitPayout(1000, "Even", 0)).toBe(1800);
    expect(previewDigitPayout(1000, "Matches", 5)).toBe(8500);
    expect(previewDigitPayout(1000, "Differs", 5)).toBe(1080);
    expect(previewDigitPayout(1000, "Over", 5)).toBe(2250);
    // Under 5: winProb 0.5, edge 0.18 → floor((0.82/0.5)*100)/100 = 1.64
    expect(previewDigitPayout(1000, "Under", 5)).toBe(1640);
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
    // A skewed (non-uniform) digit distribution that would trip a stability gate,
    // but where Even is still very winnable (~90%): last digit biased to evens.
    // Even/Odd don't gate, and the contract is winnable, so it must still price.
    // (A degenerate all-odd feed where Even can NEVER win is correctly rejected
    // by the payout-cap guard — that's a different, desirable behaviour.)
    const evenBias = [0, 2, 4, 6, 8, 1, 3, 5, 7, 0]; // 60% even → winnable but below the maxWinProb cap
    const skewedTicks = Array.from({ length: 600 }, (_, i) => Number((100.5 + evenBias[i % evenBias.length] / 100).toFixed(2)));
    const rSkewedEven = priceDigitServer({ side: "Even", targetDigit: 0, durationTicks: 5, stake: 100, ticks: skewedTicks });
    expect(rSkewedEven.accepted).toBe(true);
  });
});
