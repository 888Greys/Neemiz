import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/forex/funding/route";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/get-or-create-user";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/get-or-create-user", () => ({ getOrCreateUser: vi.fn() }));

const tx = {
  user: {
    updateMany: vi.fn(),
    findUniqueOrThrow: vi.fn(),
  },
  transaction: {
    create: vi.fn(),
  },
};

vi.mock("@/lib/db", () => ({
  db: {
    $transaction: vi.fn(),
  },
}));

describe("forex funding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "auth_1", email: "a@test.com" } } }),
      },
    } as any);
    vi.mocked(getOrCreateUser).mockResolvedValue({
      id: "user_1",
      walletBalance: 100,
      forexWalletBalance: 0,
      currency: "KES",
    } as any);
    vi.mocked(db.$transaction).mockImplementation(async (callback) => callback(tx as any));
  });

  function request(amount: number) {
    return new Request("http://localhost/api/forex/funding", {
      method: "POST",
      body: JSON.stringify({ amount }),
    });
  }

  it("moves funds from main wallet into forex wallet only", async () => {
    tx.user.updateMany.mockResolvedValue({ count: 1 });
    tx.user.findUniqueOrThrow.mockResolvedValue({ walletBalance: 75, forexWalletBalance: 25 });

    const res = await POST(request(25));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ ok: true, mainBalance: 75, forexBalance: 25 });
    expect(tx.user.updateMany).toHaveBeenCalledWith({
      where: { id: "user_1", walletBalance: { gte: 25 } },
      data: {
        walletBalance: { decrement: 25 },
        forexWalletBalance: { increment: 25 },
      },
    });
  });

  it("rejects funding when main wallet has insufficient balance", async () => {
    tx.user.updateMany.mockResolvedValue({ count: 0 });

    const res = await POST(request(250));
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({ error: "Insufficient main wallet balance" });
  });
});
