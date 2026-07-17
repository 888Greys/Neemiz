import { describe, expect, it } from "vitest";
import { triangulateSpotViaUsd } from "@/lib/p2p/spot";

describe("triangulateSpotViaUsd", () => {
  const toKES = { KES: 1, USD: 129, ALL: 1.4, EUR: 140 };

  it("returns crypto/USD when fiat is USD", () => {
    expect(triangulateSpotViaUsd(1.0, toKES, "USD")).toBe(1);
  });

  it("converts USDT/USD into ALL via FX", () => {
    // 1 USDT = $1 → 129 KES → 129/1.4 ≈ 92.14 ALL
    const rate = triangulateSpotViaUsd(1, toKES, "ALL");
    expect(rate).toBeCloseTo(129 / 1.4, 5);
  });

  it("converts into KES via USD FX", () => {
    expect(triangulateSpotViaUsd(1, toKES, "KES")).toBe(129);
  });

  it("returns null when fiat has no FX rate", () => {
    expect(triangulateSpotViaUsd(1, toKES, "XYZ")).toBeNull();
  });

  it("returns null for non-positive crypto/USD", () => {
    expect(triangulateSpotViaUsd(0, toKES, "ALL")).toBeNull();
  });
});
