import { beforeEach, describe, expect, it, vi } from "vitest";

const mockDb = vi.hoisted(() => ({
  p2PCryptoDeposit: { findFirst: vi.fn() },
  transaction: { findFirst: vi.fn() },
  $transaction: vi.fn(),
}));

const mockSendCryptoDepositEmail = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({ db: mockDb }));
vi.mock("@/lib/brevo", () => ({ sendCryptoDepositEmail: mockSendCryptoDepositEmail }));
vi.mock("@/lib/p2p/crypto-balance", () => ({ creditUserCrypto: vi.fn() }));

import { creditOnChainDeposit } from "@/lib/crypto/deposit-credit";

describe("creditOnChainDeposit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.p2PCryptoDeposit.findFirst.mockResolvedValue(null);
    mockDb.transaction.findFirst.mockResolvedValue(null);
    mockSendCryptoDepositEmail.mockResolvedValue(undefined);
    mockDb.$transaction.mockImplementation(async (callback) => {
      await callback({
        transaction: { create: vi.fn() },
        notification: { create: vi.fn() },
      });
    });
  });

  it("emails the user after a credited on-chain crypto deposit", async () => {
    const result = await creditOnChainDeposit({
      user: {
        id: "user_1",
        email: "player@example.com",
        username: "Player",
      },
      depositAddress: "0xabc",
      crypto: "USDT",
      network: "POLYGON",
      amount: 5,
      txHash: "0xdeposit",
      source: "moralis",
    });

    expect(result).toMatchObject({ credited: true, skipped: false });
    expect(mockSendCryptoDepositEmail).toHaveBeenCalledWith(
      "player@example.com",
      "Player",
      expect.objectContaining({
        crypto: "USDT",
        network: "POLYGON",
        cryptoAmount: 5,
        txHash: "0xdeposit",
      }),
    );
  });
});
