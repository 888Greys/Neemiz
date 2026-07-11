import { describe, expect, it, beforeEach } from "vitest";
import { resolveDigitExitTick } from "@/lib/binary/kernel";
import {
  __resetDerivFeedForTests,
  __seedDerivFeedForTests,
  getLatestTick,
  getTicksSince,
  FEED_FRESHNESS_MS,
} from "@/lib/deriv-feed";

const ENTRY = 1_700_000_000;
const tick = (price: number, offset: number) => ({ price, epoch: ENTRY + offset });

describe("deriv feed — getTicksSince continuity", () => {
  beforeEach(() => {
    __resetDerivFeedForTests();
  });

  it("serves ticks after startEpoch when the buffer covers from entry", () => {
    const ticks = [tick(11, 1), tick(12, 2), tick(13, 3), tick(14, 4), tick(15, 5)];
    __seedDerivFeedForTests("1HZ100V", ticks);
    const fromFeed = getTicksSince("1HZ100V", ENTRY);
    expect(fromFeed).toEqual(ticks);
    // Same exit as one-shot history path would produce
    expect(resolveDigitExitTick(fromFeed!, ENTRY, 3)).toEqual(tick(13, 3));
  });

  it("returns null when buffer starts after entry (would miss early ticks)", () => {
    // Buffer only has ticks 4–5; settling duration=3 would mis-count without 1–3.
    __seedDerivFeedForTests("1HZ100V", [tick(14, 4), tick(15, 5)]);
    expect(getTicksSince("1HZ100V", ENTRY)).toBeNull();
  });

  it("returns null while gap-suspect (post-reconnect before backfill)", () => {
    __seedDerivFeedForTests("1HZ100V", [tick(11, 1), tick(12, 2), tick(13, 3)], { gapSuspect: true });
    expect(getTicksSince("1HZ100V", ENTRY)).toBeNull();
    expect(getLatestTick("1HZ100V")).toBeNull();
  });

  it("feed exit tick matches history-path resolveDigitExitTick on fixtures", () => {
    const ticks = [
      tick(101.2, 1),
      tick(101.5, 2),
      tick(102.0, 3),
      tick(99.9, 4),
      tick(100.1, 5),
      tick(100.8, 6),
    ];
    __seedDerivFeedForTests("R_100", ticks);
    const fromFeed = getTicksSince("R_100", ENTRY)!;
    for (const duration of [1, 2, 3, 5, 6]) {
      expect(resolveDigitExitTick(fromFeed, ENTRY, duration)).toEqual(
        resolveDigitExitTick(ticks, ENTRY, duration),
      );
    }
  });
});

describe("deriv feed — getLatestTick freshness", () => {
  beforeEach(() => {
    __resetDerivFeedForTests();
  });

  it("returns the latest tick when fresh", () => {
    const nowSec = Math.floor(Date.now() / 1000);
    __seedDerivFeedForTests("frxEURUSD", [
      { price: 1.08, epoch: nowSec - 2 },
      { price: 1.081, epoch: nowSec },
    ]);
    expect(getLatestTick("frxEURUSD")).toEqual({ price: 1.081, epoch: nowSec });
  });

  it("returns null when the latest tick is older than freshness bound", () => {
    const staleEpoch = Math.floor(Date.now() / 1000) - Math.ceil(FEED_FRESHNESS_MS / 1000) - 2;
    __seedDerivFeedForTests("frxEURUSD", [{ price: 1.08, epoch: staleEpoch }]);
    expect(getLatestTick("frxEURUSD")).toBeNull();
  });
});
