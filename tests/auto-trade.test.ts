import { describe, expect, it } from "vitest";
import {
  nextStake, stopStatus, validateStart, AUTO_MAX_STAKE, AUTO_MIN_STAKE,
} from "../lib/auto-trade";

const base = {
  baseStake: AUTO_MIN_STAKE,
  currentStake: AUTO_MIN_STAKE,
  multiplier: 2,
  cyclePnl: 0,
};

describe("auto-trader strategy sizing", () => {
  it("FIXED always returns the base stake", () => {
    expect(nextStake("FIXED", { ...base, currentStake: AUTO_MIN_STAKE * 8 }, false, -AUTO_MIN_STAKE * 8).nextStake).toBe(AUTO_MIN_STAKE);
    expect(nextStake("FIXED", { ...base, currentStake: AUTO_MIN_STAKE * 8 }, true, AUTO_MIN_STAKE * 9).nextStake).toBe(AUTO_MIN_STAKE);
  });

  it("MARTINGALE multiplies after a loss, resets after a win", () => {
    expect(nextStake("MARTINGALE", { ...base, currentStake: AUTO_MIN_STAKE }, false, -AUTO_MIN_STAKE).nextStake).toBe(AUTO_MIN_STAKE * 2);
    expect(nextStake("MARTINGALE", { ...base, currentStake: AUTO_MIN_STAKE * 4 }, false, -AUTO_MIN_STAKE * 4).nextStake).toBe(AUTO_MIN_STAKE * 8);
    expect(nextStake("MARTINGALE", { ...base, currentStake: AUTO_MIN_STAKE * 8 }, true, AUTO_MIN_STAKE * 7).nextStake).toBe(AUTO_MIN_STAKE);
  });

  it("MARTINGALE is clamped to the max stake", () => {
    expect(nextStake("MARTINGALE", { ...base, currentStake: AUTO_MAX_STAKE - 1000, multiplier: 5 }, false, -(AUTO_MAX_STAKE - 1000)).nextStake).toBe(AUTO_MAX_STAKE);
  });

  it("DALEMBERT steps by one unit each way and floors at the min", () => {
    expect(nextStake("DALEMBERT", { ...base, currentStake: AUTO_MIN_STAKE * 3 }, false, -AUTO_MIN_STAKE * 3).nextStake).toBe(AUTO_MIN_STAKE * 4);
    expect(nextStake("DALEMBERT", { ...base, currentStake: AUTO_MIN_STAKE * 3 }, true, AUTO_MIN_STAKE * 2).nextStake).toBe(AUTO_MIN_STAKE * 2);
    // never below AUTO_MIN_STAKE (~$1)
    expect(nextStake("DALEMBERT", { ...base, currentStake: AUTO_MIN_STAKE }, true, AUTO_MIN_STAKE - 1).nextStake).toBe(AUTO_MIN_STAKE);
  });

  it("OSCARS holds on a loss and resets when the cycle banks a unit", () => {
    const afterLoss = nextStake("OSCARS", { ...base, currentStake: AUTO_MIN_STAKE, cyclePnl: 0 }, false, -AUTO_MIN_STAKE);
    expect(afterLoss.nextStake).toBe(AUTO_MIN_STAKE);
    expect(afterLoss.cyclePnl).toBe(-AUTO_MIN_STAKE);
    const afterRecover = nextStake(
      "OSCARS",
      { ...base, currentStake: AUTO_MIN_STAKE * 3, cyclePnl: -AUTO_MIN_STAKE },
      true,
      AUTO_MIN_STAKE * 2.7,
    );
    expect(afterRecover.cyclePnl).toBe(0);
    expect(afterRecover.nextStake).toBe(AUTO_MIN_STAKE);
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
  const ok = {
    market: "R_100",
    side: "Even",
    durationTicks: 5,
    strategy: "FIXED",
    baseStake: AUTO_MIN_STAKE,
    takeProfit: AUTO_MIN_STAKE,
    stopLoss: AUTO_MIN_STAKE,
    maxRuns: 20,
  };
  it("accepts a valid config", () => expect(() => validateStart(ok)).not.toThrow());
  it("requires a stop-loss", () => expect(() => validateStart({ ...ok, stopLoss: 0 })).toThrow(/Stop-loss/));
  it("rejects an unknown market", () => expect(() => validateStart({ ...ok, market: "FOO" })).toThrow(/market/i));
  it("rejects Over 9 (impossible)", () => expect(() => validateStart({ ...ok, side: "Over", targetDigit: 9 })).toThrow());
  it("rejects stake below $1 floor", () => expect(() => validateStart({ ...ok, baseStake: 10 })).toThrow(/Base stake/));
});
