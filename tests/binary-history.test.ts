import { describe, expect, it } from "vitest";
import {
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
});
