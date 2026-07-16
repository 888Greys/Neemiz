import { describe, expect, it, vi, beforeEach } from "vitest";
import { getTotalKesReservedForMerchant, assertLocalCoinSellBacking } from "@/lib/p2p/ad-backing";
import { isWalletBackedCoin } from "@/lib/p2p/crypto-balance";
import { db } from "@/lib/db";

// Mock @/lib/db
vi.mock("@/lib/db", () => ({
  db: {
    p2PAd: {
      findMany: vi.fn(),
    },
    userCryptoBalance: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    transaction: {
      // No admin grants by default; individual tests override this.
      groupBy: vi.fn().mockResolvedValue([]),
    },
  },
}));

// Mock fx rate feed
vi.mock("@/lib/p2p/fx", () => ({
  getFxRatesToKES: vi.fn().mockResolvedValue({
    toKES: {
      KES: 1,
      TZS: 0.05, // 1 TZS = 0.05 KES
      UGX: 0.03, // 1 UGX = 0.03 KES
    },
  }),
  convertToKES: (amount: number, currency: string, toKES: Record<string, number>) => {
    const rate = toKES[currency];
    if (!rate || rate <= 0) throw new Error("NO_FX_RATE");
    return amount * rate;
  },
}));

describe("P2P Local Coin Backing & Escrow Calculations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("identifies active local coins correctly as wallet-backed", () => {
    expect(isWalletBackedCoin("KES")).toBe(true);
    expect(isWalletBackedCoin("TZS")).toBe(true);
    expect(isWalletBackedCoin("UGX")).toBe(true);
    expect(isWalletBackedCoin("USDT")).toBe(false); // real crypto (not in-app local coin)
  });

  it("getTotalKesReservedForMerchant calculates correct backing and prevents double-counting coin balance", async () => {
    // Merchant has 2 active TZS sell ads: each for 100,000 TZS.
    // Seller fee is 1%. Total need per ad is 101,000 TZS.
    // Merchant holds a total of 150,000 TZS in their user crypto balance.
    // Expected behavior:
    // First ad needs 101,000 TZS. Covered by 150,000 TZS balance. Shortfall = 0. Remaining TZS balance = 49,000 TZS.
    // Second ad needs 101,000 TZS. Covered by remaining 49,000 TZS. Shortfall = 52,000 TZS.
    // 52,000 TZS converted to KES at 0.05 rate = 2,600 KES required.
    
    (db.p2PAd.findMany as any).mockResolvedValue([
      { crypto: "TZS", availableAmount: 100000 },
      { crypto: "TZS", availableAmount: 100000 },
    ]);

    (db.userCryptoBalance.findMany as any).mockResolvedValue([
      { crypto: "TZS", network: "TRC20", available: 150000 }, // TRC20 is default for TZS fallback
    ]);

    const requiredKes = await getTotalKesReservedForMerchant("user-123", "merchant-123");
    
    // First ad shortfall: 0 KES.
    // Second ad shortfall: (101000 - 49000) * 0.05 = 52000 * 0.05 = 2600 KES.
    // Total KES backing required should be exactly 2600 KES.
    expect(requiredKes).toBe(2600);
  });

  it("assertLocalCoinSellBacking rejects ad creation if wallet balance is insufficient", async () => {
    // Proposed ad: 200,000 TZS SELL.
    // Need: 202,000 TZS.
    // Merchant holds: 50,000 TZS.
    // Shortfall: 152,000 TZS -> 152,000 * 0.05 = 7,600 KES.
    // Merchant has no other active ads.
    // Wallet has only 5,000 KES.
    
    (db.p2PAd.findMany as any).mockResolvedValue([]); // no other ads
    (db.userCryptoBalance.findMany as any).mockResolvedValue([
      { crypto: "TZS", network: "TRC20", available: 50000 },
    ]);

    const result = await assertLocalCoinSellBacking({
      userId: "user-123",
      merchantId: "merchant-123",
      walletBalance: 5000,
      crypto: "TZS",
      side: "SELL",
      availableAmount: 200000,
    });

    expect(result).not.toBeNull();
    expect(result?.required).toBe(7600);
    expect(result?.shortfall).toBe(2600);
  });

  it("assertLocalCoinSellBacking passes if wallet balance is sufficient", async () => {
    (db.p2PAd.findMany as any).mockResolvedValue([]);
    (db.userCryptoBalance.findMany as any).mockResolvedValue([
      { crypto: "TZS", network: "TRC20", available: 50000 },
    ]);

    const result = await assertLocalCoinSellBacking({
      userId: "user-123",
      merchantId: "merchant-123",
      walletBalance: 8000, // sufficient to back 7,600 KES shortfall
      crypto: "TZS",
      side: "SELL",
      availableAmount: 200000,
    });

    expect(result).toBeNull();
  });

  it("excludes admin-granted (unbacked) coin from backing so it can't be sold for free", async () => {
    // Merchant holds 150,000 TZS, but ALL of it was admin-granted (phantom).
    // Selling 100,000 TZS (need 101,000) must therefore require real KES backing
    // for the full amount, not treat the granted coin as coverage.
    (db.p2PAd.findMany as any).mockResolvedValue([
      { crypto: "TZS", availableAmount: 100000 },
    ]);
    (db.userCryptoBalance.findMany as any).mockResolvedValue([
      { crypto: "TZS", network: "TRC20", available: 150000 },
    ]);
    // 150,000 TZS were granted → backing-eligible balance is 0.
    (db.transaction.groupBy as any).mockResolvedValue([
      { currency: "TZS", _sum: { amount: 150000 } },
    ]);

    const requiredKes = await getTotalKesReservedForMerchant("user-123", "merchant-123");

    // Full 101,000 TZS shortfall (0 backing) * 0.05 = 5,050 KES required.
    expect(requiredKes).toBe(5050);
  });
});
