import { describe, expect, it } from "vitest";
import { kesToPlayUsd, normalizePlayStakeKes, usdToKesWithRates } from "@/lib/play-usd";

describe("usdToKesWithRates", () => {
  it("round-trips common play USD amounts without +$0.01 drift", () => {
    const rates = [{ USD: 129 }, { USD: 129.4 }, { USD: 129.123456 }, { USD: 128.73 }, { USD: 130.17 }];
    const amounts = [1, 5, 10, 25, 50, 100];
    for (const fx of rates) {
      for (const usd of amounts) {
        const kes = usdToKesWithRates(usd, fx);
        expect(kesToPlayUsd(kes, fx)).toBe(usd);
      }
    }
  });

  it("maps whole-dollar FX without inventing cents", () => {
    expect(usdToKesWithRates(1, { USD: 129 })).toBe(129);
    expect(usdToKesWithRates(10, { USD: 129 })).toBe(1290);
  });

  it("uses nearest KES at fractional FX (not ceil, which displayed as $1.01)", () => {
    expect(usdToKesWithRates(1, { USD: 129.4 })).toBe(129);
    expect(kesToPlayUsd(129, { USD: 129.4 })).toBe(1);
  });
});

describe("normalizePlayStakeKes", () => {
  it("bumps a 1-KSh under-min stake up to the floor", () => {
    expect(normalizePlayStakeKes(129, 130, 65_000)).toBe(130);
  });

  it("rejects stakes well below min", () => {
    expect(normalizePlayStakeKes(120, 130, 65_000)).toBeNull();
  });

  it("accepts exact min and max", () => {
    expect(normalizePlayStakeKes(130, 130, 65_000)).toBe(130);
    expect(normalizePlayStakeKes(65_000, 130, 65_000)).toBe(65_000);
  });
});
