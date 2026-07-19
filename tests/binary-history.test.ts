import { describe, expect, it } from "vitest";
import {
  applyServerBinaryDigits,
  closedDisplayStatus,
  mergeClosedPositions,
  toAccumulatorClosedPosition,
  toBinaryClosedPosition,
  toDirectionalClosedPosition,
  toLeveragedClosedPosition,
} from "@/lib/binary/history";

describe("binary closed-position history", () => {
  it("merges all binary product families and shows the newest settled trade first", () => {
    const positions = mergeClosedPositions([
      toBinaryClosedPosition({
        id: "digit-old",
        market: "1HZ10V",
        side: "Even",
        stake: 10,
        payout: 19,
        entryDigit: 4,
        exitDigit: 8,
        status: "WON",
        createdAt: "2026-07-07T08:00:00.000Z",
        settledAt: "2026-07-07T08:00:10.000Z",
      }),
      toDirectionalClosedPosition({
        id: "dir-new",
        market: "1HZ10V",
        kind: "RISE_FALL",
        side: "RISE",
        stake: 10,
        payout: 18,
        status: "WON",
        durationTicks: 5,
        createdAt: "2026-07-07T08:03:00.000Z",
        settledAt: "2026-07-07T08:03:05.000Z",
      }),
      toAccumulatorClosedPosition({
        id: "acca-mid",
        market: "1HZ10V",
        growthRate: 3,
        stake: 10,
        payout: 11.2,
        status: "CLOSED",
        ticksSurvived: 4,
        createdAt: "2026-07-07T08:01:00.000Z",
        settledAt: "2026-07-07T08:01:04.000Z",
      }),
      toLeveragedClosedPosition({
        id: "lev-loss",
        market: "1HZ10V",
        kind: "TURBO",
        direction: "DOWN",
        stake: 10,
        payout: 0,
        status: "CLOSED",
        createdAt: "2026-07-07T08:02:00.000Z",
        settledAt: "2026-07-07T08:02:04.000Z",
      }),
    ]);

    expect(positions.map((p) => p.id)).toEqual(["dir-new", "lev-loss", "acca-mid", "digit-old"]);
    expect(positions[0].title).toBe("RISE");
    expect(positions[1].status).toBe("lost");
  });

  it("deduplicates session and persisted rows by id while keeping newest ordering", () => {
    const persisted = toBinaryClosedPosition({
      id: "same",
      market: "1HZ10V",
      side: "Odd",
      stake: 20,
      payout: 38,
      entryDigit: 7,
      exitDigit: 2,
      status: "LOST",
      createdAt: "2026-07-07T08:00:00.000Z",
      settledAt: "2026-07-07T08:00:10.000Z",
    });
    const session = { ...persisted, status: "won" as const, payout: 38, closedAt: Date.parse("2026-07-07T08:00:20.000Z") };

    const positions = mergeClosedPositions([session], [persisted]);

    expect(positions).toHaveLength(1);
    expect(positions[0].status).toBe("won");
  });

  it("prefers server entry/exit digits over optimistic client feed digits", () => {
    // Live QA: client lastDigit was 0 at render; DB entry_digit was 4.
    const optimistic = {
      id: "cmrrgzr9g0001n70f5vey5vkg",
      market: "1HZ10V",
      side: "Odd" as const,
      stake: 10,
      payout: 19,
      entryDigit: 0,
      targetDigit: 0,
      exitDigit: undefined as number | undefined,
      status: "open" as const,
    };

    const afterPlace = applyServerBinaryDigits(optimistic, { entryDigit: 4 });
    expect(afterPlace.entryDigit).toBe(4);

    const afterSettle = applyServerBinaryDigits(
      { ...afterPlace, status: "lost" as const },
      { entryDigit: 4, exitDigit: 4 },
    );
    expect(afterSettle.entryDigit).toBe(4);
    expect(afterSettle.exitDigit).toBe(4);

    const closed = toBinaryClosedPosition({
      ...afterSettle,
      status: "LOST",
      createdAt: "2026-07-19T07:00:00.000Z",
      settledAt: "2026-07-19T07:00:05.000Z",
    });
    expect(closed.subtitle).toBe("1HZ10V · digit 4 → 4");
  });

  it("labels Vanilla partial ITM credit as partial (not full-stake LOST)", () => {
    // Live QA: PUT stake 1294, credit 1191.97, DB status LOST (won = credit >= stake).
    expect(closedDisplayStatus(1294, 1191.97)).toBe("partial");
    expect(closedDisplayStatus(1294, 0)).toBe("lost");
    expect(closedDisplayStatus(1294, 1294)).toBe("won");
    expect(closedDisplayStatus(1294, 1500)).toBe("won");

    const row = toDirectionalClosedPosition({
      id: "vanilla-partial",
      market: "1HZ10V",
      kind: "VANILLA",
      side: "PUT",
      stake: 1294,
      payout: 1191.97,
      status: "LOST",
      durationTicks: 5,
      createdAt: "2026-07-19T07:00:00.000Z",
      settledAt: "2026-07-19T07:00:05.000Z",
    });
    expect(row.status).toBe("partial");
    expect(row.payout - row.stake).toBeCloseTo(-102.03, 2);
  });

  it("does not treat digit place-time payout on LOST as a win", () => {
    const lost = toBinaryClosedPosition({
      id: "digit-lost",
      market: "1HZ10V",
      side: "Even",
      stake: 10,
      payout: 19,
      entryDigit: 4,
      exitDigit: 5,
      status: "LOST",
      createdAt: "2026-07-19T07:00:00.000Z",
      settledAt: "2026-07-19T07:00:05.000Z",
    });
    expect(lost.status).toBe("lost");
  });
});
