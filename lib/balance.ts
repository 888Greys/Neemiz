/**
 * Balance spending helpers.
 *
 * The platform holds two strictly separated balances per user:
 *   - walletBalance : REAL cash (deposits, winnings, real P2P). Withdrawable,
 *                     transferable, tradeable on P2P.
 *   - bonusBalance  : promo credit. NEVER withdrawable, NEVER transferable, NEVER
 *                     P2P. Only playable via spendForPlay().
 *
 * Withdrawals / transfers / P2P must debit walletBalance directly (they already
 * do) so bonus can never leak into real cash through those paths. Gameplay stakes
 * should go through spendForPlay() so promo credit is actually usable.
 */

import type { Prisma } from "@prisma/client";

type TxClient = Omit<
  Prisma.TransactionClient,
  "$connect" | "$disconnect" | "$on" | "$use" | "$extends" | "$transaction"
>;

export type PlaySource = "bonus" | "real";

/**
 * Debit a gameplay stake, bonus-first, all-or-nothing from a single balance.
 *
 * Tries to cover the full amount from bonusBalance; if bonus can't cover it,
 * covers it from walletBalance. Never splits across the two (keeps the origin of
 * each stake unambiguous and the debit race-safe via a single conditional
 * updateMany per attempt). Throws "INSUFFICIENT_BALANCE" if neither covers it.
 *
 * Returns which balance the stake came from so callers can record it and, later,
 * credit winnings back to the correct balance.
 */
export async function spendForPlay(
  tx: TxClient,
  userId: string,
  amount: number,
): Promise<{ source: PlaySource }> {
  const fromBonus = await tx.user.updateMany({
    where: { id: userId, bonusBalance: { gte: amount } },
    data:  { bonusBalance: { decrement: amount } },
  });
  if (fromBonus.count > 0) return { source: "bonus" };

  const fromReal = await tx.user.updateMany({
    where: { id: userId, walletBalance: { gte: amount } },
    data:  { walletBalance: { decrement: amount } },
  });
  if (fromReal.count > 0) return { source: "real" };

  throw new Error("INSUFFICIENT_BALANCE");
}

/** Credit a stake back to the balance it came from (refunds / cash-outs / wins). */
export async function creditForPlay(
  tx: TxClient,
  userId: string,
  amount: number,
  source: PlaySource,
): Promise<void> {
  await tx.user.update({
    where: { id: userId },
    data:  source === "bonus"
      ? { bonusBalance:  { increment: amount } }
      : { walletBalance: { increment: amount } },
  });
}
