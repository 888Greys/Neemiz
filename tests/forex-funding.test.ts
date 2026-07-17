import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/forex/funding/route";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/get-or-create-user";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/get-or-create-user", () => ({ getOrCreateUser: vi.fn() }));

const tx = {
  user: {
    findUniqueOrThrow: vi.fn(),
    update: vi.fn(),
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

describe("forex funding (unified main wallet)", () => {
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

  function request(amount = 25) {
    return new Request("http://localhost/api/forex/funding", {
      method: "POST",
      body: JSON.stringify({ amount }),
    });
  }

  it("folds leftover forex balance into the main wallet and skips transfers", async () => {
    tx.user.findUniqueOrThrow
      .mockResolvedValueOnce({ walletBalance: 100, forexWalletBalance: 40 })
      .mockResolvedValueOnce({ walletBalance: 140, forexWalletBalance: 0 });
    tx.user.update.mockResolvedValue({});

    const res = await POST(request(25));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      ok: true,
      unified: true,
      folded: 40,
      mainBalance: 140,
      forexBalance: 140,
    });
    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: "user_1" },
      data: {
        walletBalance: { increment: 40 },
        forexWalletBalance: 0,
      },
    });
  });

  it("is a no-op when forex wallet is already empty", async () => {
    tx.user.findUniqueOrThrow.mockResolvedValue({ walletBalance: 100, forexWalletBalance: 0 });

    const res = await POST(request(50));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      ok: true,
      unified: true,
      folded: 0,
      mainBalance: 100,
    });
    expect(tx.user.update).not.toHaveBeenCalled();
  });
});
