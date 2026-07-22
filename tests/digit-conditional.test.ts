import { describe, it, expect } from "vitest";
import { makeRng } from "@/lib/binary/fairness";
import { priceDigitContract, conditionalWindows, DEFAULT_CONFIG } from "@/lib/binary/pricing";
import { exitDigitFromQuote } from "@/lib/binary/kernel";

// Conditional (entry-digit-aware) digit pricing — the fix for the R_50 Over/Under
// autocorrelation exploit. We build a STICKY-digit tick series (the hundredths
// digit does a slow, highly autocorrelated walk, like the synthetic indices) and
// show that:
//   1. UNCONDITIONAL pricing lets an adaptive exploiter beat RTP 1.
//   2. CONDITIONAL pricing (priced on P(win | entry digit)) does not.
//
// Digit rule matches the engine: exitDigitFromQuote(q) = floor(q*100) % 10, so
// price = 100 + digit/100 makes the last digit exactly `digit`.

/** Sticky last-digit walk: stay with prob `stay`, else step ±1 (reflect 0..9). */
function stickyTicks(n: number, stay = 0.75, seed = 7): number[] {
  const rng = makeRng(seed);
  const out: number[] = [];
  let d = 5;
  for (let i = 0; i < n; i++) {
    out.push(Number((100 + d / 100).toFixed(2)));
    if (rng() > stay) { d += rng() < 0.5 ? -1 : 1; if (d < 0) d = 1; if (d > 9) d = 8; }
  }
  return out;
}

const cfg = { ...DEFAULT_CONFIG, minTicks: 200 };
const ticks = stickyTicks(4000, 0.6);   // autocorrelated but not near-certain
const DUR = 3;
const digits = ticks.map(exitDigitFromQuote);

/** Precomputed empirical P(win | entry digit) for every (side,target,entry),
 *  in ONE pass over the series (keeps the exploit sim fast). */
const condWinTable = new Map<string, number>();
{
  const wins = new Map<string, number>(), cnt = new Map<string, number>();
  for (let i = 0; i + DUR < digits.length; i++) {
    const e = digits[i], x = digits[i + DUR];
    for (const side of ["Over", "Under"] as const) for (let t = 1; t <= 8; t++) {
      const k = `${side}:${t}:${e}`;
      cnt.set(k, (cnt.get(k) ?? 0) + 1);
      if (side === "Over" ? x > t : x < t) wins.set(k, (wins.get(k) ?? 0) + 1);
    }
  }
  for (const [k, n] of cnt) condWinTable.set(k, (wins.get(k) ?? 0) / n);
}
const condWin = (side: "Over" | "Under", t: number, entry: number) => condWinTable.get(`${side}:${t}:${entry}`) ?? 0;

describe("conditionalWindows", () => {
  it("returns only windows whose entry digit matches", () => {
    for (const e of [0, 3, 8]) {
      const ws = conditionalWindows(ticks, DUR, e);
      expect(ws.length).toBeGreaterThan(50);
      expect(ws.every((w) => exitDigitFromQuote(w.entry) === e)).toBe(true);
    }
  });
});

describe("conditional digit pricing removes the sticky-digit edge", () => {
  it("prices a favorable entry digit's Over below the unconditional price", () => {
    // Entry digit 6 on a sticky series ⇒ Over 5 (needs digit 6–9) is more likely
    // than average, so its conditional payout must be smaller (higher win prob).
    const uncond = priceDigitContract("Over", 5, DUR, ticks, cfg);
    const cond = priceDigitContract("Over", 5, DUR, ticks, cfg, 1, 6);
    expect(uncond.accepted && cond.accepted).toBe(true);
    if (uncond.accepted && cond.accepted) {
      expect(cond.payoutMultiplier).toBeLessThan(uncond.payoutMultiplier);
    }
  });

  it("holds RTP ≤ 1 against an adaptive exploiter (vs > 1 unconditionally)", () => {
    // Adaptive exploiter: it ALWAYS knows the entry digit and selects the
    // (side,target) maximizing its true conditional EV = P(win|entry)·payout.
    // The payout it receives is set by the pricing MODE (unconditional today, or
    // conditional under the fix). Realized P&L uses the actual outcome.
    const SIDES = ["Over", "Under"] as const;
    const TARGETS = [2, 3, 4, 5, 6, 7];

    // Precompute multipliers: key `${entry|-1}:${side}:${t}`. entry -1 = uncond.
    const mult = new Map<string, number | null>();
    const multFor = (entry: number, side: (typeof SIDES)[number], t: number): number | null => {
      const key = `${entry}:${side}:${t}`;
      if (mult.has(key)) return mult.get(key)!;
      const q = entry < 0
        ? priceDigitContract(side, t, DUR, ticks, cfg)
        : priceDigitContract(side, t, DUR, ticks, cfg, 1, entry);
      const m = q.accepted ? q.payoutMultiplier : null;
      mult.set(key, m);
      return m;
    };

    const simulate = (conditional: boolean): number => {
      let staked = 0, paid = 0;
      for (let i = 0; i + DUR < digits.length; i++) {
        const e = digits[i];
        let best = { ev: -1, side: "Over" as (typeof SIDES)[number], t: 5, m: 0 };
        for (const side of SIDES) for (const t of TARGETS) {
          const m = multFor(conditional ? e : -1, side, t);
          if (m == null) continue;
          const ev = condWin(side, t, e) * m;   // exploiter's TRUE conditional EV
          if (ev > best.ev) best = { ev, side, t, m };
        }
        if (best.ev < 0) continue;
        staked += 1;
        const x = digits[i + DUR];
        const won = best.side === "Over" ? x > best.t : x < best.t;
        if (won) paid += best.m;
      }
      return staked > 0 ? paid / staked : 0;
    };

    const rtpUncond = simulate(false);
    const rtpCond = simulate(true);
    expect(rtpUncond).toBeGreaterThan(1);   // today's engine bleeds to the exploiter
    expect(rtpCond).toBeLessThanOrEqual(1); // the fix holds the house edge
  });
});

describe("conditional Matches pricing removes the sticky-digit edge", () => {
  it("prices Matches on the sticky entry digit below the unconditional price", () => {
    // On a sticky series, P(exit=d | entry=d) ≫ 0.1. Unconditional Matches
    // still pays ~8× → RTP ≫ 1 (live R_50 sticky Matches RTP ~3.4). Conditional
    // pricing must shrink the multiplier when entry equals the target.
    const uncond = priceDigitContract("Matches", 5, DUR, ticks, cfg);
    const sticky = priceDigitContract("Matches", 5, DUR, ticks, cfg, 1, 5);
    expect(uncond.accepted && sticky.accepted).toBe(true);
    if (uncond.accepted && sticky.accepted) {
      expect(sticky.payoutMultiplier).toBeLessThan(uncond.payoutMultiplier);
    }
  });

  it("holds Matches RTP ≤ 1 against a sticky-digit exploiter", () => {
    const stickyMult = new Map<number, number | null>();
    const uncondQ = priceDigitContract("Matches", 5, DUR, ticks, cfg);
    const uncondM = uncondQ.accepted ? uncondQ.payoutMultiplier : null;

    const multFor = (entry: number | null): number | null => {
      if (entry == null) return uncondM;
      if (stickyMult.has(entry)) return stickyMult.get(entry)!;
      const q = priceDigitContract("Matches", 5, DUR, ticks, cfg, 1, entry);
      const m = q.accepted ? q.payoutMultiplier : null;
      stickyMult.set(entry, m);
      return m;
    };

    const simulate = (conditional: boolean): number => {
      let staked = 0, paid = 0;
      for (let i = 0; i + DUR < digits.length; i++) {
        const e = digits[i];
        // Exploiter only bets when entry == target (the sticky edge).
        if (e !== 5) continue;
        const m = multFor(conditional ? e : null);
        if (m == null) continue;
        staked += 1;
        if (digits[i + DUR] === 5) paid += m;
      }
      return staked > 0 ? paid / staked : 0;
    };

    const rtpUncond = simulate(false);
    const rtpCond = simulate(true);
    expect(rtpUncond).toBeGreaterThan(1);
    expect(rtpCond).toBeLessThanOrEqual(1);
  });
});

describe("conditional Differs pricing removes the sticky-digit edge", () => {
  // Differs is the exact complement of Matches (win = exit ≠ target), priced near
  // the 90% cap, so it uses the production Differs config: raised win-prob cap and
  // the thin 2.5% edge floor. On a sticky series a target chosen AWAY from the
  // sticky entry digit wins more than the unconditional ~90% the price assumes.
  const cfgD = { ...cfg, maxWinProb: 0.98, edgeFloor: 0.025 };
  const TARGETS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

  // Conditional P(win | entry) = P(exit ≠ target | entry), one pass over the series.
  const dWins = new Map<string, number>(), dCnt = new Map<string, number>();
  for (let i = 0; i + DUR < digits.length; i++) {
    const e = digits[i], x = digits[i + DUR];
    for (const t of TARGETS) {
      const k = `${t}:${e}`;
      dCnt.set(k, (dCnt.get(k) ?? 0) + 1);
      if (x !== t) dWins.set(k, (dWins.get(k) ?? 0) + 1);
    }
  }
  const condWinD = (t: number, e: number) => (dWins.get(`${t}:${e}`) ?? 0) / (dCnt.get(`${t}:${e}`) ?? 1);

  it("prices Differs on a favorable (non-sticky) target no higher than unconditional", () => {
    // Entry digit 5 on a sticky series ⇒ exit rarely lands on a far digit like 0,
    // so Differs target 0 wins MORE than average; its conditional payout must not
    // exceed the unconditional one.
    const uncond = priceDigitContract("Differs", 0, DUR, ticks, cfgD);
    const cond = priceDigitContract("Differs", 0, DUR, ticks, cfgD, 1, 5);
    // Both may reject (near-certain) — only assert ordering when both priced.
    if (uncond.accepted && cond.accepted) {
      expect(cond.payoutMultiplier).toBeLessThanOrEqual(uncond.payoutMultiplier);
    } else {
      expect(cond.accepted).toBe(false); // conditional never MORE generous
    }
  });

  it("holds Differs RTP ≤ 1 against an adaptive exploiter (vs > 1 unconditionally)", () => {
    const mult = new Map<string, number | null>();
    const multFor = (entry: number, t: number): number | null => {
      const key = `${entry}:${t}`;
      if (mult.has(key)) return mult.get(key)!;
      const q = entry < 0
        ? priceDigitContract("Differs", t, DUR, ticks, cfgD)
        : priceDigitContract("Differs", t, DUR, ticks, cfgD, 1, entry);
      const m = q.accepted ? q.payoutMultiplier : null;
      mult.set(key, m);
      return m;
    };

    const simulate = (conditional: boolean): number => {
      let staked = 0, paid = 0;
      for (let i = 0; i + DUR < digits.length; i++) {
        const e = digits[i];
        let best = { ev: -1, t: 0, m: 0 };
        for (const t of TARGETS) {
          const m = multFor(conditional ? e : -1, t);
          if (m == null) continue;
          const ev = condWinD(t, e) * m;   // exploiter's TRUE conditional EV
          if (ev > best.ev) best = { ev, t, m };
        }
        if (best.ev < 0) continue;
        staked += 1;
        if (digits[i + DUR] !== best.t) paid += best.m;
      }
      return staked > 0 ? paid / staked : 0;
    };

    const rtpUncond = simulate(false);
    const rtpCond = simulate(true);
    expect(rtpUncond).toBeGreaterThan(1);   // unconditional Differs bleeds to the exploiter
    expect(rtpCond).toBeLessThanOrEqual(1); // conditional pricing holds the house edge
  });
});
