/**
 * Shared helpers for crediting / debiting UserCryptoBalance.
 *
 * All P2P routes that touch crypto balances should go through these helpers
 * so the logic stays in one place as we add on-chain settlement in phase 2.
 */

import { TransactionStatus, TransactionType, type Prisma } from "@prisma/client";

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

// ─── KES coin (fiat-backed in-app P2P asset) ────────────────────────────────
// KES Coin is not on-chain and is no longer a separate converted balance.
// It is a 1:1 P2P alias of the user's fiat KES wallet balance:
// - placing a KES order debits/locks User.walletBalance
// - cancelling/expiring refunds User.walletBalance
// - releasing credits the receiver's User.walletBalance
// Existing UserCryptoBalance(KES/KES) rows are legacy-only and should not be
// used for new KES order accounting.

export const KES_COIN = "KES";
export const KES_NETWORK = "KES";
export function isKesCoin(crypto: string): boolean {
  return crypto?.toUpperCase() === KES_COIN;
}

/** Credit spendable KES Coin, backed directly by the user's fiat wallet. */
export async function creditKesCoinBalance(tx: TxClient, userId: string, amount: number) {
  await tx.user.update({
    where: { id: userId },
    data:  { walletBalance: { increment: amount } },
  });
}

/** Debit spendable KES Coin from the fiat wallet. Throws if insufficient. */
export async function debitKesCoinBalance(tx: TxClient, userId: string, amount: number) {
  const debited = await tx.user.updateMany({
    where: { id: userId, walletBalance: { gte: amount } },
    data:  { walletBalance: { decrement: amount } },
  });
  if (debited.count === 0) throw new Error("INSUFFICIENT_FIAT_BALANCE");
}

/** Lock KES Coin by debiting the fiat wallet. Throws if insufficient. */
export async function lockKesCoinBalance(tx: TxClient, userId: string, amount: number) {
  const locked = await tx.user.updateMany({
    where: { id: userId, walletBalance: { gte: amount } },
    data:  { walletBalance: { decrement: amount } },
  });
  if (locked.count === 0) throw new Error("INSUFFICIENT_FIAT_BALANCE");
}

/** Refund locked KES Coin back to the fiat wallet, used for cancellations/expirations. */
export async function unlockKesCoinBalance(tx: TxClient, userId: string, amount: number) {
  await tx.user.update({
    where: { id: userId },
    data:  { walletBalance: { increment: amount } },
  });
}

/** Complete a KES Coin escrow transfer by crediting the receiver's fiat wallet. */
export async function releaseKesCoinBalance(
  tx: TxClient,
  _giverUserId: string,
  receiverUserId: string,
  _lockedAmount: number,
  payoutAmount: number,
) {
  await creditKesCoinBalance(tx, receiverUserId, payoutAmount);
}

export async function recordKesWalletMovement(
  tx: TxClient,
  input: {
    userId: string;
    amount: number;
    action: "lock" | "refund" | "release";
    orderId: string;
    role: "giver" | "receiver";
  },
) {
  await tx.transaction.create({
    data: {
      userId:   input.userId,
      type:     input.action === "refund" ? TransactionType.REFUND : input.action === "release" ? TransactionType.DEPOSIT : TransactionType.WITHDRAWAL,
      amount:   input.amount,
      currency: "KES",
      status:   TransactionStatus.COMPLETED,
      reference: `p2p-kes-${input.action}-${input.orderId}-${input.userId}`,
      provider: "p2p_kes_escrow",
      metadata: {
        action:  input.action,
        orderId: input.orderId,
        role:    input.role,
        asset:   "KES",
        rate:    1,
      },
    },
  });
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
    USDC:  "POLYGON",
    BTC:   "BTC",
    ETH:   "ERC20",
    BNB:   "BEP20",
    MATIC: "POLYGON",
  };
  return map[crypto.toUpperCase()] ?? "TRC20";
}
