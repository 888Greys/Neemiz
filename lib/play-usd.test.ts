import { describe, expect, it } from "vitest";
import { normalizePlayStakeKes, usdToKesWithRates } from "@/lib/play-usd";

describe("usdToKesWithRates", () => {
  it("ceils fractional FX so $1 never lands under the API floor", () => {
    expect(usdToKesWithRates(1, { USD: 129.4 })).toBe(130);
    expect(usdToKesWithRates(1, { USD: 129 })).toBe(129);
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
