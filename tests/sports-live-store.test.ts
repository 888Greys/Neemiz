import { describe, expect, it, vi } from "vitest";
import { mergeLivePatch, publishLivePatches, subscribeLivePatch } from "@/lib/sports-live-store";
import type { Match } from "@/lib/theoddsapi";

function baseMatch(over: Partial<Match> = {}): Match {
  return {
    id: 42,
    eventId: "abc",
    sportKey: "soccer_epl",
    league: "EPL",
    country: "England",
    home: { name: "Arsenal", score: 0, logo: "/a.png" },
    away: { name: "Chelsea", score: 0 },
    period: "1H",
    isLive: true,
    startingAt: new Date().toISOString(),
    odds: [{ label: "1", value: "1.90" }],
    extraMarkets: 2,
    ...over,
  };
}

describe("sports-live-store", () => {
  it("merges scores without dropping logos", () => {
    const prev = baseMatch();
    const next = mergeLivePatch(prev, {
      id: 42,
      home: { name: "Arsenal", score: 2 },
      away: { name: "Chelsea", score: 1 },
      period: "2H",
      isLive: true,
      odds: [{ label: "1", value: "1.50" }],
      extraMarkets: 3,
    });
    expect(next.home.score).toBe(2);
    expect(next.away.score).toBe(1);
    expect(next.home.logo).toBe("/a.png");
    expect(next.period).toBe("2H");
    expect(next.odds[0]?.value).toBe("1.50");
  });

  it("delivers patches only to matching subscribers", () => {
    const a = vi.fn();
    const b = vi.fn();
    const unsubA = subscribeLivePatch(1, a);
    const unsubB = subscribeLivePatch(2, b);
    publishLivePatches([
      {
        id: 1,
        home: { name: "A", score: 1 },
        away: { name: "B", score: 0 },
        period: "1H",
        isLive: true,
        odds: [],
        extraMarkets: 0,
      },
    ]);
    expect(a).toHaveBeenCalledOnce();
    expect(b).not.toHaveBeenCalled();
    unsubA();
    unsubB();
  });
});
