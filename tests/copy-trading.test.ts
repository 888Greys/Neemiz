import { describe, expect, it } from "vitest";
import {
  computeFollowerStakeKes,
  familyTokenForDigit,
  familyTokenForDirectional,
  isMvpCopyableFamily,
  MIN_COPY_DURATION_TICKS,
  MVP_COPYABLE_FAMILIES,
  parseAllowedFamilies,
} from "@/lib/copy-trading";

describe("copy trading MVP gates", () => {
  it("allows Even/Odd and Rise/Fall family tokens only", () => {
    expect(isMvpCopyableFamily(familyTokenForDigit("Even"))).toBe(true);
    expect(isMvpCopyableFamily(familyTokenForDigit("Odd"))).toBe(true);
    expect(isMvpCopyableFamily(familyTokenForDirectional("RISE_FALL"))).toBe(true);
    expect(isMvpCopyableFamily(familyTokenForDigit("Matches"))).toBe(false);
    expect(isMvpCopyableFamily(familyTokenForDirectional("VANILLA"))).toBe(false);
    expect(MVP_COPYABLE_FAMILIES).toHaveLength(3);
  });

  it("requires duration >= 5 ticks for survivable follower fill lag", () => {
    expect(MIN_COPY_DURATION_TICKS).toBe(5);
  });

  it("parses allowedFamilies CSV", () => {
    const set = parseAllowedFamilies("binary:Even, binary:Odd ,directional:RISE_FALL");
    expect(set.has("binary:Even")).toBe(true);
    expect(set.has("binary:Odd")).toBe(true);
    expect(set.has("directional:RISE_FALL")).toBe(true);
    expect(set.size).toBe(3);
  });
});

describe("computeFollowerStakeKes", () => {
  const base = {
    stakeMode: "FIXED" as const,
    fixedStakeKes: 200,
    percent: 100,
    maxStakeKes: 500,
  };

  it("uses fixed stake clamped to min / max / platform", () => {
    expect(computeFollowerStakeKes(base, 1000, 100, 10_000)).toBe(200);
    expect(computeFollowerStakeKes({ ...base, fixedStakeKes: 50 }, 1000, 100, 10_000)).toBe(100);
    expect(computeFollowerStakeKes({ ...base, fixedStakeKes: 800, maxStakeKes: 500 }, 1000, 100, 10_000)).toBe(500);
    expect(computeFollowerStakeKes({ ...base, fixedStakeKes: 800, maxStakeKes: 2000 }, 1000, 100, 600)).toBe(600);
  });

  it("scales percent of leader stake then clamps", () => {
    const pct = { ...base, stakeMode: "PERCENT_OF_LEADER" as const, percent: 50, maxStakeKes: 1000 };
    expect(computeFollowerStakeKes(pct, 400, 100, 10_000)).toBe(200);
    expect(computeFollowerStakeKes({ ...pct, percent: 10 }, 400, 100, 10_000)).toBe(100); // min
    expect(computeFollowerStakeKes({ ...pct, percent: 500, maxStakeKes: 300 }, 400, 100, 10_000)).toBe(300);
  });
});
