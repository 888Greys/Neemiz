import { describe, expect, it } from "vitest";
import {
  ACCUMULATOR_PROFIT_RETENTION,
  BARRIER_HAIRCUT,
  barrierFracFor,
  maxTicksFor,
  payoutAtTick,
  replayAccumulator,
  zForGrowth,
} from "../lib/accumulator";

describe("accumulator contract math", () => {
  it("sells barriers at the fair width × haircut (not a widened floor)", () => {
    // Regression: never re-introduce a fixed 0.05% floor (that minted RTP ~4–5×).
    // Offer width = σ·z(g)·BARRIER_HAIRCUT.
    const sigma = 0.000025703806486450255;
    const fair = sigma * zForGrowth(5);
    const barrier = barrierFracFor(sigma, 5);

    expect(barrier).toBeCloseTo(fair * BARRIER_HAIRCUT, 12);
    expect(barrier).toBeLessThan(fair);
    expect(barrier).toBeLessThan(0.0005);
  });

  it("caps only abnormally wide barriers", () => {
    expect(barrierFracFor(1, 1)).toBe(0.05);
  });

  it("bounds liability with shorter max-tick caps and 50% Acca retention", () => {
    expect(maxTicksFor(5)).toBe(20);
    expect(maxTicksFor(1)).toBe(80);
    expect(ACCUMULATOR_PROFIT_RETENTION).toBe(0.50);
    expect(BARRIER_HAIRCUT).toBe(0.70);
  });

  it("busts on the first barrier breach", () => {
    const result = replayAccumulator({
      entrySpot: 100,
      growthRate: 5,
      barrierFrac: 0.01,
      maxTicks: 50,
      stake: 100,
      ticks: [
        { price: 100.5, epoch: 1 },
        { price: 102, epoch: 2 },
      ],
    });

    expect(result).toMatchObject({
      kind: "BUSTED",
      reason: "breach",
      ticksSurvived: 1,
      payout: 0,
    });
  });

  it("closes at the tick cap with the compounded payout", () => {
    const result = replayAccumulator({
      entrySpot: 100,
      growthRate: 5,
      barrierFrac: 0.01,
      maxTicks: 2,
      stake: 100,
      ticks: [
        { price: 100.5, epoch: 1 },
        { price: 100.6, epoch: 2 },
      ],
    });

    expect(result).toMatchObject({
      kind: "CLOSED",
      reason: "max_ticks",
      ticksSurvived: 2,
    });
    expect(result.payout).toBeCloseTo(payoutAtTick(100, 5, 2), 12);
  });
});
