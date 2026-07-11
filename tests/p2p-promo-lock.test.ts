import { describe, expect, it, vi } from "vitest";
import { lockKesCoinBalance } from "@/lib/p2p/crypto-balance";

/**
 * Mock tx client for lockKesCoinBalance. `promo` = summed promo principal,
 * `deposit` = the real-rail deposit row (null means never funded), `bal` = the
 * user's current walletBalance, `isAdmin` toggles the admin exemption. Captures
 * updateMany so tests can assert whether the KES debit was attempted.
 */
function mockTx(bal: number, promo: number, deposit: { id: string } | null, isAdmin = false) {
  const updateMany = vi.fn().mockResolvedValue({ count: 1 });
  return {
    tx: {
      user: {
        findUnique: vi.fn().mockResolvedValue({ walletBalance: bal, isAdmin }),
        updateMany,
      },
      promoRedemption: { aggregate: vi.fn().mockResolvedValue({ _sum: { amountKes: promo } }) },
      transaction: { findFirst: vi.fn().mockResolvedValue(deposit) },
    } as any,
    updateMany,
  };
}

describe("P2P KES escrow respects the deposit-to-withdraw gates", () => {
  it("blocks an unfunded account from selling internal credit on P2P (no real deposit)", async () => {
    const { tx, updateMany } = mockTx(173, 50, null);
    await expect(lockKesCoinBalance(tx, "u1", 100)).rejects.toThrow("NO_DEPOSIT_GATE");
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("blocks an unfunded NON-promo mule too (transfer/admin-seeded credit)", async () => {
    // The exact mule vector: no promo, no deposit, balance came from transfers.
    const { tx, updateMany } = mockTx(500, 0, null);
    await expect(lockKesCoinBalance(tx, "u1", 400)).rejects.toThrow("NO_DEPOSIT_GATE");
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("still enforces the promo principal lock once funded", async () => {
    // Funded (deposit present) but promo principal 50 stays locked out of 173.
    const { tx, updateMany } = mockTx(173, 50, { id: "dep1" });
    await expect(lockKesCoinBalance(tx, "u1", 130)).rejects.toThrow("PROMO_LOCKED");
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("allows a funded account to sell its transferable balance", async () => {
    const { tx, updateMany } = mockTx(173, 50, { id: "dep1" });
    await expect(lockKesCoinBalance(tx, "u1", 100)).resolves.toBeUndefined();
    expect(updateMany).toHaveBeenCalledTimes(1);
  });

  it("exempts admins (test/house accounts)", async () => {
    const { tx, updateMany } = mockTx(500, 0, null, true);
    await expect(lockKesCoinBalance(tx, "admin1", 400)).resolves.toBeUndefined();
    expect(updateMany).toHaveBeenCalledTimes(1);
  });
});
