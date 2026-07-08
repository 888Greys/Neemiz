import { describe, expect, it } from "vitest";
import { resolveDigitExitTick, digitWonFromQuote } from "@/lib/binary/kernel";
import { guardedContracts } from "@/lib/binary/rtp-guard";

// The exploit this pins shut: a digit contract must settle on the DETERMINISTIC
// exit tick (the durationTicks-th tick after its committed entryEpoch), never on
// "the latest live tick when the client asks to settle". If settlement could use
// the latest tick, a player watching the feed would just wait for a favourable
// digit — which is exactly how Over/Under bled at 130-155% RTP.

const ENTRY = 1_700_000_000;
const tick = (price: number, offset: number) => ({ price, epoch: ENTRY + offset });

describe("resolveDigitExitTick — deterministic exit tick, not the latest", () => {
  it("selects the durationTicks-th tick strictly after entry", () => {
    const ticks = [tick(11, 1), tick(12, 2), tick(13, 3), tick(14, 4), tick(15, 5)];
    expect(resolveDigitExitTick(ticks, ENTRY, 3)).toEqual(tick(13, 3));
    expect(resolveDigitExitTick(ticks, ENTRY, 1)).toEqual(tick(11, 1));
  });

  it("does NOT return the latest tick when more ticks have streamed in", () => {
    // Committed exit is the 3rd tick (epoch +3). Ticks +4/+5 are 'latest' — the
    // tick a shopper would try to settle on. Settlement must ignore them.
    const ticks = [tick(11, 1), tick(12, 2), tick(13, 3), tick(99, 4), tick(98, 5)];
    const exit = resolveDigitExitTick(ticks, ENTRY, 3);
    expect(exit).toEqual(tick(13, 3));
    expect(exit).not.toEqual(ticks[ticks.length - 1]); // never the latest
  });

  it("returns null until the exit tick exists (keeps the trade PENDING)", () => {
    const ticks = [tick(11, 1), tick(12, 2)];
    expect(resolveDigitExitTick(ticks, ENTRY, 5)).toBeNull();
  });

  it("ignores ticks at or before the entry epoch", () => {
    const ticks = [tick(1, -2), tick(2, -1), tick(3, 0), tick(44, 1), tick(55, 2)];
    // Only +1 and +2 count as forward ticks, so the 2nd forward tick is +2.
    expect(resolveDigitExitTick(ticks, ENTRY, 2)).toEqual(tick(55, 2));
    expect(resolveDigitExitTick(ticks, ENTRY, 3)).toBeNull();
  });

  it("is order-independent (sorts by epoch before selecting)", () => {
    const ticks = [tick(15, 5), tick(13, 3), tick(11, 1), tick(14, 4), tick(12, 2)];
    expect(resolveDigitExitTick(ticks, ENTRY, 4)).toEqual(tick(14, 4));
  });

  it("skips non-finite / non-positive prices", () => {
    const ticks = [tick(11, 1), tick(0, 2), tick(NaN, 3), tick(14, 4), tick(15, 5)];
    // Valid forward ticks are +1, +4, +5 → the 2nd valid one is +4.
    expect(resolveDigitExitTick(ticks, ENTRY, 2)).toEqual(tick(14, 4));
  });
});

describe("digit outcome is decided by the committed exit tick", () => {
  it("wins/loses on the committed tick's digit, regardless of later ticks", () => {
    // Integer prices → last-digit 0 (even). Committed exit is the 2nd tick.
    const ticks = [tick(11, 1), tick(20, 2), tick(37, 3)];
    const exit = resolveDigitExitTick(ticks, ENTRY, 2)!;
    expect(digitWonFromQuote("Even", 0, exit.price)).toBe(true);  // digit 0 is even
    expect(digitWonFromQuote("Odd", 0, exit.price)).toBe(false);
    expect(digitWonFromQuote("Under", 5, exit.price)).toBe(true); // 0 < 5
  });
});

describe("RTP guard coverage — digit sides are no longer a blind spot", () => {
  it("watches every digit side under the binary namespace", () => {
    const tokens = new Set(guardedContracts().map((c) => `${c.game}:${c.key}`));
    for (const side of ["Even", "Odd", "Matches", "Differs", "Over", "Under"]) {
      expect(tokens.has(`binary:${side}`)).toBe(true);
    }
    // Directional kinds still covered too.
    expect(tokens.has("directional:RISE_FALL")).toBe(true);
    expect(tokens.has("directional:TOUCH_NO_TOUCH")).toBe(true);
  });
});
