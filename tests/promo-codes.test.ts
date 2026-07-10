import { describe, expect, it } from "vitest";
import { normalizePromoCode } from "@/lib/promo-redeem";
import { readFileSync, existsSync } from "node:fs";

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
    expect(sql).toContain("100.00");
    expect(sql).toContain("SILAS50");
    expect(sql).toContain("50.00");
  });

  it("exposes redeem + admin create routes", () => {
    expect(existsSync("app/api/promo/redeem/route.ts")).toBe(true);
    expect(existsSync("app/api/admin/promo/route.ts")).toBe(true);
    expect(existsSync("lib/promo-redeem.ts")).toBe(true);
  });
});
