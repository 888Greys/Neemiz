import { describe, it, expect } from "vitest";
import {
  payoutRate,
  contractWinProb,
  higherLowerWinProb,
  touchProbability,
  evaluateDirectional,
  resolveContract,
  vanillaPayoutPerPoint,
  MAX_WIN_PROB,
  DIRECTIONAL_GROSS_EDGE,
  type ResolveParams,
} from "@/lib/directional";

// ─────────────────────────────────────────────────────────────────────────────
// Regression suite for the deep-in-the-money "guaranteed win" exploit (PR #143,
// see memory neemiz-directional-exploit). The exploit paid a near-certain
// LOWER/NO_TOUCH barrier ≥1.01x because rateFromProb clamped the win prob to
// 0.95 and floored the rate at 1.01 — minting risk-free +EV. These tests pin
// the two invariants that killed it:
//   (1) E[payout] ≤ (1 − edge)·stake for EVERY win probability (house never −EV)
//   (2) contracts the player can make near-certain are rejected at placement
// ─────────────────────────────────────────────────────────────────────────────

const STAKE = 100;

// A dense sweep of Higher/Lower barriers from deep OTM to deep ITM.
function sweepHigherLower() {
  const cases: { p: number; rate: number }[] = [];
  const entrySpot = 1000;
  const sigmaTick = 0.002;
  const durationTicks = 20;
  for (const barrier of [700, 850, 950, 990, 999, 1000, 1001, 1010, 1050, 1150, 1300]) {
    for (const side of ["HIGHER", "LOWER"] as const) {
      const p = higherLowerWinProb({ entrySpot, barrier, side, sigmaTick, durationTicks });
      const rate = payoutRate({ kind: "HIGHER_LOWER", side, entrySpot, barrier, sigmaTick, durationTicks });
      cases.push({ p, rate });
    }
  }
  return cases;
}

describe("directional pricing — house edge is preserved at every probability", () => {
  it("Higher/Lower: E[payout] never exceeds (1 - edge)·stake, even deep ITM", () => {
    for (const { p, rate } of sweepHigherLower()) {
      // rate is the gross multiplier on stake; net expected return to the player.
      const expectedPayout = p * rate * STAKE;
      // The whole point of the exploit: at p→1 the payout must stay ≤ 0.95·stake.
      expect(expectedPayout).toBeLessThanOrEqual((1 - DIRECTIONAL_GROSS_EDGE) * STAKE + 1e-6);
    }
  });

  it("Touch/No-Touch: E[payout] never exceeds (1 - edge)·stake", () => {
    const entrySpot = 1000;
    const sigmaTick = 0.003;
    const durationTicks = 30;
    for (const barrier of [800, 950, 995, 1005, 1050, 1200]) {
      for (const side of ["TOUCH", "NO_TOUCH"] as const) {
        const pt = touchProbability(entrySpot, barrier, sigmaTick, durationTicks);
        const p = side === "TOUCH" ? pt : 1 - pt;
        const rate = payoutRate({ kind: "TOUCH_NO_TOUCH", side, entrySpot, barrier, sigmaTick, durationTicks });
        expect(p * rate * STAKE).toBeLessThanOrEqual((1 - DIRECTIONAL_GROSS_EDGE) * STAKE + 1e-6);
      }
    }
  });

  it("a near-certain deep-ITM barrier priced BELOW 1x (the fix), never ≥1.01x", () => {
    // LOWER with a barrier far above entry is near-certain to win.
    const rate = payoutRate({
      kind: "HIGHER_LOWER", side: "LOWER",
      entrySpot: 1000, barrier: 1300, sigmaTick: 0.002, durationTicks: 20,
    });
    const p = higherLowerWinProb({ entrySpot: 1000, barrier: 1300, side: "LOWER", sigmaTick: 0.002, durationTicks: 20 });
    expect(p).toBeGreaterThan(0.95);      // genuinely near-certain
    expect(rate).toBeLessThan(1.0);       // and therefore priced below stake
  });
});

describe("directional placement — near-certain contracts are rejected", () => {
  it("contractWinProb flags a deep-ITM barrier above MAX_WIN_PROB", () => {
    const p = contractWinProb({
      kind: "HIGHER_LOWER", side: "LOWER",
      entrySpot: 1000, barrier: 1300, sigmaTick: 0.002, durationTicks: 20,
    });
    expect(p).toBeGreaterThan(MAX_WIN_PROB); // bet route rejects these
  });

  it("a NON-POSITIVE barrier is treated as certain-win and rejected (negative-offset exploit)", () => {
    // The live exploit: a large negative barrierOffset pushed entrySpot+offset
    // below zero (e.g. 9739 + (-9800) = -61). A negative barrier made settlement
    // `exitSpot > barrier` always true, yet the old 0.5 fallback priced it as a
    // coin flip and let it through the gate. Both a negative and a zero barrier
    // must now flag as near-certain so the bet route rejects them.
    for (const barrier of [-60.45, 0]) {
      const p = contractWinProb({
        kind: "HIGHER_LOWER", side: "HIGHER",
        entrySpot: 9739.55, barrier, sigmaTick: 0.002, durationTicks: 1,
      });
      expect(p).toBeGreaterThan(MAX_WIN_PROB);
    }
    // The underlying prob helper is house-safe (certain win) on an invalid barrier.
    expect(higherLowerWinProb({ entrySpot: 9739.55, barrier: -60.45, side: "HIGHER", sigmaTick: 0.002, durationTicks: 1 })).toBe(1);
  });

  it("a balanced Rise/Fall stays a coin flip and is accepted", () => {
    const p = contractWinProb({
      kind: "RISE_FALL", side: "RISE",
      entrySpot: 1000, barrier: null, sigmaTick: 0.002, durationTicks: 20,
    });
    expect(p).toBe(0.5);
    expect(p).toBeLessThanOrEqual(MAX_WIN_PROB);
  });
});

describe("directional settlement — evaluate + resolve", () => {
  it("a tie (exit == entry / barrier) is a LOSS, not a refund", () => {
    expect(evaluateDirectional({ kind: "RISE_FALL", side: "RISE", entrySpot: 1000, exitSpot: 1000 })).toBe(false);
    expect(evaluateDirectional({ kind: "HIGHER_LOWER", side: "HIGHER", entrySpot: 1000, exitSpot: 1000, barrier: 1000 })).toBe(false);
  });

  it("resolveContract returns not-ready until the duration tick exists", () => {
    const p: ResolveParams = {
      kind: "RISE_FALL", side: "RISE", entrySpot: 1000, barrier: null,
      durationTicks: 3, stake: STAKE, payout: 190, payoutPerPoint: null,
    };
    const short = [{ price: 1001, epoch: 1 }, { price: 1002, epoch: 2 }];
    expect(resolveContract(p, short)).toEqual({ ready: false });

    const full = [...short, { price: 1005, epoch: 3 }];
    expect(resolveContract(p, full)).toEqual({ ready: true, won: true, credit: 190, exitSpot: 1005 });
  });

  it("Touch resolves early on a barrier hit and pays the fixed payout", () => {
    const p: ResolveParams = {
      kind: "TOUCH_NO_TOUCH", side: "TOUCH", entrySpot: 1000, barrier: 1010,
      durationTicks: 10, stake: STAKE, payout: 300, payoutPerPoint: null,
    };
    const ticks = [{ price: 1002, epoch: 1 }, { price: 1011, epoch: 2 }, { price: 1000, epoch: 3 }];
    expect(resolveContract(p, ticks)).toEqual({ ready: true, won: true, credit: 300, exitSpot: 1011 });
  });

  it("No-Touch that never touches wins once the full window elapses", () => {
    const p: ResolveParams = {
      kind: "TOUCH_NO_TOUCH", side: "NO_TOUCH", entrySpot: 1000, barrier: 1010,
      durationTicks: 3, stake: STAKE, payout: 120, payoutPerPoint: null,
    };
    const ticks = [{ price: 1002, epoch: 1 }, { price: 1004, epoch: 2 }, { price: 1003, epoch: 3 }];
    expect(resolveContract(p, ticks)).toEqual({ ready: true, won: true, credit: 120, exitSpot: 1003 });
  });

  it("Vanilla payout is bounded and out-of-the-money expires worthless", () => {
    const perPoint = vanillaPayoutPerPoint({
      entrySpot: 1000, strike: 1000, side: "CALL", sigmaTick: 0.003, durationTicks: 20, stake: STAKE,
    });
    expect(perPoint).toBeGreaterThan(0);
    // CALL with exit below strike → intrinsic 0 → credit 0.
    const p: ResolveParams = {
      kind: "VANILLA", side: "CALL", entrySpot: 1000, barrier: 1000,
      durationTicks: 2, stake: STAKE, payout: 0, payoutPerPoint: perPoint,
    };
    const res = resolveContract(p, [{ price: 998, epoch: 1 }, { price: 995, epoch: 2 }]);
    expect(res).toMatchObject({ ready: true, won: false, credit: 0 });
  });
});
