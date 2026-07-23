import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/wallet/transfer/route";
import { db } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateUser } from "@/lib/get-or-create-user";

process.env.STEPUP_SECRET = "test-step-up-secret-value";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/get-or-create-user", () => ({
  getOrCreateUser: vi.fn(),
}));

vi.mock("@/lib/withdrawal-guard", () => ({
  transfersDisabledResponse: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn().mockResolvedValue({ ok: true, remaining: 9, retryAfterSec: 0 }),
  tooManyRequests: vi.fn(),
}));

vi.mock("@/lib/dev-auth", () => ({
  DEV_AUTH_ENABLED: true,
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({
    get: vi.fn(),
    delete: vi.fn(),
  }),
}));

const mockTx = {
  user: {
    updateMany: vi.fn(),
    update: vi.fn(),
    findUnique: vi.fn(),
  },
  transaction: {
    aggregate: vi.fn(),
    findFirst: vi.fn(),
    createMany: vi.fn(),
  },
  notification: {
    createMany: vi.fn(),
  },
  // The route reads promo-redemption totals inside the tx to block promo farmers
  // from transferring. Stubbed here so every transfer test can reach the body.
  promoRedemption: {
    aggregate: vi.fn(),
  },
};

vi.mock("@/lib/db", () => ({
  db: {
    user: {
      findFirst: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

describe("Wallet Transfer Rules", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default mock implementation of $transaction to execute the callback
    vi.mocked(db.$transaction).mockImplementation(async (callback) => {
      return callback(mockTx as any);
    });

    // Sensible defaults so tests reach the rule under test: sender has a balance,
    // and no promo credit locks transfers. Individual tests override as needed.
    mockTx.user.findUnique.mockResolvedValue({ walletBalance: 100_000 } as any);
    mockTx.promoRedemption.aggregate.mockResolvedValue({ _sum: { amountKes: 0 } } as any);
    // Sender is funded by default (a real deposit exists) so the deposit-to-
    // withdraw gate on the send side passes; the unfunded case is tested below.
    // Admin once-ever tests override this findFirst as needed.
    mockTx.transaction.findFirst.mockImplementation(async (args: any) => {
      if (args?.where?.provider === "wallet_transfer") return null;
      return { id: "dep" } as any;
    });

    // Default Supabase mock user
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user_123", email: "test@example.com" } } }),
      },
    } as any);
  });

  const makeRequest = (body: any) => {
    return new Request("http://localhost/api/wallet/transfer", {
      method: "POST",
      body: JSON.stringify(body),
    });
  };

  it("fails if amount > 50 KES for normal users", async () => {
    vi.mocked(getOrCreateUser).mockResolvedValue({ id: "user_123", isAdmin: false } as any);
    
    const res = await POST(makeRequest({ recipientId: "rec_456", amount: 51 }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("You can send at most");
  });

  it("fails if amount > 50 KES for admin users", async () => {
    vi.mocked(getOrCreateUser).mockResolvedValue({ id: "admin_123", isAdmin: true } as any);

    const res = await POST(makeRequest({ recipientId: "rec_456", amount: 50.1 }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("You can send at most");
  });

  it("checks daily limit for normal users", async () => {
    vi.mocked(getOrCreateUser).mockResolvedValue({ id: "user_123", isAdmin: false } as any);
    vi.mocked(db.user.findFirst).mockResolvedValue({ id: "rec_456", username: "recipient" } as any);

    // Mock insufficient balance
    mockTx.user.updateMany.mockResolvedValue({ count: 1 });
    // Mock daily limit exceeded (e.g. they already spent 480 KES today, sending 30 is over 500)
    mockTx.transaction.aggregate.mockResolvedValue({ _sum: { amount: 480 } });

    const res = await POST(makeRequest({ recipientId: "rec_456", amount: 30 }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("Daily limit");
  });

  it("blocks a never-funded (no real deposit) user from sending — traps mule credit", async () => {
    vi.mocked(getOrCreateUser).mockResolvedValue({ id: "user_123", isAdmin: false } as any);
    vi.mocked(db.user.findFirst).mockResolvedValue({ id: "rec_456", username: "recipient" } as any);
    mockTx.user.updateMany.mockResolvedValue({ count: 1 });
    // No qualifying deposit → the send-side deposit gate fires.
    mockTx.transaction.findFirst.mockResolvedValue(null);

    const res = await POST(makeRequest({ recipientId: "rec_456", amount: 40 }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.code).toBe("NO_DEPOSIT_GATE");
    // Must reject BEFORE debiting the sender.
    expect(mockTx.user.updateMany).not.toHaveBeenCalled();
  });

  it("exempts admin users from the cumulative daily cash-out limit but applies the transfer cap", async () => {
    vi.mocked(getOrCreateUser).mockResolvedValue({ id: "admin_123", isAdmin: true, username: "admin" } as any);
    vi.mocked(db.user.findFirst).mockResolvedValue({ id: "rec_456", username: "recipient" } as any);

    // Mock successful debit
    mockTx.user.updateMany.mockResolvedValue({ count: 1 });
    // Admin transfer cap: 500 already sent in the window is still under the default 200,000 cap
    mockTx.transaction.aggregate.mockResolvedValue({ _sum: { amount: 500 } });
    // Mock prior transfers to this recipient: none
    mockTx.transaction.findFirst.mockResolvedValue(null);
    mockTx.user.findUnique.mockResolvedValue({ walletBalance: 100 } as any);

    const res = await POST(makeRequest({ recipientId: "rec_456", amount: 40 }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
  });

  it("caps an admin's TOTAL daily transfers across all recipients", async () => {
    vi.mocked(getOrCreateUser).mockResolvedValue({ id: "admin_123", isAdmin: true, username: "admin" } as any);
    vi.mocked(db.user.findFirst).mockResolvedValue({ id: "rec_456", username: "recipient" } as any);

    // Debit succeeds, but the admin has already transferred 199,980 in the window;
    // sending another 40 would exceed the default 200,000 cap.
    mockTx.user.updateMany.mockResolvedValue({ count: 1 });
    mockTx.transaction.aggregate.mockResolvedValue({ _sum: { amount: 199_980 } });

    const res = await POST(makeRequest({ recipientId: "rec_456", amount: 40 }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("transfer limit");
  });

  it("prevents an admin from ever sending to the same recipient twice (once-ever, any admin)", async () => {
    vi.mocked(getOrCreateUser).mockResolvedValue({ id: "admin_123", isAdmin: true, username: "admin" } as any);
    vi.mocked(db.user.findFirst).mockResolvedValue({ id: "rec_456", username: "recipient" } as any);

    // Mock successful debit
    mockTx.user.updateMany.mockResolvedValue({ count: 1 });
    // Under the transfer cap
    mockTx.transaction.aggregate.mockResolvedValue({ _sum: { amount: 0 } });
    // A prior transfer from ANY admin exists (e.g. goodhope already seeded them)
    mockTx.transaction.findFirst.mockResolvedValue({
      amount: 50,
      createdAt: new Date("2026-07-01T12:00:00.000Z"),
      user: { username: "goodhope229" },
    } as any);

    const res = await POST(makeRequest({ recipientId: "rec_456", amount: 10 }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.alreadySent).toBe(true);
    expect(data.error).toContain("already received an admin transfer");
    expect(data.from).toBe("@goodhope229");
  });

  it("scopes the once-ever check across all admins, not only the current sender", async () => {
    vi.mocked(getOrCreateUser).mockResolvedValue({ id: "admin_123", isAdmin: true, username: "admin" } as any);
    vi.mocked(db.user.findFirst).mockResolvedValue({ id: "rec_456", username: "recipient" } as any);
    mockTx.user.updateMany.mockResolvedValue({ count: 1 });
    mockTx.transaction.aggregate.mockResolvedValue({ _sum: { amount: 0 } });
    mockTx.transaction.findFirst.mockResolvedValue(null);
    mockTx.user.findUnique.mockResolvedValue({ walletBalance: 100 } as any);

    await POST(makeRequest({ recipientId: "rec_456", amount: 40 }));

    const onceEverCall = mockTx.transaction.findFirst.mock.calls.find(
      ([arg]) => arg?.where?.provider === "wallet_transfer",
    );
    expect(onceEverCall).toBeTruthy();
    expect(onceEverCall![0].where.userId).toBeUndefined();
    expect(onceEverCall![0].where.user).toEqual({ isAdmin: true });
    expect(onceEverCall![0].where.createdAt).toBeUndefined();
  });
});
