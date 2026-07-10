import { describe, expect, it } from "vitest";
import {
  CRYPTO_DEPOSIT_ASSETS,
  DEPOSIT_METHOD_ROWS,
  depositRowsForCurrency,
  VALID_CRYPTO_DEPOSIT_NETWORKS,
} from "@/lib/wallet-deposit-options";
import { MARKETS, methodsForCurrency } from "@/lib/payments/country-methods";

describe("wallet deposit options", () => {
  it("keeps gas-covered crypto methods available internationally", () => {
    const rows = depositRowsForCurrency("USD", { pesapalEnabled: false });
    const byId = Object.fromEntries(rows.map((r) => [r.id, r]));
    expect(byId["crypto-USDT"]).toMatchObject({ enabled: true, soon: false });
    expect(byId["crypto-BTC"]).toMatchObject({ enabled: true, soon: false });
    expect(byId["crypto-ETH"]).toMatchObject({ enabled: false, soon: true });
    expect(byId["crypto-USDC"]).toMatchObject({ enabled: true, soon: false });
  });

  it("shows Kenya MoMo live and Brazil Pix as soon", () => {
    const kes = depositRowsForCurrency("KES", { pesapalEnabled: true });
    expect(kes.find((r) => r.id === "mpesa")).toMatchObject({ enabled: true });
    const brl = depositRowsForCurrency("BRL", { pesapalEnabled: false });
    expect(brl.find((r) => r.code === "PIX")).toMatchObject({ enabled: false, soon: true });
  });

  it("keeps legacy DEPOSIT_METHOD_ROWS export usable", () => {
    expect(DEPOSIT_METHOD_ROWS.some((r) => r.id === "mpesa")).toBe(true);
  });

  it("offers Polygon USDT first because POL gas funds those withdrawals", () => {
    expect(CRYPTO_DEPOSIT_ASSETS[0]).toMatchObject({
      code: "USDT",
      network: "POLYGON",
      displayNet: "Polygon",
    });

    expect(CRYPTO_DEPOSIT_ASSETS).toEqual([
      expect.objectContaining({ code: "USDT", network: "POLYGON", min: 1, enabled: true, soon: false }),
      expect.objectContaining({ code: "USDT", network: "BEP20", min: 1, enabled: false, soon: true }),
      expect.objectContaining({ code: "USDC", network: "POLYGON", min: 1, enabled: true, soon: false }),
      expect.objectContaining({ code: "BTC", network: "BITCOIN", enabled: true, soon: false }),
    ]);
  });

  it("allows the address API to generate gas-covered stablecoin deposit addresses", () => {
    expect(VALID_CRYPTO_DEPOSIT_NETWORKS.USDT).toContain("POLYGON");
    expect(VALID_CRYPTO_DEPOSIT_NETWORKS.USDT).not.toContain("BEP20");
    expect(VALID_CRYPTO_DEPOSIT_NETWORKS.USDC).toEqual(["POLYGON"]);
    expect(VALID_CRYPTO_DEPOSIT_NETWORKS.BTC).toEqual(["BITCOIN"]);
  });
});

describe("international payment catalogue", () => {
  it("covers major markets from the reference survey", () => {
    const codes = new Set(MARKETS.map((m) => m.currency));
    for (const c of ["USD", "EUR", "KES", "NGN", "BRL", "INR", "CNY", "JPY", "CAD", "GBP"]) {
      expect(codes.has(c)).toBe(true);
    }
  });

  it("maps Kenya to M-Pesa and Brazil to Pix", () => {
    expect(methodsForCurrency("KES")).toContain("MPESA");
    expect(methodsForCurrency("BRL")).toContain("PIX");
    expect(methodsForCurrency("INR")).toContain("UPI");
  });

  it("lists the full world country set for the picker", async () => {
    const { WORLD_COUNTRIES } = await import("@/lib/payments/world-countries");
    expect(WORLD_COUNTRIES.length).toBeGreaterThan(180);
    expect(WORLD_COUNTRIES.some((c) => c.code === "KE" && c.currency === "KES")).toBe(true);
    expect(WORLD_COUNTRIES.some((c) => c.code === "BR" && c.currency === "BRL")).toBe(true);
    expect(WORLD_COUNTRIES.some((c) => c.code === "FR" && c.currency === "EUR")).toBe(true);
  });
});
