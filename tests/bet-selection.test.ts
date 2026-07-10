import { describe, it, expect } from "vitest";
import { canonicalMarketName, findCachedMarket, findCachedOdd } from "@/lib/bet-selection";
import type { BettingMarket, Match } from "@/lib/theoddsapi";

const match = {
  home: { name: "Spain", score: null },
  away: { name: "Belgium", score: null },
} as Pick<Match, "home" | "away">;

const markets: BettingMarket[] = [
  {
    id: 1,
    name: "Full Time Result",
    odds: [
      { label: "1", value: "1.69" },
      { label: "X", value: "4.00" },
      { label: "2", value: "6.00" },
    ],
  },
  {
    id: 3,
    name: "Over/Under",
    odds: [
      { label: "Over", value: "1.85", extra: "2.5" },
      { label: "Under", value: "2.14", extra: "2.5" },
    ],
  },
  {
    id: 101,
    name: "Double Chance",
    odds: [
      { label: "1 OR X", value: "1.20" },
      { label: "X OR 2", value: "2.42" },
      { label: "1 OR 2", value: "1.33" },
    ],
  },
];

describe("bet-selection aliases", () => {
  it("maps list '3 Way' to Full Time Result", () => {
    expect(canonicalMarketName("3 Way")).toBe("Full Time Result");
    expect(findCachedMarket(markets, "3 Way")?.name).toBe("Full Time Result");
    expect(canonicalMarketName("BTTS")).toBe("Both Teams To Score");
  });

  it("maps team-name labels to 1/X/2", () => {
    const m = findCachedMarket(markets, "3 Way")!;
    expect(findCachedOdd(m, "Spain", match)?.label).toBe("1");
    expect(findCachedOdd(m, "DRAW", match)?.label).toBe("X");
    expect(findCachedOdd(m, "Belgium", match)?.label).toBe("2");
    expect(findCachedOdd(m, "1", match)?.value).toBe("1.69");
  });

  it("maps OVER 2.5 list labels onto totals", () => {
    const m = findCachedMarket(markets, "Over/Under")!;
    expect(findCachedOdd(m, "OVER 2.5", match)?.value).toBe("1.85");
    expect(findCachedOdd(m, "UNDER 2.5", match)?.value).toBe("2.14");
  });
});
