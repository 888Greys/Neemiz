import { describe, it, expect } from "vitest";
import { makeRng, simulatePath } from "@/lib/binary/fairness";
import { priceDirectionalServer } from "@/lib/binary/server-price";

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
