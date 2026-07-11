import { describe, expect, it, vi } from "vitest";
import { lockKesCoinBalance } from "@/lib/p2p/crypto-balance";

/**
 * Mock tx client for lockKesCoinBalance. `promo` = summed promo principal,
 * `deposit` = the real-rail deposit row (null means never funded), `bal` = the
 * user's current walletBalance. Captures updateMany so tests can assert whether
 * the debit was attempted.
 */
function mockTx(bal: number, promo: number, deposit: { id: string } | null) {
  const updateMany = vi.fn().mockResolvedValue({ count: 1 });
  return {
    tx: {
      user: {
        findUnique: vi.fn().mockResolvedValue({ walletBalance: bal }),
        updateMany,
      },
      promoRedemption: { aggregate: vi.fn().mockResolvedValue({ _sum: { amountKes: promo } }) },
      transaction: { findFirst: vi.fn().mockResolvedValue(deposit) },
    } as any,
    updateMany,
  };
}

describe("P2P KES escrow respects the promo deposit-to-withdraw gate", () => {
  it("blocks a never-funded promo account from selling promo credit on P2P", async () => {
    // 50 promo grown to 173 on games, never deposited: whole wallet locked.
    const { tx, updateMany } = mockTx(173, 50, null);
    await expect(lockKesCoinBalance(tx, "u1", 100)).rejects.toThrow("PROMO_LOCKED");
    expect(updateMany).not.toHaveBeenCalled(); // never debits promo funds
  });

  it("allows selling once the account has funded with a real deposit", async () => {
    // Funded: only the 50 principal stays locked, 123 is transferable.
    const { tx, updateMany } = mockTx(173, 50, { id: "dep1" });
    await expect(lockKesCoinBalance(tx, "u1", 100)).resolves.toBeUndefined();
    expect(updateMany).toHaveBeenCalledTimes(1);
  });

  it("does not interfere with non-promo users", async () => {
    const { tx, updateMany } = mockTx(500, 0, null);
    await expect(lockKesCoinBalance(tx, "u1", 400)).resolves.toBeUndefined();
    expect(updateMany).toHaveBeenCalledTimes(1);
  });
});
