import { describe, expect, it } from "vitest";
import {
  CRYPTO_DEPOSIT_ASSETS,
  DEPOSIT_METHOD_ROWS,
  depositRowsForCurrency,
  VALID_CRYPTO_DEPOSIT_NETWORKS,
} from "@/lib/wallet-deposit-options";
import { MARKETS, methodsForCurrency } from "@/lib/payments/country-methods";

describe("wallet deposit options", () => {
  it("offers a single Crypto method instead of per-coin rows", () => {
    const rows = depositRowsForCurrency("USD", { pesapalEnabled: false });
    const byId = Object.fromEntries(rows.map((r) => [r.id, r]));
    expect(byId["crypto"]).toMatchObject({
      enabled: true,
      soon: false,
      label: "Crypto",
      selection: { kind: "crypto" },
    });
    expect(byId["crypto-USDT"]).toBeUndefined();
    expect(byId["crypto-BTC"]).toBeUndefined();
    expect(byId["crypto-USDC"]).toBeUndefined();
    expect(byId["crypto-ETH"]).toBeUndefined();
  });

  it("shows Kenya MoMo live and Brazil Pix as soon, and hides card for now", () => {
    const kes = depositRowsForCurrency("KES", { pesapalEnabled: true });
    expect(kes.find((r) => r.id === "mpesa")).toMatchObject({ enabled: true });
    expect(kes.find((r) => r.id === "card")).toBeUndefined();
    const brl = depositRowsForCurrency("BRL", { pesapalEnabled: false });
    expect(brl.find((r) => r.code === "PIX")).toMatchObject({ enabled: false, soon: true });
    expect(brl.find((r) => r.id === "card")).toBeUndefined();
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
    // Live assets: the three stables/BTC plus native TRX (self-paying, signer live).
    expect(CRYPTO_DEPOSIT_ASSETS.filter((a) => a.enabled)).toEqual([
      expect.objectContaining({ code: "USDT", network: "POLYGON", enabled: true }),
      expect.objectContaining({ code: "USDC", network: "POLYGON", enabled: true }),
      expect.objectContaining({ code: "BTC", network: "BITCOIN", enabled: true }),
      expect.objectContaining({ code: "TRX", network: "TRC20", enabled: true }),
    ]);
  });

  it("keeps the still-unwired natives as coming soon (never live until wired)", () => {
    const soon = CRYPTO_DEPOSIT_ASSETS.filter((a) => a.soon).map((a) => a.code);
    for (const code of ["ETH", "BNB", "POL", "SOL", "LTC", "XRP", "DOGE", "BCH"]) {
      expect(soon).toContain(code);
    }
    // TRX is now live, so it must NOT be in the soon set.
    expect(soon).not.toContain("TRX");
    // Every soon asset must be disabled (no accidental live listing).
    expect(CRYPTO_DEPOSIT_ASSETS.filter((a) => a.soon).every((a) => !a.enabled)).toBe(true);
  });

  it("allows address generation for live rails only (TRX now included, others not)", () => {
    expect(VALID_CRYPTO_DEPOSIT_NETWORKS.USDT).toContain("POLYGON");
    expect(VALID_CRYPTO_DEPOSIT_NETWORKS.USDT).not.toContain("BEP20");
    expect(VALID_CRYPTO_DEPOSIT_NETWORKS.USDC).toEqual(["POLYGON"]);
    expect(VALID_CRYPTO_DEPOSIT_NETWORKS.BTC).toEqual(["BITCOIN"]);
    expect(VALID_CRYPTO_DEPOSIT_NETWORKS.TRX).toEqual(["TRC20"]);
    // Still-unwired natives must have no address-generation allowlist entry yet.
    for (const code of ["ETH", "BNB", "POL", "SOL", "LTC", "XRP", "DOGE", "BCH"]) {
      expect(VALID_CRYPTO_DEPOSIT_NETWORKS[code]).toBeUndefined();
    }
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
