import { Prisma, TransactionType, TransactionStatus } from "@prisma/client";
import { REAL_DEPOSIT_PROVIDERS } from "@/lib/promo-lock";

/**
 * First-deposit bonus: the user's FIRST real deposit is matched by a percentage
 * (default 25%), credited as a PLAY-ONLY bonus.
 *
 * "Play-only" is enforced by reusing the promo-lock machinery: the bonus is
 * recorded as a `promo_redemptions` row, so getPromoLockedKes (lib/promo-lock)
 * keeps that principal permanently non-withdrawable — the free credit can be
 * played but never cashed out, while the user's own deposit stays withdrawable.
 * The unique (promo_code_id, user_id) constraint means each account can only
 * ever receive it once, which — together with the prior-deposit check — makes
 * it strictly a first-deposit reward. Not farmable.
 *
 * Admin Active/Off on the FIRSTDEPOSIT row is the kill switch for auto-grant.
 * Typed redeem of this code is blocked in promo-redeem (amount is 0 anyway);
 * this helper writes the redemption directly when isActive is true.
 */
export const FIRST_DEPOSIT_BONUS_CODE = "FIRSTDEPOSIT";

const PCT = Number(process.env.FIRST_DEPOSIT_BONUS_PCT ?? 50);
const CAP_KES = Number(process.env.FIRST_DEPOSIT_BONUS_CAP_KES ?? 5000);

type TxClient = Prisma.TransactionClient;

/**
 * Grant the first-deposit bonus inside the deposit-completion transaction.
 * `completedTxId` is the just-COMPLETED deposit row (excluded from the
 * prior-deposit check). Returns the bonus credited (0 if not eligible).
 * Best-effort: never throws — a bonus hiccup must not fail the deposit credit.
 */
export async function grantFirstDepositBonus(
  tx: TxClient,
  userId: string,
  depositAmount: number,
  completedTxId: string,
): Promise<number> {
  try {
    if (!Number.isFinite(PCT) || PCT <= 0) return 0;

    // Only on the user's genuine FIRST completed real deposit.
    const priorDeposits = await tx.transaction.count({
      where: {
        userId,
        type: TransactionType.DEPOSIT,
        status: TransactionStatus.COMPLETED,
        provider: { in: REAL_DEPOSIT_PROVIDERS as unknown as string[] },
        id: { not: completedTxId },
      },
    });
    if (priorDeposits > 0) return 0;

    const promo = await tx.promoCode.findUnique({
      where: { code: FIRST_DEPOSIT_BONUS_CODE },
      select: { id: true, isActive: true },
    });
    // Off in admin = stop granting. Seeded inactive until ops Activate it.
    if (!promo || !promo.isActive) return 0;

    const bonus = Math.min(Math.floor((depositAmount * PCT) / 100), CAP_KES);
    if (bonus <= 0) return 0;

    // Already granted? The redemption row is the once-per-user guard. Check
    // first so we never throw inside the surrounding deposit transaction.
    const existing = await tx.promoRedemption.findUnique({
      where: { promoCodeId_userId: { promoCodeId: promo.id, userId } },
      select: { id: true },
    });
    if (existing) return 0;

    // This row is both the play-only lock AND the once-per-user record.
    await tx.promoRedemption.create({
      data: { promoCodeId: promo.id, userId, amountKes: bonus },
    });

    await tx.user.update({
      where: { id: userId },
      data: { walletBalance: { increment: bonus } },
    });

    await tx.transaction.create({
      data: {
        userId,
        type: TransactionType.BONUS,
        amount: bonus,
        currency: "KES",
        status: TransactionStatus.COMPLETED,
        reference: `firstdep-${completedTxId}`,
        provider: "first_deposit_bonus",
        metadata: {
          action: "first_deposit_bonus",
          depositAmount,
          pct: PCT,
          playOnly: true,
        },
      },
    });

    return bonus;
  } catch (err) {
    // Never let a bonus failure roll back / block the deposit credit.
    console.error(`first-deposit bonus failed for user ${userId}:`, err);
    return 0;
  }
}
