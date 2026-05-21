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

/**
 * Infer the default network for a given crypto symbol.
 * Update this as new networks are added.
 */
export function defaultNetwork(crypto: string): string {
  const map: Record<string, string> = {
    USDT:  "TRC20",
    USDC:  "ERC20",
    BTC:   "BTC",
    ETH:   "ERC20",
    BNB:   "BEP20",
    MATIC: "POLYGON",
  };
  return map[crypto.toUpperCase()] ?? "TRC20";
}
