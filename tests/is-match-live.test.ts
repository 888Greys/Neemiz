import { describe, expect, it, vi, afterEach } from "vitest";
import { isMatchLive, MAX_LIVE_MS } from "@/lib/theoddsapi";

const iso = (msFromNow: number) => new Date(Date.now() + msFromNow).toISOString();

describe("isMatchLive", () => {
  afterEach(() => vi.useRealTimers());

  it("is not live with no score record", () => {
    expect(isMatchLive(iso(-60_000), undefined)).toBe(false);
    expect(isMatchLive(iso(-60_000), null)).toBe(false);
  });

  it("is not live before kickoff", () => {
    expect(isMatchLive(iso(60 * 60_000), { completed: false })).toBe(false);
  });

  it("is live once kicked off and not completed", () => {
    expect(isMatchLive(iso(-30 * 60_000), { completed: false })).toBe(true);
  });

  it("is not live when completed", () => {
    expect(isMatchLive(iso(-30 * 60_000), { completed: true })).toBe(false);
  });

  it("drops back to not-live once aged past the max window, even if completed never flips", () => {
    // The real-world bug: TheOddsAPI leaves `completed:false` on a finished game,
    // which used to leave it stuck showing LIVE the next morning.
    expect(isMatchLive(iso(-(MAX_LIVE_MS + 60_000)), { completed: false })).toBe(false);
  });
});
