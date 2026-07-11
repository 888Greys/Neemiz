import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { CURRENCY_SYMBOL, MONEY_LOCALE } from "@/lib/currency";

/**
 * A Prisma client or transaction client. Accepting either lets the withdraw
 * route enforce the gate INSIDE its balance transaction (so it's race-safe)
 * while UI/display callers use the top-level db. The full PrismaClient is
 * structurally assignable to TransactionClient.
 */
type LockClient = Prisma.TransactionClient;

/**
 * Real external funding rails. A completed DEPOSIT from one of these is the only
 * thing that lifts the no-deposit promo lock. Deliberately EXCLUDES internal
 * money movements that a farmer can conjure without paying anything:
 *   • wallet_transfer / transfer — an accomplice sending them credit
 *   • p2p_kes_escrow / merchant_escrow — P2P receipt
 *   • kes_coin_convert — internal balance conversion
 *   • manual — admin-issued credit
 * so unlocking requires genuine cash-in through a payment processor.
 */
export const REAL_DEPOSIT_PROVIDERS = [
  "lipaharaka",
  "megapay",
  "pesapal",
  "relworx",
  "crypto",
] as const;

/** True once the account has funded via a real external payment rail. */
export async function hasQualifyingDeposit(client: LockClient, userId: string): Promise<boolean> {
  const dep = await client.transaction.findFirst({
    where: {
      userId,
      type: "DEPOSIT",
      status: "COMPLETED",
      provider: { in: REAL_DEPOSIT_PROVIDERS as unknown as string[] },
    },
    select: { id: true },
  });
  return dep != null;
}

/**
 * Promo credits land in the main wallet but must not be cashable as real money.
 *
 * Deposit-to-withdraw gate: promo credit AND everything it generates (winnings
 * from staking it) stay non-withdrawable until the account makes a real deposit.
 * A never-deposited account has transferable = 0 — this is what stops promo
 * farming, and it holds regardless of any game-pricing edge, because the exit
 * (cash-out) is gated on real cash-in rather than on the promo principal alone.
 *
 * After a qualifying deposit the lock relaxes to just the promo PRINCIPAL
 * (transferable = wallet − Σpromo): the free credit itself still can't leave,
 * but the user's own money and winnings can.
 */
export async function getPromoLockedKes(
  client: LockClient,
  userId: string,
  walletBalance: number,
): Promise<number> {
  const agg = await client.promoRedemption.aggregate({
    where: { userId },
    _sum: { amountKes: true },
  });
  const principal = Number(agg._sum.amountKes ?? 0);
  if (!Number.isFinite(principal) || principal <= 0) return 0;

  const funded = await hasQualifyingDeposit(client, userId);
  const bal = Number(walletBalance) || 0;
  // Unfunded: lock the whole wallet (nothing withdrawable). Funded: lock only
  // the promo principal.
  return funded ? principal : Math.max(principal, bal);
}

export async function getTransferableKes(
  userId: string,
  walletBalance: number,
): Promise<{ transferable: number; locked: number }> {
  const locked = await getPromoLockedKes(db, userId, walletBalance);
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
        error: `Welcome/promo credit is play-only. Make a deposit with your own funds to unlock cash-outs and transfers.`,
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
