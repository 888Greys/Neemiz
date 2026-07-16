import { describe, expect, it } from "vitest";
import {
  CRYPTO_WITHDRAW_ASSETS,
  VALID_CRYPTO_WITHDRAW_NETWORKS,
} from "@/lib/wallet-withdraw-options";

describe("wallet withdraw options", () => {
  it("lists the Polygon stablecoins, native BTC/TRX, native EVM coins, and LTC", () => {
    expect(CRYPTO_WITHDRAW_ASSETS).toEqual([
      expect.objectContaining({ code: "USDT", network: "POLYGON", min: 1 }),
      expect.objectContaining({ code: "USDC", network: "POLYGON", min: 1 }),
      expect.objectContaining({ code: "BTC", network: "BITCOIN" }),
      expect.objectContaining({ code: "TRX", network: "TRC20", min: 10 }),
      expect.objectContaining({ code: "ETH", network: "ERC20" }),
      expect.objectContaining({ code: "BNB", network: "BEP20" }),
      expect.objectContaining({ code: "POL", network: "POLYGON" }),
      expect.objectContaining({ code: "LTC", network: "LITECOIN" }),
    ]);
  });

  it("allows 1 USDT Polygon withdrawals for testing", () => {
    expect(CRYPTO_WITHDRAW_ASSETS).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "USDT",
          network: "POLYGON",
          min: 1,
        }),
      ]),
    );
  });

  it("allows withdrawal only on deposit-enabled networks", () => {
    expect(VALID_CRYPTO_WITHDRAW_NETWORKS).toEqual({
      USDT: ["POLYGON"],
      USDC: ["POLYGON"],
      BTC:  ["BITCOIN"],
      TRX:  ["TRC20"],
      ETH:  ["ERC20"],
      BNB:  ["BEP20"],
      POL:  ["POLYGON"],
      LTC:  ["LITECOIN"],
    });
  });
});
