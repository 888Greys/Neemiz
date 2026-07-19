import { describe, it, expect } from "vitest";
import { makeRng, simulatePath } from "@/lib/binary/fairness";
import { exitDigitFromQuote } from "@/lib/binary/kernel";
import {
  priceDirectionalServer, priceDigitServer, previewDigitPayout, resolveDigitEdgeFloor,
  shortDigitRejectReason, shortDirectionalRejectReason, minBarrierOffsetPts,
  BARRIER_TOO_CLOSE_COPY, MIN_BARRIER_FRAC, MIN_OVER_UNDER_TICKS,
  MATCHES_FREQ_LO, MATCHES_FREQ_HI,
} from "@/lib/binary/server-price";

/** Build a calibration window with an exact unconditional frequency for `digit`. */
function ticksWithDigitFreq(digit: number, freq: number, n = 2000): number[] {
  const targetCount = Math.round(n * freq);
  const out: number[] = [];
  for (let i = 0; i < targetCount; i++) {
    out.push(Number((100 + digit / 100).toFixed(2)));
  }
  let j = 0;
  while (out.length < n) {
    const d = j % 10;
    j++;
    if (d === digit) continue;
    out.push(Number((100 + d / 100).toFixed(2)));
  }
  // Deterministic shuffle so conditional windows aren't pathologically clustered.
  for (let i = out.length - 1; i > 0; i--) {
    const k = (i * 17 + 31) % (i + 1);
    [out[i], out[k]] = [out[k], out[i]];
  }
  return out;
}

// The request-path pricing helper: turns a contract + real tick window into a
// stored payout via the engine. Ticks are injected, so no feed is needed.

const SIGMA = 0.002;
const START = 1000;
const ticks = simulatePath(makeRng(3), { start: START, sigmaTick: SIGMA, steps: 20_000 }).map((t) => t.price);

describe("priceDirectionalServer", () => {
  it("prices a Rise contract with a sane, >1× payout", () => {
    const r = priceDirectionalServer({ kind: "RISE_FALL", side: "RISE", entrySpot: START, barrier: null, durationTicks: 8, stake: 100, ticks });
    expect(r.accepted).toBe(true);
    if (r.accepted) {
      expect(r.multiplier).toBeGreaterThan(1);
      expect(r.payout).toBeCloseTo(100 * r.multiplier, 2);
    }
  });

  it("prices a near-the-money NO_TOUCH (the old exploit) and stays finite", () => {
    const barrier = START * (1 + 0.5 * SIGMA * Math.sqrt(8));
    const r = priceDirectionalServer({ kind: "TOUCH_NO_TOUCH", side: "NO_TOUCH", entrySpot: START, barrier, durationTicks: 8, stake: 100, ticks });
    expect(r.accepted).toBe(true);
    if (r.accepted) expect(r.multiplier).toBeLessThan(50);
  });

  it("rejects a deep-in-the-money (near-certain) barrier", () => {
    // LOWER barrier far above spot ⇒ exit almost always below ⇒ ~certain win.
    const barrier = START * (1 + 8 * SIGMA * Math.sqrt(8));
    const r = priceDirectionalServer({ kind: "HIGHER_LOWER", side: "LOWER", entrySpot: START, barrier, durationTicks: 8, stake: 100, ticks });
    expect(r.accepted).toBe(false);
  });

  it("rejects on thin market data", () => {
    const r = priceDirectionalServer({ kind: "RISE_FALL", side: "RISE", entrySpot: START, barrier: null, durationTicks: 8, stake: 100, ticks: ticks.slice(0, 100) });
    expect(r.accepted).toBe(false);
  });

  it("rejects 1-tick Rise/Fall on 1Hz markets (live RTP leak)", () => {
    const r = priceDirectionalServer({
      kind: "RISE_FALL", side: "RISE", entrySpot: START, barrier: null,
      durationTicks: 1, stake: 100, ticks, market: "1HZ10V",
    });
    expect(r.accepted).toBe(false);
    if (!r.accepted) expect(r.reason).toMatch(/1-tick/i);
  });

  it("still allows 1-tick Rise/Fall on non-1Hz markets", () => {
    const r = priceDirectionalServer({
      kind: "RISE_FALL", side: "RISE", entrySpot: START, barrier: null,
      durationTicks: 1, stake: 100, ticks, market: "R_100",
    });
    expect(r.accepted).toBe(true);
  });

  it("rejects HIGHER_LOWER barriers closer than 0.1% of spot", () => {
    const barrier = START * (1 + 0.0005); // 0.05% — under the new floor
    const r = priceDirectionalServer({
      kind: "HIGHER_LOWER", side: "HIGHER", entrySpot: START, barrier,
      durationTicks: 8, stake: 100, ticks, market: "1HZ10V",
    });
    expect(r.accepted).toBe(false);
    if (!r.accepted) expect(r.reason).toMatch(/too close/i);
  });

  it("accepts HIGHER_LOWER at exactly the 0.1% minimum distance", () => {
    const barrier = START * (1 + 0.001);
    const r = priceDirectionalServer({
      kind: "HIGHER_LOWER", side: "HIGHER", entrySpot: START, barrier,
      durationTicks: 8, stake: 100, ticks, market: "1HZ25V",
    });
    // May still reject for other reasons (near-certain / thin), but not the distance gate.
    if (!r.accepted) expect(r.reason).not.toMatch(/too close/i);
  });

  it("minBarrierOffsetPts matches MIN_BARRIER_FRAC and never under-rounds", () => {
    expect(MIN_BARRIER_FRAC).toBe(0.001);
    // Vol 10-ish spot ~9477: UI used to allow 4.74 (0.05%) which the server rejects.
    const spot = 9477;
    const minPts = minBarrierOffsetPts(spot);
    expect(minPts).toBeGreaterThanOrEqual(spot * MIN_BARRIER_FRAC - 1e-9);
    expect(minPts).toBe(9.48);
    expect(minPts / spot).toBeGreaterThanOrEqual(MIN_BARRIER_FRAC - 1e-12);
  });

  it("shortDirectionalRejectReason maps barrier-too-close to calm Buy copy", () => {
    expect(shortDirectionalRejectReason("barrier too close to spot — pick at least 0.1% away"))
      .toBe(BARRIER_TOO_CLOSE_COPY);
    expect(
      shortDirectionalRejectReason(
        "This contract isn't available right now (barrier too close to spot — pick at least 0.1% away).",
      ),
    ).toBe(BARRIER_TOO_CLOSE_COPY);
  });

  it("shortDirectionalRejectReason maps win-prob gates to barrier-friendly copy for HL/Touch", () => {
    expect(shortDirectionalRejectReason("win probability too high", "TOUCH_NO_TOUCH"))
      .toBe("Can't price this barrier right now — move it farther or change duration");
    expect(shortDirectionalRejectReason("near-certain outcome", "HIGHER_LOWER"))
      .toBe("Can't price this barrier right now — move it farther or change duration");
    expect(shortDirectionalRejectReason("win chance outside band", "RISE_FALL"))
      .toBe("Unavailable");
  });

  it("rejects deep-ITM HIGHER_LOWER under the tightened 80% Wilson cap", () => {
    // Barrier far below spot ⇒ HIGHER almost never wins; LOWER is near-certain.
    const barrier = START * (1 - 8 * SIGMA * Math.sqrt(8));
    const r = priceDirectionalServer({
      kind: "HIGHER_LOWER", side: "LOWER", entrySpot: START, barrier,
      durationTicks: 8, stake: 100, ticks,
    });
    expect(r.accepted).toBe(false);
  });
});

describe("priceDigitServer", () => {
  it("never lets per-symbol calibration lower the digit edge floors", () => {
    expect(resolveDigitEdgeFloor("Even", 0, 0.06)).toBe(0.10);
    expect(resolveDigitEdgeFloor("Matches", 5, 0.06)).toBe(0.20);
    expect(resolveDigitEdgeFloor("Odd", 0, 0.12)).toBe(0.12);
    expect(resolveDigitEdgeFloor("Matches", 5, 0.22)).toBe(0.22);
    expect(resolveDigitEdgeFloor("Under", 5, 0.06)).toBe(0.18);
    expect(resolveDigitEdgeFloor("Under", 4, 0.09)).toBe(0.18);
    expect(resolveDigitEdgeFloor("Under", 3, 0.06)).toBe(0.10);
    expect(resolveDigitEdgeFloor("Over", 4, 0.06)).toBe(0.15);
  });

  it("rejects too-short Over/Under (the R_50 1-tick autocorrelation exploit)", () => {
    // Live evidence: 1-tick Over/Under on R_50 realized RTP ~1.5 by exploiting
    // tick-to-tick digit autocorrelation the window-sampled price can't see.
    for (const side of ["Over", "Under"] as const) {
      for (let d = 1; d < MIN_OVER_UNDER_TICKS; d++) {
        const r = priceDigitServer({ side, targetDigit: 5, durationTicks: d, stake: 100, ticks });
        expect(r.accepted, `${side} @ ${d} ticks must be rejected`).toBe(false);
      }
      // At the minimum duration it prices normally again.
      const ok = priceDigitServer({ side, targetDigit: 5, durationTicks: MIN_OVER_UNDER_TICKS, stake: 100, ticks });
      expect(ok.accepted, `${side} @ ${MIN_OVER_UNDER_TICKS} ticks should price`).toBe(true);
    }
  });

  it("quarantines R_50 Under (mis-calibrated +EV) but leaves R_50 Over live", () => {
    // Live 7d autopsy: R_50 Under 4/5/6 ran RTP 1.33–1.42 (measured winProb far
    // below realized). Fail closed on R_50 Under until recalibrated; other
    // markets and R_50 Over are unaffected.
    const rUnder = priceDigitServer({ side: "Under", targetDigit: 5, durationTicks: 5, stake: 100, ticks, market: "R_50" });
    expect(rUnder.accepted).toBe(false);

    const rOver = priceDigitServer({ side: "Over", targetDigit: 5, durationTicks: 5, stake: 100, ticks, market: "R_50" });
    expect(rOver.accepted).toBe(true);

    // Under on a non-quarantined market still prices.
    const rUnderOk = priceDigitServer({ side: "Under", targetDigit: 5, durationTicks: 5, stake: 100, ticks, market: "1HZ10V" });
    expect(rUnderOk.accepted).toBe(true);

    // No market supplied → no quarantine (back-compat with existing callers).
    const rNoMarket = priceDigitServer({ side: "Under", targetDigit: 5, durationTicks: 5, stake: 100, ticks });
    expect(rNoMarket.accepted).toBe(true);
  });

  it("prices Even/Odd/Matches/Differs contracts with sane payouts", () => {
    // 1. Even
    const rEven = priceDigitServer({ side: "Even", targetDigit: 0, durationTicks: 5, stake: 100, ticks });
    expect(rEven.accepted).toBe(true);
    if (rEven.accepted) expect(rEven.multiplier).toBeCloseTo(1.75, 1);

    // 2. Matches — requires entryDigit (conditional sticky-digit pricing)
    const rMatches = priceDigitServer({ side: "Matches", targetDigit: 5, durationTicks: 5, stake: 100, ticks, entryDigit: 3 });
    expect(rMatches.accepted).toBe(true);
    if (rMatches.accepted) expect(rMatches.multiplier).toBeGreaterThan(5.0);

    // 3. Differs: high-probability contracts must stay offerable instead of
    // being rejected as priced <= 1x when a symbol calibration edge is supplied.
    const differsEdge = resolveDigitEdgeFloor("Differs", 5, 0.09);
    const rDiffers = priceDigitServer({ side: "Differs", targetDigit: 5, durationTicks: 5, stake: 100, ticks, edgeFloor: differsEdge });
    expect(rDiffers.accepted).toBe(true);
    if (rDiffers.accepted) expect(rDiffers.multiplier).toBeGreaterThan(1);
  });

  it("keeps every digit action button offerable at the default target digit", () => {
    const sides = ["Even", "Odd", "Matches", "Differs", "Over", "Under"] as const;

    for (const side of sides) {
      const edge = resolveDigitEdgeFloor(side, 5, 0.09);
      const result = priceDigitServer({
        side, targetDigit: 5, durationTicks: 5, stake: 100, ticks, edgeFloor: edge,
        entryDigit: side === "Matches" || side === "Over" || side === "Under" ? 5 : undefined,
      });
      expect(result, side).toMatchObject({ accepted: true });
    }
  });

  it("static previewDigitPayout uses floor-based math (advisory fallback only)", () => {
    // Live Buy labels / place use priceDigitServer via /api/binary/quote + bet.
    expect(previewDigitPayout(1000, "Even", 0)).toBe(1800);
    // Matches: winProb 0.1, edge 0.20 → floor((0.80/0.1)*100)/100 = 8.00
    expect(previewDigitPayout(1000, "Matches", 5)).toBe(8000);
    expect(previewDigitPayout(1000, "Differs", 5)).toBe(1080);
    // Over 5: winProb 0.4, edge 0.15 → floor((0.85/0.4)*100)/100 = 2.12
    expect(previewDigitPayout(1000, "Over", 5)).toBe(2120);
    // Under 5: winProb 0.5, edge 0.18 → floor((0.82/0.5)*100)/100 = 1.64
    expect(previewDigitPayout(1000, "Under", 5)).toBe(1640);
  });

  it("rejects Matches without an entry digit (conditional pricing required)", () => {
    const r = priceDigitServer({ side: "Matches", targetDigit: 5, durationTicks: 5, stake: 100, ticks });
    expect(r.accepted).toBe(false);
    if (!r.accepted) expect(r.reason).toMatch(/entry digit/i);
  });

  it("prices sticky Matches (entry=target) below non-sticky on autocorrelated ticks", () => {
    // Synthetic sticky digit walk (same construction as digit-conditional tests).
    const sticky: number[] = [];
    let d = 5;
    for (let i = 0; i < 4000; i++) {
      sticky.push(Number((100 + d / 100).toFixed(2)));
      if (i % 4 === 0) { d = (d + 1) % 10; }
    }
    const stickyMatch = priceDigitServer({
      side: "Matches", targetDigit: 5, durationTicks: 3, stake: 100, ticks: sticky, entryDigit: 5,
    });
    const otherMatch = priceDigitServer({
      side: "Matches", targetDigit: 5, durationTicks: 3, stake: 100, ticks: sticky, entryDigit: 0,
    });
    expect(stickyMatch.accepted && otherMatch.accepted).toBe(true);
    if (stickyMatch.accepted && otherMatch.accepted) {
      expect(stickyMatch.multiplier).toBeLessThan(otherMatch.multiplier);
    }
  });

  it("rejects Matches when the digit distribution is highly skewed (stability gate)", () => {
    // Create highly skewed ticks where exit digits are always 5 (e.g. quote ends in .55555)
    const skewedTicks = Array.from({ length: 600 }, () => 100.55);
    
    // Target digit 5 has frequency 100% (unstable, > HI)
    const rSkewedMatches = priceDigitServer({ side: "Matches", targetDigit: 5, durationTicks: 5, stake: 100, ticks: skewedTicks, entryDigit: 5 });
    expect(rSkewedMatches.accepted).toBe(false);
    if (!rSkewedMatches.accepted) {
      expect(rSkewedMatches.reason).toContain("digit distribution unstable");
    }

    // Target digit 0 has frequency 0% (unstable, < LO)
    const rSkewedMatchesZero = priceDigitServer({ side: "Matches", targetDigit: 0, durationTicks: 5, stake: 100, ticks: skewedTicks, entryDigit: 0 });
    expect(rSkewedMatchesZero.accepted).toBe(false);
    if (!rSkewedMatchesZero.accepted) {
      expect(rSkewedMatchesZero.reason).toContain("digit distribution unstable");
    }
  });

  it("Matches stability gate accepts band edges and rejects just outside", () => {
    expect(MATCHES_FREQ_LO).toBe(0.08);
    expect(MATCHES_FREQ_HI).toBe(0.12);

    for (const freq of [MATCHES_FREQ_LO, MATCHES_FREQ_HI] as const) {
      const bandTicks = ticksWithDigitFreq(5, freq);
      const measured = bandTicks.filter((t) => exitDigitFromQuote(t) === 5).length / bandTicks.length;
      expect(measured).toBeCloseTo(freq, 3);
      const r = priceDigitServer({
        side: "Matches", targetDigit: 5, durationTicks: 5, stake: 100,
        ticks: bandTicks, entryDigit: 3,
      });
      expect(r.accepted, `freq=${freq} should be inside band`).toBe(true);
    }

    for (const freq of [MATCHES_FREQ_LO - 0.001, MATCHES_FREQ_HI + 0.001, 0.175] as const) {
      const outTicks = ticksWithDigitFreq(6, freq);
      const r = priceDigitServer({
        side: "Matches", targetDigit: 6, durationTicks: 5, stake: 100,
        ticks: outTicks, entryDigit: 2,
      });
      expect(r.accepted, `freq=${freq} should be rejected`).toBe(false);
      if (!r.accepted) expect(r.reason).toContain("digit distribution unstable");
    }
  });

  it("shortDigitRejectReason maps gate copy for the Matches Buy label", () => {
    expect(shortDigitRejectReason("digit distribution unstable (freq 17.5%)", "Matches")).toBe(
      "Matches unavailable for this digit — try another",
    );
    expect(shortDigitRejectReason("insufficient conditional data", "Matches")).toBe(
      "Matches unavailable for this digit — try another",
    );
    expect(
      shortDigitRejectReason(
        "This contract isn't available right now (digit distribution unstable)",
        "Matches",
      ),
    ).toBe("Matches unavailable for this digit — try another");
    expect(shortDigitRejectReason("entry digit required for Matches", "Matches")).toBe("Pricing…");
  });

  it("shortDigitRejectReason never says Matches on Over/Under", () => {
    expect(shortDigitRejectReason("insufficient conditional data", "Over")).toBe(
      "Over/Under unavailable for this setup — try another digit or longer duration",
    );
    expect(shortDigitRejectReason("Over/Under needs at least 5 ticks", "Under")).toBe(
      "Over/Under unavailable for this setup — try another digit or longer duration",
    );
    expect(shortDigitRejectReason("Under is temporarily unavailable on this market", "Under")).toBe(
      "Over/Under unavailable for this setup — try another digit or longer duration",
    );
    expect(shortDigitRejectReason("win probability too high", "Over")).toBe(
      "Over/Under unavailable for this setup — try another digit or longer duration",
    );
  });

  it("still allows Even/Odd on skewed ticks since they do not check digit stability", () => {
    // A skewed (non-uniform) digit distribution that would trip a stability gate,
    // but where Even is still very winnable (~90%): last digit biased to evens.
    // Even/Odd don't gate, and the contract is winnable, so it must still price.
    // (A degenerate all-odd feed where Even can NEVER win is correctly rejected
    // by the payout-cap guard — that's a different, desirable behaviour.)
    const evenBias = [0, 2, 4, 6, 8, 1, 3, 5, 7, 0]; // 60% even → winnable but below the maxWinProb cap
    const skewedTicks = Array.from({ length: 600 }, (_, i) => Number((100.5 + evenBias[i % evenBias.length] / 100).toFixed(2)));
    const rSkewedEven = priceDigitServer({ side: "Even", targetDigit: 0, durationTicks: 5, stake: 100, ticks: skewedTicks });
    expect(rSkewedEven.accepted).toBe(true);
  });
});
