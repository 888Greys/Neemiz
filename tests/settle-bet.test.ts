import { describe, it, expect } from "vitest";
import { isStaleUnsettleable } from "@/lib/settle-bet";

// Guards for the settle cron's auto-void of dead PENDING bets. The invariant
// that matters: never refund a loser during an API outage, and never void a bet
// young enough that its result may still arrive.
describe("isStaleUnsettleable — safe stale-bet auto-void", () => {
  const DAY = 86_400_000;
  const now = 1_700_000_000_000; // fixed epoch (Date.now() is unavailable in workflows anyway)

  it("voids a bet older than the window when the feed is healthy", () => {
    expect(isStaleUnsettleable({
      createdAtMs: now - 8 * DAY, nowMs: now, feedHealthy: true, alreadySettleable: false,
    })).toBe(true);
  });

  it("NEVER voids when the feed is unhealthy (outage → every bet looks stuck)", () => {
    expect(isStaleUnsettleable({
      createdAtMs: now - 30 * DAY, nowMs: now, feedHealthy: false, alreadySettleable: false,
    })).toBe(false);
  });

  it("never voids a bet younger than the window (result may still arrive)", () => {
    expect(isStaleUnsettleable({
      createdAtMs: now - 2 * DAY, nowMs: now, feedHealthy: true, alreadySettleable: false,
    })).toBe(false);
  });

  it("defaults the stale window to 3 days", () => {
    expect(isStaleUnsettleable({
      createdAtMs: now - 4 * DAY, nowMs: now, feedHealthy: true, alreadySettleable: false,
    })).toBe(true);
    expect(isStaleUnsettleable({
      createdAtMs: now - 2 * DAY, nowMs: now, feedHealthy: true, alreadySettleable: false,
    })).toBe(false);
  });

  it("never voids a bet that is settleable this run", () => {
    expect(isStaleUnsettleable({
      createdAtMs: now - 30 * DAY, nowMs: now, feedHealthy: true, alreadySettleable: true,
    })).toBe(false);
  });

  it("respects a custom staleDays threshold", () => {
    expect(isStaleUnsettleable({
      createdAtMs: now - 4 * DAY, nowMs: now, feedHealthy: true, alreadySettleable: false, staleDays: 3,
    })).toBe(true);
    expect(isStaleUnsettleable({
      createdAtMs: now - 2 * DAY, nowMs: now, feedHealthy: true, alreadySettleable: false, staleDays: 3,
    })).toBe(false);
  });
});
