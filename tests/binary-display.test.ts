import { describe, expect, it } from "vitest";
import {
  returnPct,
  formatPayoutWithReturn,
  digitWinCondition,
  directionalWinCondition,
  digitInterimStatus,
  directionalInterimStatus,
} from "@/lib/binary/display";

const money = (n: number) => `$${n.toFixed(2)}`;

describe("returnPct / formatPayoutWithReturn", () => {
  it("computes (payout - stake) / stake * 100", () => {
    expect(returnPct(17.2, 10)).toBe(72);
    expect(returnPct(12.4, 6.666)).toBe(86);
    expect(returnPct(10, 10)).toBe(0);
    expect(returnPct(0, 10)).toBe(-100);
  });

  it("returns null for invalid stake", () => {
    expect(returnPct(10, 0)).toBeNull();
    expect(returnPct(10, -1)).toBeNull();
  });

  it("formats absolute payout with return %", () => {
    expect(formatPayoutWithReturn(money, 17.2, 10)).toBe("$17.20 · +72%");
    expect(formatPayoutWithReturn(money, 17.2, 10, { prefix: "Payout" })).toBe("Payout $17.20 · +72%");
    expect(formatPayoutWithReturn(money, 500, 10, { prefix: "max" })).toBe("max $500.00 · +4900%");
  });
});

describe("win-condition copy", () => {
  it("digit sides", () => {
    expect(digitWinCondition("evenOdd", "Even", 0)).toMatch(/even/i);
    expect(digitWinCondition("evenOdd", "Odd", 0)).toMatch(/odd/i);
    expect(digitWinCondition("matchDiffer", "Matches", 7)).toContain("7");
    expect(digitWinCondition("matchDiffer", "Differs", 7)).toMatch(/not 7/);
    expect(digitWinCondition("overUnder", "Over", 5)).toMatch(/over 5/i);
    expect(digitWinCondition("overUnder", "Under", 5)).toMatch(/under 5/i);
  });

  it("directional / touch / vanilla", () => {
    expect(directionalWinCondition("RISE_FALL", "RISE")).toMatch(/above your entry/i);
    expect(directionalWinCondition("RISE_FALL", "FALL")).toMatch(/below your entry/i);
    expect(directionalWinCondition("HIGHER_LOWER", "HIGHER")).toMatch(/above the barrier/i);
    expect(directionalWinCondition("TOUCH_NO_TOUCH", "TOUCH")).toMatch(/touches the barrier/i);
    expect(directionalWinCondition("TOUCH_NO_TOUCH", "NO_TOUCH")).toMatch(/never touches/i);
    expect(directionalWinCondition("VANILLA", "CALL")).toMatch(/past your strike/i);
  });
});

describe("interim status", () => {
  it("digit winning / losing / settling", () => {
    expect(digitInterimStatus({ side: "Even", targetDigit: 0, liveDigit: 4, settlesAt: 9e15 })).toBe("winning");
    expect(digitInterimStatus({ side: "Even", targetDigit: 0, liveDigit: 3, settlesAt: 9e15 })).toBe("losing");
    expect(digitInterimStatus({ side: "Matches", targetDigit: 5, liveDigit: 5, settlesAt: 1, now: 2 })).toBe("settling");
  });

  it("rise/fall and touch interim", () => {
    expect(
      directionalInterimStatus({
        kind: "RISE_FALL", side: "RISE", entrySpot: 100, barrier: null,
        liveSpot: 101, settlesAt: 9e15,
      }),
    ).toBe("winning");
    expect(
      directionalInterimStatus({
        kind: "TOUCH_NO_TOUCH", side: "TOUCH", entrySpot: 100, barrier: 102,
        liveSpot: 101, pathSpots: [100.5, 101], settlesAt: 9e15,
      }),
    ).toBe("losing");
    expect(
      directionalInterimStatus({
        kind: "TOUCH_NO_TOUCH", side: "NO_TOUCH", entrySpot: 100, barrier: 102,
        liveSpot: 101, pathSpots: [100.5, 101], settlesAt: 9e15,
      }),
    ).toBe("winning");
    expect(
      directionalInterimStatus({
        kind: "TOUCH_NO_TOUCH", side: "TOUCH", entrySpot: 100, barrier: 102,
        liveSpot: 103, pathSpots: [100.5, 103], settlesAt: 9e15,
      }),
    ).toBe("winning");
  });
});
