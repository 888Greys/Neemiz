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
 *
 * WAGERING CYCLE — how bonus eventually becomes real money:
 *   A grant starts (or extends) a cycle: bonusWagerRemaining += grant x
 *   BONUS_WAGER_MULT, bonusCashoutCap += grant x BONUS_CASHOUT_MULT, and
 *   bonusExpiresAt is pushed out BONUS_EXPIRY_DAYS. While a cycle is active:
 *     - every stake (bonus OR real) counts down bonusWagerRemaining;
 *     - game winnings are credited to bonusBalance (creditWinnings), NOT real —
 *       this is the lock that stops "50 bonus -> one lucky win -> real cash";
 *     - when bonusWagerRemaining hits 0, min(bonusBalance, bonusCashoutCap)
 *       converts to walletBalance and the excess is forfeited;
 *     - at bonusExpiresAt the whole bonus is forfeited.
 *   bonusExpiresAt == NULL means no cycle: legacy bonus stays playable forever
 *   but never converts, and winnings go straight to real (pre-cycle behavior).
 */

import type { Prisma } from "@prisma/client";
import { TransactionStatus, TransactionType } from "@prisma/client";

type TxClient = Omit<
  Prisma.TransactionClient,
  "$connect" | "$disconnect" | "$on" | "$use" | "$extends" | "$transaction"
>;

export type PlaySource = "bonus" | "real";

/** x of the granted amount that must be staked before the bonus converts. */
export function bonusWagerMult(): number {
  const v = Number(process.env.BONUS_WAGER_MULT ?? "8");
  return Number.isFinite(v) && v > 0 ? v : 8;
}

/** x of the granted amount that is the most a cycle can convert to real. */
export function bonusCashoutMult(): number {
  const v = Number(process.env.BONUS_CASHOUT_MULT ?? "4");
  return Number.isFinite(v) && v > 0 ? v : 4;
}

/** Days until an unfinished cycle forfeits. */
export function bonusExpiryDays(): number {
  const v = Number(process.env.BONUS_EXPIRY_DAYS ?? "7");
  return Number.isFinite(v) && v > 0 ? v : 7;
}

type CycleRow = {
  bonusBalance: Prisma.Decimal;
  bonusWagerRemaining: Prisma.Decimal;
  bonusCashoutCap: Prisma.Decimal;
  bonusExpiresAt: Date | null;
};

async function readCycle(tx: TxClient, userId: string): Promise<CycleRow | null> {
  return tx.user.findUnique({
    where: { id: userId },
    select: {
      bonusBalance: true,
      bonusWagerRemaining: true,
      bonusCashoutCap: true,
      bonusExpiresAt: true,
    },
  });
}

async function auditBonusEvent(
  tx: TxClient,
  userId: string,
  action: "bonus_converted" | "bonus_expired",
  metadata: Record<string, unknown>,
): Promise<void> {
  await tx.transaction.create({
    data: {
      userId,
      type: TransactionType.BONUS,
      amount: Number(metadata.converted ?? metadata.forfeited ?? 0),
      currency: "KES",
      status: TransactionStatus.COMPLETED,
      reference: `${action}-${userId}-${Date.now()}`,
      provider: "bonus_cycle",
      metadata: { action, ...metadata },
    },
  });
}

/**
 * Settle a due wagering cycle for this user, if any:
 *   - expired cycle  -> forfeit the whole bonus, clear the cycle;
 *   - completed cycle (wagerRemaining <= 0, bonus left) -> convert
 *     min(bonus, cashoutCap) to real, forfeit the excess, clear the cycle.
 *
 * Both transitions are claimed with a conditional updateMany keyed on the
 * values we just read, so two concurrent settlers can't double-convert; the
 * loser of the race simply no-ops (the winner already settled it).
 */
export async function settleBonusCycleIfDue(tx: TxClient, userId: string): Promise<void> {
  const u = await readCycle(tx, userId);
  if (!u || !u.bonusExpiresAt) return; // no active cycle

  const bonus     = Number(u.bonusBalance);
  const remaining = Number(u.bonusWagerRemaining);
  const now       = new Date();
  const cleared   = {
    bonusBalance: 0,
    bonusWagerRemaining: 0,
    bonusCashoutCap: 0,
    bonusExpiresAt: null,
  };

  if (u.bonusExpiresAt <= now) {
    const claimed = await tx.user.updateMany({
      where: { id: userId, bonusExpiresAt: u.bonusExpiresAt },
      data:  cleared,
    });
    if (claimed.count > 0 && bonus > 0) {
      await auditBonusEvent(tx, userId, "bonus_expired", { forfeited: bonus });
    }
    return;
  }

  if (remaining <= 0 && bonus > 0) {
    const converted = Math.min(bonus, Number(u.bonusCashoutCap));
    const forfeited = bonus - converted;
    const claimed = await tx.user.updateMany({
      where: {
        id: userId,
        bonusBalance: u.bonusBalance,
        bonusWagerRemaining: { lte: 0 },
        bonusExpiresAt: u.bonusExpiresAt,
      },
      data: { ...cleared, walletBalance: { increment: converted } },
    });
    if (claimed.count > 0) {
      await auditBonusEvent(tx, userId, "bonus_converted", { converted, forfeited });
    }
  }
}

/**
 * Debit a gameplay stake, bonus-first, all-or-nothing from a single balance.
 *
 * Tries to cover the full amount from bonusBalance; if bonus can't cover it,
 * covers it from walletBalance. Never splits across the two (keeps the origin of
 * each stake unambiguous and the debit race-safe via a single conditional
 * updateMany per attempt). Throws "INSUFFICIENT_BALANCE" if neither covers it.
 *
 * While a wagering cycle is active, EVERY stake (bonus or real) counts toward
 * the turnover requirement; when it completes the cycle converts inline.
 *
 * Returns which balance the stake came from so callers can record it and, later,
 * credit winnings back to the correct balance.
 */
export async function spendForPlay(
  tx: TxClient,
  userId: string,
  amount: number,
): Promise<{ source: PlaySource }> {
  // Forfeit an expired cycle up front so expired bonus can't be staked.
  await settleBonusCycleIfDue(tx, userId);

  const fromBonus = await tx.user.updateMany({
    where: { id: userId, bonusBalance: { gte: amount } },
    data:  { bonusBalance: { decrement: amount } },
  });
  let source: PlaySource | null = fromBonus.count > 0 ? "bonus" : null;

  if (!source) {
    const fromReal = await tx.user.updateMany({
      where: { id: userId, walletBalance: { gte: amount } },
      data:  { walletBalance: { decrement: amount } },
    });
    if (fromReal.count > 0) source = "real";
  }
  if (!source) throw new Error("INSUFFICIENT_BALANCE");

  // Count the stake toward an active wagering cycle (floor at 0), then
  // convert inline if this stake completed the requirement.
  const counted = await tx.user.updateMany({
    where: { id: userId, bonusExpiresAt: { not: null }, bonusWagerRemaining: { gt: 0 } },
    data:  { bonusWagerRemaining: { decrement: amount } },
  });
  if (counted.count > 0) {
    await tx.user.updateMany({
      where: { id: userId, bonusWagerRemaining: { lt: 0 } },
      data:  { bonusWagerRemaining: 0 },
    });
    await settleBonusCycleIfDue(tx, userId);
  }

  return { source };
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

/**
 * Credit game winnings (or stake refunds) to the right balance.
 *
 * While a wagering cycle is active the credit goes to bonusBalance — winnings
 * born from an unfinished bonus stay locked until the turnover requirement is
 * met (then the whole pot converts, capped). With no active cycle it goes to
 * real, exactly as before the bonus system existed.
 *
 * Returns which balance was credited so callers can record it in metadata.
 */
export async function creditWinnings(
  tx: TxClient,
  userId: string,
  amount: number,
): Promise<{ balance: PlaySource }> {
  if (amount <= 0) return { balance: "real" };

  // Expire/convert a due cycle first so we don't credit into a dead cycle.
  await settleBonusCycleIfDue(tx, userId);

  const toBonus = await tx.user.updateMany({
    where: {
      id: userId,
      bonusExpiresAt: { not: null, gt: new Date() },
      bonusWagerRemaining: { gt: 0 },
    },
    data: { bonusBalance: { increment: amount } },
  });
  if (toBonus.count > 0) return { balance: "bonus" };

  await tx.user.update({
    where: { id: userId },
    data:  { walletBalance: { increment: amount } },
  });
  return { balance: "real" };
}
