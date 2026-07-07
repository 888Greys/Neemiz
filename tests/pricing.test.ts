import { describe, it, expect } from "vitest";
import { makeRng, simulatePath } from "@/lib/binary/fairness";
import {
  priceDigitContract, priceDirectionalContract, sampleWindows, wilsonUpper,
  measureSymbolEdge, DEFAULT_EDGE, DEFAULT_CONFIG, type Window,
} from "@/lib/binary/pricing";
import { resolveContract, digitWonFromQuote, type ResolveParams, type DirectionalKind, type DirectionalSide } from "@/lib/binary/kernel";

// ─────────────────────────────────────────────────────────────────────────────
// PRICING ENGINE PROOF (out-of-sample)
//
// Generate a long synthetic feed, PRICE contracts on the first half, then
// MEASURE realized RTP on the held-out second half. Honest test: the engine
// never sees the data it's judged on. Every accepted contract must settle at
// RTP ≤ 1 — including the exact Touch/No-Touch and digit contracts that were
// previously +EV.
// ─────────────────────────────────────────────────────────────────────────────

const SIGMA = 0.002;
const DUR = 8;
const START = 1000;

function feed(seed: number, steps: number): number[] {
  return simulatePath(makeRng(seed), { start: START, sigmaTick: SIGMA, steps }).map((t) => t.price);
}

const TRAIN = feed(11, 20_000);
const TEST = feed(22, 20_000); // independent series = fresh market realisation

const toPath = (forward: number[]) => forward.map((price, k) => ({ price, epoch: k + 1 }));

/** Realized RTP of a priced contract on held-out ticks. */
function realizedRtp(ticks: number[], settle: (w: Window) => boolean, multiplier: number, seed: number): number {
  const windows = sampleWindows(ticks, DUR, 40_000, makeRng(seed));
  let payout = 0;
  for (const w of windows) if (settle(w)) payout += multiplier;
  return payout / windows.length;
}

const barFrac = (mult: number) => mult * SIGMA * Math.sqrt(DUR);

describe("pricing engine: accepted contracts are house-safe out-of-sample (RTP ≤ 1)", () => {
  const directional: { kind: Exclude<DirectionalKind, "VANILLA">; side: DirectionalSide; frac: number | null }[] = [
    { kind: "RISE_FALL",      side: "RISE",     frac: null },
    { kind: "RISE_FALL",      side: "FALL",     frac: null },
    { kind: "HIGHER_LOWER",   side: "HIGHER",   frac: barFrac(0.5) },
    { kind: "HIGHER_LOWER",   side: "LOWER",    frac: -barFrac(0.5) },
    { kind: "TOUCH_NO_TOUCH", side: "TOUCH",    frac: barFrac(1.0) },
    { kind: "TOUCH_NO_TOUCH", side: "NO_TOUCH", frac: barFrac(0.5) }, // the old +524% exploit
  ];

  for (const c of directional) {
    it(`${c.kind}/${c.side}`, () => {
      const q = priceDirectionalContract(c.kind, c.side, c.frac, DUR, TRAIN);
      expect(q.accepted).toBe(true);
      if (!q.accepted) return;
      const settle = (w: Window): boolean => {
        const barrier = c.frac == null ? null : w.entry * (1 + c.frac);
        const params: ResolveParams = { kind: c.kind, side: c.side, entrySpot: w.entry, barrier, durationTicks: DUR, stake: 1, payout: 1, payoutPerPoint: null };
        const r = resolveContract(params, toPath(w.forward));
        return r.ready ? r.won : false;
      };
      const rtp = realizedRtp(TEST, settle, q.payoutMultiplier, 7);
      expect(rtp).toBeLessThanOrEqual(1.0);   // house never loses long-run
      expect(rtp).toBeGreaterThan(0.80);      // ...and isn't gouging to zero
    }, 30_000);
  }

  it("digit Matches (every target) is house-safe", () => {
    for (let d = 0; d < 10; d++) {
      const q = priceDigitContract("Matches", d, DUR, TRAIN);
      if (!q.accepted) continue;
      const settle = (w: Window) => digitWonFromQuote("Matches", d, w.forward[w.forward.length - 1]);
      const rtp = realizedRtp(TEST, settle, q.payoutMultiplier, 100 + d);
      expect(rtp).toBeLessThanOrEqual(1.0);
    }
  }, 30_000);
});

describe("measureSymbolEdge (per-symbol edge)", () => {
  it("returns a tight edge for a stable series and stays within bounds", () => {
    const edge = measureSymbolEdge(TRAIN); // TRAIN is a clean synthetic GBM
    expect(edge).toBeGreaterThanOrEqual(DEFAULT_EDGE.min);
    expect(edge).toBeLessThanOrEqual(DEFAULT_EDGE.max);
    expect(edge).toBeLessThan(0.10); // stable ⇒ near the base, not maxed out
  });

  it("returns the most conservative (max) edge on thin data", () => {
    expect(measureSymbolEdge(TEST.slice(0, 30))).toBe(DEFAULT_EDGE.max);
  });
});

describe("pricing engine: the safety gates fire", () => {
  it("rejects a near-certain (deep in-the-money) contract", () => {
    // A LOWER barrier far ABOVE entry ⇒ exit almost always below it ⇒ ~certain
    // win. This was the deep-ITM 'guaranteed win' class; must be refused.
    const q = priceDirectionalContract("HIGHER_LOWER", "LOWER", barFrac(8), DUR, TRAIN);
    expect(q.accepted).toBe(false);
  });

  it("refuses to quote on insufficient market data", () => {
    const q = priceDirectionalContract("RISE_FALL", "RISE", null, DUR, TEST.slice(0, 100));
    expect(q.accepted).toBe(false);
  });

  it("rejects a deep-OTM barrier whose fair price exceeds the cap (no rigged 50× lottery ticket)", () => {
    // A HIGHER barrier far ABOVE entry ⇒ exit almost never above it ⇒ win chance
    // tiny ⇒ fair multiplier ≫ maxMultiplier. Must be refused, not clamped+sold.
    const q = priceDirectionalContract("HIGHER_LOWER", "HIGHER", barFrac(6), DUR, TRAIN);
    expect(q.accepted).toBe(false);
    if (!q.accepted) expect(q.reason).toMatch(/exceed the .*cap|win chance/i);
  });

  it("clamp-and-sells the same barrier when rejectAboveCap is disabled (legacy behaviour)", () => {
    const cfg = { ...DEFAULT_CONFIG, rejectAboveCap: false };
    const q = priceDirectionalContract("HIGHER_LOWER", "HIGHER", barFrac(6), DUR, TRAIN, cfg);
    // It must NOT be rejected for exceeding the cap; if sold, payout is ≤ the cap.
    if (!q.accepted) expect(q.reason).not.toMatch(/exceed the .*cap/i);
    else expect(q.payoutMultiplier).toBeLessThanOrEqual(DEFAULT_CONFIG.maxMultiplier);
  });

  it("wilsonUpper is a real upper bound and ordered", () => {
    expect(wilsonUpper(50, 100, 2.33)).toBeGreaterThan(0.5);
    expect(wilsonUpper(50, 100, 2.33)).toBeGreaterThan(wilsonUpper(50, 100000, 2.33));
    expect(wilsonUpper(0, 100, 2.33)).toBeGreaterThan(0);
  });
});
