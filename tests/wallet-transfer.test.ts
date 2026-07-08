import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/wallet/transfer/route";
import { db } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateUser } from "@/lib/get-or-create-user";

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
  rateLimit: vi.fn().mockReturnValue({ ok: true }),
  tooManyRequests: vi.fn(),
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

  it("exempts admin users from the cumulative daily cash-out limit but applies the transfer cap", async () => {
    vi.mocked(getOrCreateUser).mockResolvedValue({ id: "admin_123", isAdmin: true, username: "admin" } as any);
    vi.mocked(db.user.findFirst).mockResolvedValue({ id: "rec_456", username: "recipient" } as any);

    // Mock successful debit
    mockTx.user.updateMany.mockResolvedValue({ count: 1 });
    // Admin transfer cap: nothing sent yet in the window, so 40 is well under it
    mockTx.transaction.aggregate.mockResolvedValue({ _sum: { amount: 0 } });
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

    // Debit succeeds, but the admin has already transferred 480 in the window;
    // sending another 40 would exceed the default 500 cap.
    mockTx.user.updateMany.mockResolvedValue({ count: 1 });
    mockTx.transaction.aggregate.mockResolvedValue({ _sum: { amount: 480 } });

    const res = await POST(makeRequest({ recipientId: "rec_456", amount: 40 }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("Daily transfer limit");
  });

  it("prevents an admin from ever sending to the same recipient twice (once-ever)", async () => {
    vi.mocked(getOrCreateUser).mockResolvedValue({ id: "admin_123", isAdmin: true, username: "admin" } as any);
    vi.mocked(db.user.findFirst).mockResolvedValue({ id: "rec_456", username: "recipient" } as any);

    // Mock successful debit
    mockTx.user.updateMany.mockResolvedValue({ count: 1 });
    // Under the transfer cap
    mockTx.transaction.aggregate.mockResolvedValue({ _sum: { amount: 0 } });
    // A prior transfer to this recipient exists (any time in the past)
    mockTx.transaction.findFirst.mockResolvedValue({ id: "tx_999", amount: 50 } as any);

    const res = await POST(makeRequest({ recipientId: "rec_456", amount: 10 }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("already received a transfer");
  });

  it("does NOT scope the admin once-ever check to a time window", async () => {
    vi.mocked(getOrCreateUser).mockResolvedValue({ id: "admin_123", isAdmin: true, username: "admin" } as any);
    vi.mocked(db.user.findFirst).mockResolvedValue({ id: "rec_456", username: "recipient" } as any);
    mockTx.user.updateMany.mockResolvedValue({ count: 1 });
    mockTx.transaction.aggregate.mockResolvedValue({ _sum: { amount: 0 } });
    mockTx.transaction.findFirst.mockResolvedValue(null);
    mockTx.user.findUnique.mockResolvedValue({ walletBalance: 100 } as any);

    await POST(makeRequest({ recipientId: "rec_456", amount: 40 }));

    // The recipient-history lookup must NOT include a createdAt window — it looks
    // at all-time history so a recipient can never be paid twice.
    const onceEverCall = mockTx.transaction.findFirst.mock.calls.find(
      ([arg]) => arg?.where?.provider === "wallet_transfer",
    );
    expect(onceEverCall).toBeTruthy();
    expect(onceEverCall![0].where.createdAt).toBeUndefined();
  });
});
