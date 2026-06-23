import { describe, expect, it } from "vitest";
import { nextStake, stopStatus, validateStart, AUTO_MAX_STAKE } from "../lib/auto-trade";

const base = { baseStake: 10, currentStake: 10, multiplier: 2, cyclePnl: 0 };

describe("auto-trader strategy sizing", () => {
  it("FIXED always returns the base stake", () => {
    expect(nextStake("FIXED", { ...base, currentStake: 80 }, false, -80).nextStake).toBe(10);
    expect(nextStake("FIXED", { ...base, currentStake: 80 }, true, 90).nextStake).toBe(10);
  });

  it("MARTINGALE multiplies after a loss, resets after a win", () => {
    expect(nextStake("MARTINGALE", { ...base, currentStake: 10 }, false, -10).nextStake).toBe(20);
    expect(nextStake("MARTINGALE", { ...base, currentStake: 40 }, false, -40).nextStake).toBe(80);
    expect(nextStake("MARTINGALE", { ...base, currentStake: 80 }, true, 75).nextStake).toBe(10);
  });

  it("MARTINGALE is clamped to the max stake", () => {
    expect(nextStake("MARTINGALE", { ...base, currentStake: 9000, multiplier: 5 }, false, -9000).nextStake).toBe(AUTO_MAX_STAKE);
  });

  it("DALEMBERT steps by one unit each way and floors at the min", () => {
    expect(nextStake("DALEMBERT", { ...base, currentStake: 30 }, false, -30).nextStake).toBe(40);
    expect(nextStake("DALEMBERT", { ...base, currentStake: 30 }, true, 27).nextStake).toBe(20);
    // never below AUTO_MIN_STAKE (10)
    expect(nextStake("DALEMBERT", { ...base, currentStake: 10 }, true, 9).nextStake).toBe(10);
  });

  it("OSCARS holds on a loss and resets when the cycle banks a unit", () => {
    // loss → hold stake, accumulate negative cycle P&L
    const afterLoss = nextStake("OSCARS", { ...base, currentStake: 10, cyclePnl: 0 }, false, -10);
    expect(afterLoss.nextStake).toBe(10);
    expect(afterLoss.cyclePnl).toBe(-10);
    // a win that lifts cycle P&L to >= 1 unit resets to base
    const afterRecover = nextStake("OSCARS", { ...base, currentStake: 30, cyclePnl: -10 }, true, 27);
    expect(afterRecover.cyclePnl).toBe(0);
    expect(afterRecover.nextStake).toBe(10);
  });
});

describe("auto-trader stop conditions", () => {
  const c = { takeProfit: 100, stopLoss: 100, maxRuns: 20 };
  it("stops at take-profit", () => expect(stopStatus({ ...c, totalPnl: 100, runsDone: 3 })).toBe("DONE_TP"));
  it("stops at stop-loss", () => expect(stopStatus({ ...c, totalPnl: -100, runsDone: 3 })).toBe("DONE_SL"));
  it("stops at max runs", () => expect(stopStatus({ ...c, totalPnl: 5, runsDone: 20 })).toBe("DONE_RUNS"));
  it("keeps running otherwise", () => expect(stopStatus({ ...c, totalPnl: 5, runsDone: 3 })).toBeNull());
});

describe("auto-trader start validation", () => {
  const ok = { market: "R_100", side: "Even", durationTicks: 5, strategy: "FIXED", baseStake: 10, takeProfit: 100, stopLoss: 100, maxRuns: 20 };
  it("accepts a valid config", () => expect(() => validateStart(ok)).not.toThrow());
  it("requires a stop-loss", () => expect(() => validateStart({ ...ok, stopLoss: 0 })).toThrow(/Stop-loss/));
  it("rejects an unknown market", () => expect(() => validateStart({ ...ok, market: "FOO" })).toThrow(/market/i));
  it("rejects Over 9 (impossible)", () => expect(() => validateStart({ ...ok, side: "Over", targetDigit: 9 })).toThrow());
});
