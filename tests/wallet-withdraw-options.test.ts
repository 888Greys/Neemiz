import { describe, expect, it } from "vitest";
import {
  CRYPTO_WITHDRAW_ASSETS,
  VALID_CRYPTO_WITHDRAW_NETWORKS,
} from "@/lib/wallet-withdraw-options";

describe("wallet withdraw options", () => {
  it("lists the Polygon stablecoins plus native Bitcoin", () => {
    expect(CRYPTO_WITHDRAW_ASSETS).toEqual([
      expect.objectContaining({
        code: "USDT",
        network: "POLYGON",
        min: 1,
      }),
      expect.objectContaining({
        code: "USDC",
        network: "POLYGON",
        min: 1,
      }),
      expect.objectContaining({
        code: "BTC",
        network: "BITCOIN",
      }),
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

  it("blocks withdrawal networks that are not currently deposit-enabled", () => {
    expect(VALID_CRYPTO_WITHDRAW_NETWORKS).toEqual({
      USDT: ["POLYGON"],
      USDC: ["POLYGON"],
      BTC:  ["BITCOIN"],
    });
  });
});
