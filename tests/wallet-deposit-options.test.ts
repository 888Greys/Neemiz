import { describe, expect, it } from "vitest";
import {
  CRYPTO_DEPOSIT_ASSETS,
  DEPOSIT_METHOD_ROWS,
  VALID_CRYPTO_DEPOSIT_NETWORKS,
} from "@/lib/wallet-deposit-options";

describe("wallet deposit options", () => {
  it("keeps only gas-covered crypto payment methods available", () => {
    const cryptoRows = DEPOSIT_METHOD_ROWS.filter((row) =>
      ["usdt", "btc", "eth", "other"].includes(row.id),
    );

    expect(cryptoRows).toEqual([
      expect.objectContaining({ id: "usdt", enabled: true, soon: false }),
      // BTC pays its miner fee out of the deposited coins (no gas top-up needed).
      expect.objectContaining({ id: "btc", enabled: true, soon: false }),
      expect.objectContaining({ id: "eth", enabled: false, soon: true }),
      expect.objectContaining({ id: "other", enabled: true, soon: false }),
    ]);
  });

  it("hides unavailable partner payment methods from the deposit picker", () => {
    expect(DEPOSIT_METHOD_ROWS.map((row) => row.id)).not.toEqual(
      expect.arrayContaining(["binance", "skrill", "neteller"]),
    );
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
