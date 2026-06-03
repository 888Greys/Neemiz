/**
 * Shared helpers for crediting / debiting UserCryptoBalance.
 *
 * All P2P routes that touch crypto balances should go through these helpers
 * so the logic stays in one place as we add on-chain settlement in phase 2.
 */

import type { Prisma } from "@prisma/client";

// The tx parameter accepts either the full PrismaClient or a transaction client.
type TxClient = Omit<
  Prisma.TransactionClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

/**
 * Credit a user's available crypto balance (upsert — safe to call for any user).
 */
export async function creditUserCrypto(
  tx: TxClient,
  userId: string,
  crypto: string,
  network: string,
  amount: number,
) {
  await tx.userCryptoBalance.upsert({
    where:  { userId_crypto_network: { userId, crypto, network } },
    update: { available: { increment: amount } },
    create: { userId, crypto, network, available: amount, locked: 0 },
  });
}

/**
 * Lock an amount from available → locked (e.g. buyer placing an order on a BUY ad).
 * Throws if available balance is insufficient.
 */
export async function lockUserCrypto(
  tx: TxClient,
  userId: string,
  crypto: string,
  network: string,
  amount: number,
) {
  const balance = await tx.userCryptoBalance.findUnique({
    where: { userId_crypto_network: { userId, crypto, network } },
  });
  const avail = Number(balance?.available ?? 0);
  if (avail < amount) throw new Error("INSUFFICIENT_CRYPTO_BALANCE");

  await tx.userCryptoBalance.update({
    where: { userId_crypto_network: { userId, crypto, network } },
    data: {
      available: { decrement: amount },
      locked:    { increment: amount },
    },
  });
}

/**
 * Release a locked amount back to available (e.g. order cancelled / expired).
 */
export async function unlockUserCrypto(
  tx: TxClient,
  userId: string,
  crypto: string,
  network: string,
  amount: number,
) {
  await tx.userCryptoBalance.updateMany({
    where: { userId, crypto, network },
    data: {
      locked:    { decrement: amount },
      available: { increment: amount },
    },
  });
}

/**
 * Deduct from a user's available crypto balance (e.g. withdrawal).
 * Throws if insufficient.
 */
export async function debitUserCrypto(
  tx: TxClient,
  userId: string,
  crypto: string,
  network: string,
  amount: number,
) {
  const balance = await tx.userCryptoBalance.findUnique({
    where: { userId_crypto_network: { userId, crypto, network } },
  });
  const avail = Number(balance?.available ?? 0);
  if (avail < amount) throw new Error("INSUFFICIENT_CRYPTO_BALANCE");

  await tx.userCryptoBalance.update({
    where: { userId_crypto_network: { userId, crypto, network } },
    data: { available: { decrement: amount } },
  });
}

// ─── KES coin (in-app fiat as a tradable P2P asset) ─────────────────────────
// KES Coin is separate from the user's fiat wallet balance. Users buy it from
// fiat 1:1, and P2P order escrow uses UserCryptoBalance(KES/KES).

export const KES_COIN = "KES";
export const KES_NETWORK = "KES";
export function isKesCoin(crypto: string): boolean {
  return crypto?.toUpperCase() === KES_COIN;
}

/** Credit spendable KES Coin to a user's crypto balance. */
export async function creditKesCoinBalance(tx: TxClient, userId: string, amount: number) {
  await creditUserCrypto(tx, userId, KES_COIN, KES_NETWORK, amount);
}

/** Debit spendable KES Coin. Throws if insufficient. */
export async function debitKesCoinBalance(tx: TxClient, userId: string, amount: number) {
  const balance = await tx.userCryptoBalance.findUnique({
    where: { userId_crypto_network: { userId, crypto: KES_COIN, network: KES_NETWORK } },
  });
  const avail = Number(balance?.available ?? 0);
  if (avail < amount) throw new Error("INSUFFICIENT_KES_COIN_BALANCE");

  await tx.userCryptoBalance.update({
    where: { userId_crypto_network: { userId, crypto: KES_COIN, network: KES_NETWORK } },
    data: { available: { decrement: amount } },
  });
}

/** Lock KES Coin from available into escrow. Throws if insufficient. */
export async function lockKesCoinBalance(tx: TxClient, userId: string, amount: number) {
  const balance = await tx.userCryptoBalance.findUnique({
    where: { userId_crypto_network: { userId, crypto: KES_COIN, network: KES_NETWORK } },
  });
  const avail = Number(balance?.available ?? 0);
  if (avail < amount) throw new Error("INSUFFICIENT_KES_COIN_BALANCE");

  await tx.userCryptoBalance.update({
    where: { userId_crypto_network: { userId, crypto: KES_COIN, network: KES_NETWORK } },
    data: {
      available: { decrement: amount },
      locked:    { increment: amount },
    },
  });
}

/** Release locked KES Coin back to available, used for refunds/expirations. */
export async function unlockKesCoinBalance(tx: TxClient, userId: string, amount: number) {
  await tx.userCryptoBalance.updateMany({
    where: { userId, crypto: KES_COIN, network: KES_NETWORK, locked: { gte: amount } },
    data: {
      locked:    { decrement: amount },
      available: { increment: amount },
    },
  });
}

/** Complete a KES Coin escrow transfer: remove locked from giver, credit receiver. */
export async function releaseKesCoinBalance(
  tx: TxClient,
  giverUserId: string,
  receiverUserId: string,
  lockedAmount: number,
  payoutAmount: number,
) {
  const released = await tx.userCryptoBalance.updateMany({
    where: { userId: giverUserId, crypto: KES_COIN, network: KES_NETWORK, locked: { gte: lockedAmount } },
    data:  { locked: { decrement: lockedAmount } },
  });
  if (released.count === 0) throw new Error("INSUFFICIENT_LOCKED_KES_COIN");
  await creditKesCoinBalance(tx, receiverUserId, payoutAmount);
}

// KES coin trades charge 1% from EACH side (2% total). The giver is escrowed
// amount + 1%, the receiver is paid amount − 1%, the platform keeps the 2%.
export const KES_FEE_RATE = 0.01;
/** What the giver is debited / refunded (order amount + their 1% fee). */
export const kesLockAmount   = (amount: number) => parseFloat((amount * (1 + KES_FEE_RATE)).toFixed(2));
/** What the receiver is paid (order amount − their 1% fee). */
export const kesPayoutAmount = (amount: number) => parseFloat((amount * (1 - KES_FEE_RATE)).toFixed(2));

/**
 * Infer the default network for a given crypto symbol.
 * Update this as new networks are added.
 */
export function defaultNetwork(crypto: string): string {
  const map: Record<string, string> = {
    KES:   KES_NETWORK,
    USDT:  "TRC20",
    USDC:  "ERC20",
    BTC:   "BTC",
    ETH:   "ERC20",
    BNB:   "BEP20",
    MATIC: "POLYGON",
  };
  return map[crypto.toUpperCase()] ?? "TRC20";
}
