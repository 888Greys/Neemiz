import { describe, expect, it, vi } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { spendForPlay, creditForPlay, creditWinnings } from "@/lib/balance";

function createTx(initial: {
  walletBalance: number;
  bonusBalance?: number;
  bonusWagerRemaining?: number;
  bonusCashoutCap?: number;
  bonusExpiresAt?: Date | null;
}) {
  const state = {
    walletBalance: initial.walletBalance,
    bonusBalance: initial.bonusBalance ?? 0,
    bonusWagerRemaining: initial.bonusWagerRemaining ?? 0,
    bonusCashoutCap: initial.bonusCashoutCap ?? 0,
    bonusExpiresAt: initial.bonusExpiresAt ?? null,
  };

  const tx = {
    state,
    transaction: { create: vi.fn(async () => ({})) },
    user: {
      findUnique: vi.fn(async () => ({
        bonusBalance: state.bonusBalance,
        bonusWagerRemaining: state.bonusWagerRemaining,
        bonusCashoutCap: state.bonusCashoutCap,
        bonusExpiresAt: state.bonusExpiresAt,
      })),
      update: vi.fn(async ({ data }: any) => {
        applyData(state, data);
        return state;
      }),
      updateMany: vi.fn(async ({ where, data }: any) => {
        if (where?.walletBalance?.gte !== undefined && state.walletBalance < where.walletBalance.gte) {
          return { count: 0 };
        }
        if (where?.bonusBalance?.gte !== undefined && state.bonusBalance < where.bonusBalance.gte) {
          return { count: 0 };
        }
        applyData(state, data);
        return { count: 1 };
      }),
    },
  };

  return tx as any;
}

function applyData(state: Record<string, any>, data: Record<string, any>) {
  for (const [key, value] of Object.entries(data)) {
    if (value && typeof value === "object" && "increment" in value) state[key] += Number(value.increment);
    else if (value && typeof value === "object" && "decrement" in value) state[key] -= Number(value.decrement);
    else state[key] = value;
  }
}

describe("merged bonus/main wallet accounting", () => {
  it("spends gameplay stakes from the main wallet even when legacy bonus exists", async () => {
    const tx = createTx({ walletBalance: 100, bonusBalance: 500 });

    const result = await spendForPlay(tx, "user_1", 25);

    expect(result).toEqual({ source: "real" });
    expect(tx.state.walletBalance).toBe(75);
    expect(tx.state.bonusBalance).toBe(500);
  });

  it("credits refunds and winnings back to the main wallet", async () => {
    const tx = createTx({
      walletBalance: 100,
      bonusBalance: 500,
      bonusWagerRemaining: 400,
      bonusCashoutCap: 200,
      bonusExpiresAt: new Date(Date.now() + 60_000),
    });

    await creditForPlay(tx, "user_1", 10, "bonus");
    const result = await creditWinnings(tx, "user_1", 20);

    expect(result).toEqual({ balance: "real" });
    expect(tx.state.walletBalance).toBe(130);
    expect(tx.state.bonusBalance).toBe(500);
  });

  it("keeps admin bonus grants and migration pointed at walletBalance", () => {
    const route = readFileSync("app/api/admin/bonus/grant/route.ts", "utf8");
    expect(route).toContain("walletBalance:");
    expect(route).not.toContain("bonusBalance:        { increment: amount }");
    expect(route).toContain('balance: "wallet"');

    const migration = "prisma/migrations/20260709110000_merge_bonus_into_wallet/migration.sql";
    expect(existsSync(migration)).toBe(true);
    const sql = readFileSync(migration, "utf8");
    expect(sql).toContain('"wallet_balance" = "wallet_balance" + "bonus_balance"');
    expect(sql).toContain('"bonus_balance" = 0.00');
  });
});
