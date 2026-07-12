import { describe, expect, it, vi, beforeEach } from "vitest";
import { grantFirstDepositBonus, FIRST_DEPOSIT_BONUS_CODE } from "@/lib/first-deposit-bonus";
import { readFileSync, existsSync } from "node:fs";

/**
 * Mock a transaction client for grantFirstDepositBonus.
 *  - priorDeposits: what transaction.count resolves to (prior COMPLETED real deposits)
 *  - hasPromo: whether the FIRSTDEPOSIT promo code row exists
 *  - alreadyRedeemed: whether the user already has the bonus redemption
 */
function mockTx(opts: { priorDeposits: number; hasPromo?: boolean; alreadyRedeemed?: boolean }) {
  const redemptionCreate = vi.fn().mockResolvedValue({ id: "r1" });
  const userUpdate = vi.fn().mockResolvedValue({});
  const txCreate = vi.fn().mockResolvedValue({});
  const tx = {
    transaction: {
      count: vi.fn().mockResolvedValue(opts.priorDeposits),
      create: txCreate,
    },
    promoCode: {
      findUnique: vi.fn().mockResolvedValue(opts.hasPromo === false ? null : { id: "promo_first_deposit" }),
    },
    promoRedemption: {
      findUnique: vi.fn().mockResolvedValue(opts.alreadyRedeemed ? { id: "r0" } : null),
      create: redemptionCreate,
    },
    user: { update: userUpdate },
  } as any;
  return { tx, redemptionCreate, userUpdate, txCreate };
}

describe("first-deposit bonus", () => {
  beforeEach(() => {
    delete process.env.FIRST_DEPOSIT_BONUS_PCT;
    delete process.env.FIRST_DEPOSIT_BONUS_CAP_KES;
  });

  it("grants 50% on the first real deposit (100 -> 50)", async () => {
    const { tx, redemptionCreate, userUpdate } = mockTx({ priorDeposits: 0 });
    const bonus = await grantFirstDepositBonus(tx, "u1", 100, "dep1");
    expect(bonus).toBe(50);
    // Recorded as a promo redemption (the play-only lock + once-per-user guard).
    expect(redemptionCreate).toHaveBeenCalledWith({
      data: { promoCodeId: "promo_first_deposit", userId: "u1", amountKes: 50 },
    });
    // Credited to the wallet.
    expect(userUpdate).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: { walletBalance: { increment: 50 } },
    });
  });

  it("does NOT grant on a second deposit (prior deposit exists)", async () => {
    const { tx, redemptionCreate, userUpdate } = mockTx({ priorDeposits: 1 });
    const bonus = await grantFirstDepositBonus(tx, "u1", 100, "dep2");
    expect(bonus).toBe(0);
    expect(redemptionCreate).not.toHaveBeenCalled();
    expect(userUpdate).not.toHaveBeenCalled();
  });

  it("does NOT double-grant if the redemption already exists", async () => {
    const { tx, redemptionCreate } = mockTx({ priorDeposits: 0, alreadyRedeemed: true });
    const bonus = await grantFirstDepositBonus(tx, "u1", 100, "dep1");
    expect(bonus).toBe(0);
    expect(redemptionCreate).not.toHaveBeenCalled();
  });

  it("caps the bonus (10,000 deposit -> 5,000 cap, not 5,000+)", async () => {
    const { tx } = mockTx({ priorDeposits: 0 });
    const bonus = await grantFirstDepositBonus(tx, "u1", 10_000, "dep1");
    expect(bonus).toBe(5000);
  });

  it("no-ops gracefully when the promo code row is missing (migration not applied)", async () => {
    const { tx, redemptionCreate } = mockTx({ priorDeposits: 0, hasPromo: false });
    const bonus = await grantFirstDepositBonus(tx, "u1", 100, "dep1");
    expect(bonus).toBe(0);
    expect(redemptionCreate).not.toHaveBeenCalled();
  });

  it("ships a migration that seeds the inactive FIRSTDEPOSIT code", () => {
    const path = "prisma/migrations/20260713010000_first_deposit_bonus_code/migration.sql";
    expect(existsSync(path)).toBe(true);
    const sql = readFileSync(path, "utf8");
    expect(sql).toContain(FIRST_DEPOSIT_BONUS_CODE);
    expect(sql).toContain("false"); // seeded inactive so it can't be typed in
  });
});
