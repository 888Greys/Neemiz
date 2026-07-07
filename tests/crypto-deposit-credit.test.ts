import { beforeEach, describe, expect, it, vi } from "vitest";

const mockDb = vi.hoisted(() => ({
  p2PCryptoDeposit: { findFirst: vi.fn() },
  transaction: { findFirst: vi.fn() },
  notification: { findFirst: vi.fn(), create: vi.fn() },
  $transaction: vi.fn(),
}));

const mockSendCryptoDepositEmail = vi.hoisted(() => vi.fn());
const mockSendCryptoDepositPendingEmail = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({ db: mockDb }));
vi.mock("@/lib/brevo", () => ({
  sendCryptoDepositEmail: mockSendCryptoDepositEmail,
  sendCryptoDepositPendingEmail: mockSendCryptoDepositPendingEmail,
}));
vi.mock("@/lib/p2p/crypto-balance", () => ({ creditUserCrypto: vi.fn() }));

import { creditOnChainDeposit, notifyPendingDeposit, pendingDepositLink } from "@/lib/crypto/deposit-credit";

describe("creditOnChainDeposit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.p2PCryptoDeposit.findFirst.mockResolvedValue(null);
    mockDb.transaction.findFirst.mockResolvedValue(null);
    mockDb.notification.findFirst.mockResolvedValue(null);
    mockDb.notification.create.mockResolvedValue(undefined);
    mockSendCryptoDepositEmail.mockResolvedValue(undefined);
    mockSendCryptoDepositPendingEmail.mockResolvedValue(undefined);
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

describe("notifyPendingDeposit", () => {
  const input = {
    user: { id: "user_1", email: "player@example.com", username: "Player" },
    depositAddress: "0xabc",
    crypto: "USDT",
    network: "POLYGON",
    amount: 5,
    txHash: "0xDePoSit",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.transaction.findFirst.mockResolvedValue(null);
    mockDb.notification.findFirst.mockResolvedValue(null);
    mockDb.notification.create.mockResolvedValue(undefined);
    mockSendCryptoDepositPendingEmail.mockResolvedValue(undefined);
  });

  it("sends the detected notification + email once", async () => {
    const result = await notifyPendingDeposit(input);
    expect(result).toMatchObject({ notified: true });
    expect(mockDb.notification.create).toHaveBeenCalledTimes(1);
    expect(mockSendCryptoDepositPendingEmail).toHaveBeenCalledWith(
      "player@example.com", "Player",
      expect.objectContaining({ crypto: "USDT", network: "POLYGON", cryptoAmount: 5, txHash: "0xDePoSit" }),
    );
  });

  it("skips when the deposit has already been credited", async () => {
    mockDb.transaction.findFirst.mockResolvedValue({ id: "tx_1" });
    const result = await notifyPendingDeposit(input);
    expect(result).toMatchObject({ notified: false, reason: "already_credited" });
    expect(mockDb.notification.create).not.toHaveBeenCalled();
    expect(mockSendCryptoDepositPendingEmail).not.toHaveBeenCalled();
  });

  it("skips when a pending notice was already sent (dedup by per-tx link)", async () => {
    mockDb.notification.findFirst.mockResolvedValue({ id: "notif_1" });
    const result = await notifyPendingDeposit(input);
    expect(result).toMatchObject({ notified: false, reason: "already_notified" });
    expect(mockDb.notification.create).not.toHaveBeenCalled();
  });

  it("derives a deterministic, normalized dedup link", () => {
    expect(pendingDepositLink("0xDePoSit")).toBe("/wallet?deposit=0xdeposit");
  });
});
