import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";

describe("crypto on-chain reconcile", () => {
  it("ships the clamp helper and cron route", () => {
    expect(existsSync("lib/crypto/reconcile-onchain.ts")).toBe(true);
    expect(existsSync("app/api/cron/reconcile-crypto-onchain/route.ts")).toBe(true);
    const src = readFileSync("lib/crypto/reconcile-onchain.ts", "utf8");
    expect(src).toContain("clamp_ledger_to_current_deposit_address");
    expect(src).toContain("getOnChainBalance");
    expect(src).toContain("Never raise a balance");
  });
});
