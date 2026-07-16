import { describe, expect, it, vi, beforeEach } from "vitest";
import { recalcMerchantAdAmounts } from "@/lib/p2p/ad-backing";
import { isWalletBackedCoin } from "@/lib/p2p/crypto-balance";
import { db } from "@/lib/db";

// Mock @/lib/db
vi.mock("@/lib/db", () => ({
  db: {
    merchantProfile: {
      findUnique: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    userCryptoBalance: {
      findUnique: vi.fn(),
    },
    p2PAd: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
    transaction: {
      // No admin grants by default; individual tests override this.
      groupBy: vi.fn().mockResolvedValue([]),
    },
  },
}));

describe("P2P Local Coin Escrow Definitions & Ad Recalculation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // clearAllMocks doesn't reset mockResolvedValue implementations, so re-assert
    // the default (no admin grants) before every test; grant tests override it.
    (db.transaction.groupBy as any).mockResolvedValue([]);
  });

  it("identifies active local coins correctly as wallet-backed", () => {
    expect(isWalletBackedCoin("KES")).toBe(true);
    expect(isWalletBackedCoin("TZS")).toBe(true);
    expect(isWalletBackedCoin("UGX")).toBe(true);
    expect(isWalletBackedCoin("USDT")).toBe(false); // real crypto (not in-app local coin)
  });

  it("recalcMerchantAdAmounts does not update ads if availableAmount is <= freeBalance", async () => {
    (db.merchantProfile.findUnique as any).mockResolvedValue({ userId: "user-123" });
    (db.user.findUnique as any).mockResolvedValue({ walletBalance: 5000 });
    (db.p2PAd.findMany as any).mockResolvedValue([
      { id: "ad-1", availableAmount: 3000 },
      { id: "ad-2", availableAmount: 4000 },
    ]);

    await recalcMerchantAdAmounts("merchant-123", "KES");

    expect(db.p2PAd.update).not.toHaveBeenCalled();
  });

  it("recalcMerchantAdAmounts updates or deactivates ads if availableAmount is > freeBalance", async () => {
    (db.merchantProfile.findUnique as any).mockResolvedValue({ userId: "user-123" });
    (db.user.findUnique as any).mockResolvedValue({ walletBalance: 2000 });
    (db.p2PAd.findMany as any).mockResolvedValue([
      { id: "ad-1", availableAmount: 3000 },
      { id: "ad-2", availableAmount: 1500 }, // untouched
    ]);

    await recalcMerchantAdAmounts("merchant-123", "KES");

    expect(db.p2PAd.update).toHaveBeenCalledTimes(1);
    expect(db.p2PAd.update).toHaveBeenCalledWith({
      where: { id: "ad-1" },
      data: { availableAmount: 2000 },
    });
  });

  it("recalcMerchantAdAmounts deactivates ads if freeBalance <= 0", async () => {
    (db.merchantProfile.findUnique as any).mockResolvedValue({ userId: "user-123" });
    (db.user.findUnique as any).mockResolvedValue({ walletBalance: 0 });
    (db.p2PAd.findMany as any).mockResolvedValue([
      { id: "ad-1", availableAmount: 3000 },
    ]);

    await recalcMerchantAdAmounts("merchant-123", "KES");

    expect(db.p2PAd.update).toHaveBeenCalledWith({
      where: { id: "ad-1" },
      data: { isActive: false, availableAmount: 0 },
    });
  });

  it("excludes admin-granted (unbacked) coin from free balance when capping ads", async () => {
    (db.merchantProfile.findUnique as any).mockResolvedValue({ userId: "user-123" });
    (db.userCryptoBalance.findUnique as any).mockResolvedValue({ available: 150000 });
    // 50,000 TZS were admin-granted -> backing-eligible balance is 100,000 TZS.
    (db.transaction.groupBy as any).mockResolvedValue([
      { currency: "TZS", _sum: { amount: 50000 } },
    ]);
    (db.p2PAd.findMany as any).mockResolvedValue([
      { id: "ad-1", availableAmount: 120000 },
    ]);

    await recalcMerchantAdAmounts("merchant-123", "TZS");

    expect(db.p2PAd.update).toHaveBeenCalledWith({
      where: { id: "ad-1" },
      data: { availableAmount: 100000 },
    });
  });
});
