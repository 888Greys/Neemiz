import { describe, it, expect } from "vitest";
import {
  clampTurboBarrier,
  turboPayoutPerPoint,
  MIN_TURBO_DIST_FRAC,
  MAX_TURBO_DIST_FRAC,
} from "@/lib/leveraged";

// ─────────────────────────────────────────────────────────────────────────────
// Regression: the directional engine was exploited via an unbounded negative
// barrierOffset (barrier = entrySpot + offset went negative → guaranteed win).
// The TURBO barrier here is derived the same way (entrySpot + barrierOffset) but
// passed through clampTurboBarrier, which must neutralise any offset — sign,
// magnitude, or degenerate — by forcing the barrier onto the correct side within
// [0.1%, 5%] of spot. These tests pin that invariant so leveraged can't regress
// into the same class of bug.
// ─────────────────────────────────────────────────────────────────────────────

describe("leveraged turbo barrier — clamp neutralises any offset", () => {
  const entrySpot = 9739.55;

  it("a large NEGATIVE offset never yields a non-positive or wrong-side barrier", () => {
    for (const offset of [-9800, -1e6, -entrySpot, -0.0001, 0]) {
      const barrierUp   = clampTurboBarrier(entrySpot, entrySpot + offset, "UP");
      const barrierDown = clampTurboBarrier(entrySpot, entrySpot + offset, "DOWN");
      // Always a real positive price…
      expect(barrierUp).toBeGreaterThan(0);
      expect(barrierDown).toBeGreaterThan(0);
      // …on the correct side: UP knocks out below spot, DOWN above.
      expect(barrierUp).toBeLessThan(entrySpot);
      expect(barrierDown).toBeGreaterThan(entrySpot);
    }
  });

  it("barrier distance is always clamped into [0.1%, 5%] of spot", () => {
    for (const offset of [-1e6, -50, 5, 1e6]) {
      for (const dir of ["UP", "DOWN"] as const) {
        const barrier = clampTurboBarrier(entrySpot, entrySpot + offset, dir);
        const dist = Math.abs(entrySpot - barrier);
        expect(dist).toBeGreaterThanOrEqual(entrySpot * MIN_TURBO_DIST_FRAC - 1e-6);
        expect(dist).toBeLessThanOrEqual(entrySpot * MAX_TURBO_DIST_FRAC + 1e-6);
      }
    }
  });

  it("payout-per-point is finite and positive for a clamped barrier (no div-by-zero)", () => {
    const barrier = clampTurboBarrier(entrySpot, entrySpot - 1e6, "UP");
    const perPoint = turboPayoutPerPoint(100, entrySpot, barrier);
    expect(Number.isFinite(perPoint)).toBe(true);
    expect(perPoint).toBeGreaterThan(0);
  });
});
