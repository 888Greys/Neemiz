import { describe, expect, it } from "vitest";
import {
  LOCAL_COINS,
  ACTIVE_LOCAL_COINS,
  isActiveLocalCoin,
  localCoinName,
  localCoinForCurrency,
} from "@/lib/p2p/local-coins";

describe("local coins registry", () => {
  it("only KES is live today (others need per-currency wallets)", () => {
    expect(ACTIVE_LOCAL_COINS.map((c) => c.currency)).toEqual(["KES"]);
    expect(isActiveLocalCoin("KES")).toBe(true);
    expect(isActiveLocalCoin("kes")).toBe(true); // case-insensitive
    expect(isActiveLocalCoin("UGX")).toBe(false); // defined but not active
    expect(isActiveLocalCoin("BTC")).toBe(false);
  });

  it("defines the country coins the owner asked for (UG/TZ, etc.)", () => {
    const byCur = Object.fromEntries(LOCAL_COINS.map((c) => [c.currency, c.name]));
    expect(byCur.UGX).toBe("UG Coin");
    expect(byCur.TZS).toBe("TZ Coin");
    expect(byCur.KES).toBe("KES Coin");
  });

  it("derives a display name per currency", () => {
    expect(localCoinName("UGX")).toBe("UG Coin");
    expect(localCoinName("KES")).toBe("KES Coin");
    expect(localCoinName("XYZ")).toBe("XYZ Coin"); // graceful fallback
  });

  it("looks up a coin by currency", () => {
    expect(localCoinForCurrency("TZS")?.region).toBe("Tanzania");
    expect(localCoinForCurrency("nope")).toBeNull();
  });
});
