import { describe, expect, it } from "vitest";
import {
  CRYPTO_WITHDRAW_ASSETS,
  VALID_CRYPTO_WITHDRAW_NETWORKS,
} from "@/lib/wallet-withdraw-options";

describe("wallet withdraw options", () => {
  it("lists Polygon+BSC stables and native BTC/TRX/ETH/BNB/POL (UTXO natives deposit-only)", () => {
    const codes = CRYPTO_WITHDRAW_ASSETS.map((a) => `${a.code}:${a.network}`);
    expect(codes).toEqual([
      "USDT:POLYGON", "USDC:POLYGON", "BTC:BITCOIN", "TRX:TRC20",
      "USDT:BEP20", "ETH:ERC20", "BNB:BEP20", "POL:POLYGON",
    ]);
    // LTC/DOGE/BCH deposit works, but withdrawal waits on the UTXO signer; SOL/XRP unlisted.
    for (const c of ["LTC", "DOGE", "BCH", "SOL", "XRP"]) {
      expect(codes.some((x) => x.startsWith(`${c}:`))).toBe(false);
    }
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
      USDT: ["POLYGON", "BEP20"],
      USDC: ["POLYGON"],
      BTC:  ["BITCOIN"],
      TRX:  ["TRC20"],
      ETH:  ["ERC20"],
      BNB:  ["BEP20"],
      POL:  ["POLYGON"],
    });
  });
});
