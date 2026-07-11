import { describe, expect, it, vi } from "vitest";
import { normalizePromoCode } from "@/lib/promo-redeem";
import { getPromoLockedKes, REAL_DEPOSIT_PROVIDERS } from "@/lib/promo-lock";
import { readFileSync, existsSync } from "node:fs";

/**
 * Build a mock LockClient. `promo` is the summed promo principal; `deposit` is
 * the row (or null) that transaction.findFirst resolves to — non-null means the
 * account has funded via a real rail. Captures the findFirst `where` so tests
 * can assert the provider filter.
 */
function mockClient(promo: number, deposit: { id: string } | null) {
  const findFirst = vi.fn().mockResolvedValue(deposit);
  return {
    client: {
      promoRedemption: { aggregate: vi.fn().mockResolvedValue({ _sum: { amountKes: promo } }) },
      transaction: { findFirst },
    } as any,
    findFirst,
  };
}

describe("promo codes", () => {
  it("normalizes codes to uppercase without spaces", () => {
    expect(normalizePromoCode("  nezeem 400 ")).toBe("NEZEEM400");
    expect(normalizePromoCode("Nezeem400")).toBe("NEZEEM400");
  });

  it("ships a migration that seeds NEZEEM400 at KSh 50", () => {
    const path = "prisma/migrations/20260710120000_promo_codes/migration.sql";
    expect(existsSync(path)).toBe(true);
    const sql = readFileSync(path, "utf8");
    expect(sql).toContain("NEZEEM400");
    expect(sql).toContain("50.00");
    expect(sql).toContain("promo_codes");
    expect(sql).toContain("promo_redemptions");
  });

  it("ships a migration that seeds KIP100 and SILAS50", () => {
    const path = "prisma/migrations/20260710160000_promo_kip100_silas50/migration.sql";
    expect(existsSync(path)).toBe(true);
    const sql = readFileSync(path, "utf8");
    expect(sql).toContain("KIP100");
    expect(sql).toContain("SILAS50");
    expect(sql).toContain("50.00");
  });

  it("sets both KIP100 and SILAS50 to KSh 50", () => {
    const path = "prisma/migrations/20260710170000_promo_kip_silas_50/migration.sql";
    expect(existsSync(path)).toBe(true);
    const sql = readFileSync(path, "utf8");
    expect(sql).toContain("KIP100");
    expect(sql).toContain("SILAS50");
    expect(sql).toContain("50.00");
  });

  it("accepts Kip100 / Silas50 casing", () => {
    expect(normalizePromoCode("Kip100")).toBe("KIP100");
    expect(normalizePromoCode("Silas50")).toBe("SILAS50");
  });

  it("exposes redeem + admin create routes", () => {
    expect(existsSync("app/api/promo/redeem/route.ts")).toBe(true);
    expect(existsSync("app/api/admin/promo/route.ts")).toBe(true);
    expect(existsSync("lib/promo-redeem.ts")).toBe(true);
  });

  describe("deposit-to-withdraw gate", () => {
    it("locks the ENTIRE wallet when promo was redeemed and no real deposit", async () => {
      // Farm scenario: 50 promo grown to 173 on games, never deposited.
      const { client } = mockClient(50, null);
      const locked = await getPromoLockedKes(client, "u1", 173);
      expect(locked).toBe(173); // transferable = 173 - 173 = 0
    });

    it("relaxes to just the promo principal after a real deposit", async () => {
      const { client } = mockClient(50, { id: "dep1" });
      const locked = await getPromoLockedKes(client, "u1", 173);
      expect(locked).toBe(50); // transferable = 173 - 50 = 123
    });

    it("does not lock at all when no promo was redeemed", async () => {
      const { client } = mockClient(0, null);
      const locked = await getPromoLockedKes(client, "u1", 500);
      expect(locked).toBe(0);
    });

    it("only counts deposits from real external funding rails", async () => {
      const { client, findFirst } = mockClient(50, { id: "dep1" });
      await getPromoLockedKes(client, "u1", 100);
      const where = findFirst.mock.calls[0][0].where;
      expect(where.type).toBe("DEPOSIT");
      expect(where.status).toBe("COMPLETED");
      expect(where.provider.in).toEqual([...REAL_DEPOSIT_PROVIDERS]);
      // internal rails must NOT be an unlock path
      expect(where.provider.in).not.toContain("wallet_transfer");
      expect(where.provider.in).not.toContain("p2p_kes_escrow");
      expect(where.provider.in).not.toContain("manual");
    });
  });

  it("locks promo credits from transfer/withdraw helpers", () => {
    expect(existsSync("lib/promo-lock.ts")).toBe(true);
    const lock = readFileSync("lib/promo-lock.ts", "utf8");
    expect(lock).toContain("getPromoLockedKes");
    expect(lock).toContain("PROMO_LOCKED");
    const transfer = readFileSync("app/api/wallet/transfer/route.ts", "utf8");
    expect(transfer).toContain("promo-lock");
    expect(transfer).toContain("PROMO_LOCKED");
    expect(transfer).toContain("promoRedemption");
  });
});
