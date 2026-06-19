import { describe, expect, it } from "vitest";
import { barrierFracFor, payoutAtTick, replayAccumulator } from "../lib/accumulator";

describe("accumulator contract math", () => {
  it("keeps low-volatility barriers at their calculated fair width", () => {
    // Regression for the live R_10 5% contract that was incorrectly widened
    // to a 0.05% barrier. Its measured sigma requires a 0.00509% band.
    const sigma = 0.000025703806486450255;
    const barrier = barrierFracFor(sigma, 5);

    expect(barrier).toBeCloseTo(0.000050912876117766703, 12);
    expect(barrier).toBeLessThan(0.0005);
  });

  it("caps only abnormally wide barriers", () => {
    expect(barrierFracFor(1, 1)).toBe(0.05);
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
