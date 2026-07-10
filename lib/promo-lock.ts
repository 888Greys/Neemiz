import { db } from "@/lib/db";
import { CURRENCY_SYMBOL, MONEY_LOCALE } from "@/lib/currency";

/**
 * Promo credits land in the main wallet but must not be transferable /
 * withdrawable as cash. We treat the sum of all promo redemptions as a
 * permanent lock against cash-out: transferable = max(0, wallet − promoLocked).
 *
 * Fungible accounting: once the user deposits or wins above the lock, the
 * surplus can leave; the promo principal itself cannot be sent to another
 * account or withdrawn.
 */
export async function getPromoLockedKes(userId: string): Promise<number> {
  const agg = await db.promoRedemption.aggregate({
    where: { userId },
    _sum: { amountKes: true },
  });
  const locked = Number(agg._sum.amountKes ?? 0);
  return Number.isFinite(locked) && locked > 0 ? locked : 0;
}

export async function getTransferableKes(
  userId: string,
  walletBalance: number,
): Promise<{ transferable: number; locked: number }> {
  const locked = await getPromoLockedKes(userId);
  const bal = Number(walletBalance) || 0;
  return {
    locked,
    transferable: Math.max(0, Math.round((bal - locked) * 100) / 100),
  };
}

/** Throw PROMO_LOCKED:<transferable>:<locked> if amount exceeds transferable. */
export function assertNotPromoLocked(amount: number, transferable: number, locked: number) {
  if (locked <= 0) return;
  if (amount <= transferable + 1e-9) return;
  throw new Error(`PROMO_LOCKED:${transferable}:${locked}`);
}

export function promoLockedHttpError(message: string) {
  const parts = message.split(":");
  const transferable = Number(parts[1] ?? 0);
  const locked = Number(parts[2] ?? 0);
  const lockLabel = `${CURRENCY_SYMBOL} ${locked.toLocaleString(MONEY_LOCALE, { maximumFractionDigits: 0 })}`;
  if (transferable <= 0) {
    return {
      status: 400 as const,
      body: {
        error: `Promo credit can't be transferred. Welcome/promo balances stay on your account — deposit your own funds to send money.`,
        code: "PROMO_LOCKED",
        promoLocked: locked,
        transferable: 0,
      },
    };
  }
  return {
    status: 400 as const,
    body: {
      error: `Only ${CURRENCY_SYMBOL} ${transferable.toLocaleString(MONEY_LOCALE)} can leave your wallet — ${lockLabel} is promo credit and stays locked.`,
      code: "PROMO_LOCKED",
      promoLocked: locked,
      transferable,
    },
  };
}
