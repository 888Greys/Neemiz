import { describe, it, expect } from "vitest";
import {
  makeRng, simulatePath, estimateWinProb, measureRtp, safePayoutMultiplier, digitDistribution,
  type TickPath,
} from "@/lib/binary/fairness";
import {
  resolveContract, digitWonFromQuote, exitDigitFromQuote,
  type ResolveParams, type DirectionalKind, type DirectionalSide,
} from "@/lib/binary/kernel";
import { touchProbability } from "@/lib/directional";

// ─────────────────────────────────────────────────────────────────────────────
// FAIRNESS INVARIANT SUITE
//
// This is the CI gate for the binary-options rebuild. It encodes the product's
// core law as an executable test: a contract PRICED by Monte-Carlo of the
// settlement kernel has realized RTP ≤ 1 (the house never loses long-run),
// for EVERY contract family — because price and settlement are the same code.
//
// All randomness is seeded, so results are deterministic and non-flaky.
// ─────────────────────────────────────────────────────────────────────────────

const EDGE = 0.05;              // house edge floor baked into the safe price
const ENTRY = 1000;
const SIGMA = 0.002;            // per-tick vol of the synthetic market model
const DUR = 8;                  // contract duration in ticks
const PRICE_TRIALS = 40_000;    // paths used to estimate win prob (price)
const MEASURE_TRIALS = 40_000;  // fresh, independent paths used to measure RTP

function won(res: ReturnType<typeof resolveContract>): boolean {
  return res.ready ? res.won : false;
}

/** Build a directional trial: draw a forward path, settle it through the kernel. */
function directionalTrial(kind: DirectionalKind, side: DirectionalSide, barrier: number | null, drawSeed: () => number) {
  const params: ResolveParams = {
    kind, side, entrySpot: ENTRY, barrier, durationTicks: DUR, stake: 1, payout: 1, payoutPerPoint: null,
  };
  return {
    drawPath: () => simulatePath(drawSeed, { start: ENTRY, sigmaTick: SIGMA, steps: DUR }) as TickPath,
    settle: (path: TickPath) => won(resolveContract(params, path)),
  };
}

describe("architecture invariant: kernel-priced contracts are house-safe (RTP ≤ 1)", () => {
  const cases: { kind: DirectionalKind; side: DirectionalSide; barrier: number | null }[] = [
    { kind: "RISE_FALL",      side: "RISE",     barrier: null },
    { kind: "RISE_FALL",      side: "FALL",     barrier: null },
    { kind: "HIGHER_LOWER",   side: "HIGHER",   barrier: ENTRY * (1 + 0.5 * SIGMA * Math.sqrt(DUR)) },
    { kind: "HIGHER_LOWER",   side: "LOWER",    barrier: ENTRY * (1 - 0.5 * SIGMA * Math.sqrt(DUR)) },
    { kind: "TOUCH_NO_TOUCH", side: "TOUCH",    barrier: ENTRY * (1 + 1.0 * SIGMA * Math.sqrt(DUR)) },
    { kind: "TOUCH_NO_TOUCH", side: "NO_TOUCH", barrier: ENTRY * (1 + 0.5 * SIGMA * Math.sqrt(DUR)) },
  ];

  for (const c of cases) {
    it(`${c.kind}/${c.side}`, () => {
      // Price from the kernel-measured probability (separate rng stream).
      const priceTrial = directionalTrial(c.kind, c.side, c.barrier, makeRng(1));
      const p = estimateWinProb(priceTrial, PRICE_TRIALS);
      const netMult = safePayoutMultiplier(p, EDGE);

      // Measure realized RTP on FRESH, independent paths.
      const measTrial = directionalTrial(c.kind, c.side, c.barrier, makeRng(999));
      const { rtp } = measureRtp(measTrial, netMult, MEASURE_TRIALS);

      // The whole thesis: pricing off settlement can never be +EV for the player.
      expect(rtp).toBeLessThanOrEqual(1.0);
      // ...and it lands near the intended edge, not miles under (sanity).
      expect(rtp).toBeGreaterThan(1 - EDGE - 0.06);
    }, 30_000);
  }
});

describe("digit games: pricing off the MEASURED distribution is house-safe", () => {
  it("every digit contract has RTP ≤ 1 when priced from the observed distribution", () => {
    // Sample exit quotes from the market model, measure the real digit dist.
    const rng = makeRng(7);
    const sample: number[] = [];
    for (let i = 0; i < 60_000; i++) {
      const path = simulatePath(rng, { start: ENTRY, sigmaTick: SIGMA, steps: DUR });
      sample.push(path[path.length - 1].price);
    }
    const dist = digitDistribution(sample, exitDigitFromQuote);

    // Price Matches-d off the MEASURED p(d); assert kernel-settled RTP ≤ 1.
    for (let d = 0; d < 10; d++) {
      const p = dist[d];
      if (p <= 0) continue;
      const netMult = safePayoutMultiplier(p, EDGE);
      let payout = 0;
      const rng2 = makeRng(1000 + d);
      const N = 40_000;
      for (let i = 0; i < N; i++) {
        const path = simulatePath(rng2, { start: ENTRY, sigmaTick: SIGMA, steps: DUR });
        if (digitWonFromQuote("Matches", d, path[path.length - 1].price)) payout += netMult;
      }
      expect(payout / N).toBeLessThanOrEqual(1.0);
    }
  }, 30_000);
});

describe("regression: the closed-form Touch model mis-states the discrete win prob", () => {
  // Pins WHY the kernel approach is required. Live pricing derives NO_TOUCH from
  // touchProbability() — a CONTINUOUS reflection-principle model — while
  // settlement only samples DUR discrete ticks. A discrete path can only touch a
  // barrier on the ticks it samples, so it touches ≤ as often as the continuous
  // path the model assumes. Therefore the model UNDERSTATES the true NO_TOUCH
  // win probability and the contract is sold too cheap (+EV to the player). This
  // gap is the exploit; the kernel-priced tests above have no such gap because
  // they price off the same discrete settlement.
  it("model NO_TOUCH prob is strictly below the true discrete NO_TOUCH rate", () => {
    const barrier = ENTRY * (1 + 0.5 * SIGMA * Math.sqrt(DUR));
    const modelNoTouch = 1 - touchProbability(ENTRY, barrier, SIGMA, DUR);

    const rng = makeRng(4242);
    const params: ResolveParams = { kind: "TOUCH_NO_TOUCH", side: "NO_TOUCH", entrySpot: ENTRY, barrier, durationTicks: DUR, stake: 1, payout: 1, payoutPerPoint: null };
    let wins = 0;
    const N = 60_000;
    for (let i = 0; i < N; i++) {
      const path = simulatePath(rng, { start: ENTRY, sigmaTick: SIGMA, steps: DUR });
      if (won(resolveContract(params, path))) wins++;
    }
    const trueNoTouch = wins / N;

    // The defect: settlement wins NO_TOUCH more often than the price assumes.
    expect(trueNoTouch).toBeGreaterThan(modelNoTouch);
  }, 30_000);
});
