/**
 * Balance spending helpers.
 *
 * Bonus credit is part of the main wallet again. The bonus columns remain in the
 * schema only for backward-compatible deployments and historical audit records;
 * gameplay, refunds, winnings, withdrawals, transfers and P2P all operate on
 * walletBalance as the single KES balance.
 */

import type { Prisma } from "@prisma/client";

type TxClient = Omit<
  Prisma.TransactionClient,
  "$connect" | "$disconnect" | "$on" | "$use" | "$extends" | "$transaction"
>;

export type PlaySource = "bonus" | "real";

/**
 * Legacy no-op kept for callers and the expire-bonuses cron. Bonus wagering is
 * disabled; the migration folds existing bonus balances into walletBalance.
 */
export async function settleBonusCycleIfDue(_tx: TxClient, _userId: string): Promise<void> {
  return;
}

/**
 * Debit a gameplay stake from the single main wallet. Throws
 * "INSUFFICIENT_BALANCE" if the wallet cannot cover it.
 */
export async function spendForPlay(
  tx: TxClient,
  userId: string,
  amount: number,
): Promise<{ source: PlaySource }> {
  const fromWallet = await tx.user.updateMany({
    where: { id: userId, walletBalance: { gte: amount } },
    data:  { walletBalance: { decrement: amount } },
  });
  if (fromWallet.count === 0) throw new Error("INSUFFICIENT_BALANCE");
  return { source: "real" };
}

/** Credit a stake refund/cash-out/win to the single main wallet. */
export async function creditForPlay(
  tx: TxClient,
  userId: string,
  amount: number,
  _source: PlaySource,
): Promise<void> {
  await tx.user.update({
    where: { id: userId },
    data:  { walletBalance: { increment: amount } },
  });
}

/** Credit game winnings (or stake refunds) to the single main wallet. */
export async function creditWinnings(
  tx: TxClient,
  userId: string,
  amount: number,
): Promise<{ balance: PlaySource }> {
  if (amount <= 0) return { balance: "real" };
  await tx.user.update({
    where: { id: userId },
    data:  { walletBalance: { increment: amount } },
  });
  return { balance: "real" };
}
