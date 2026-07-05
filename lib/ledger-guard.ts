import type { Prisma } from "@prisma/client";

/**
 * Ledger-derived balance guard.
 *
 * Background: in the 2026-06-29 incident an attacker with leaked DB credentials
 * wrote `users.wallet_balance` DIRECTLY, with no corresponding `transactions`
 * row, then cashed the phantom balance out via M-Pesa. The app ALWAYS records a
 * transaction alongside every balance change, so any balance that is NOT backed
 * by the transaction ledger is injected/unaccounted.
 *
 * This guard recomputes how much of a user's KES balance is provably backed by
 * the ledger and refuses to let an unbacked surplus leave the platform. It is
 * deliberately one-directional: it only ever BLOCKS withdrawing more than the
 * ledger supports. Legitimate accounts whose wallet_balance is *below* their
 * ledger total (e.g. due to admin balance resets or escrow holds) are never
 * affected — they can still withdraw their full wallet_balance.
 */

// Credits increase balance; debits decrease it. Mirrors the app's own ledger
// semantics (see transaction creation sites). Amounts can be negative for
// clawback-style BONUS/REFUND rows, which the signed sum handles correctly.
const CREDIT_TYPES = ["DEPOSIT", "BET_WIN", "BONUS", "REFUND"];
const DEBIT_TYPES = ["WITHDRAWAL", "BET_STAKE"];

/**
 * The KES balance that is provably backed by the transaction ledger:
 *   SUM(credits) - SUM(debits)   over all non-cancelled/non-failed KES rows.
 *
 * Run inside the same transaction as the withdrawal so it sees a consistent
 * snapshot (the row lock taken by the balance debit serializes concurrent
 * cash-outs for this user).
 */
export async function ledgerBackedBalanceKes(
  tx: Prisma.TransactionClient,
  userId: string,
): Promise<number> {
  const rows = await tx.$queryRaw<{ net: bigint | string | null }[]>`
    SELECT COALESCE(SUM(
      CASE
        WHEN "type" IN ('DEPOSIT','BET_WIN','BONUS','REFUND') THEN amount
        WHEN "type" IN ('WITHDRAWAL','BET_STAKE')            THEN -amount
        ELSE 0
      END), 0) AS net
    FROM transactions
    WHERE user_id = ${userId}
      AND currency = 'KES'
      AND status NOT IN ('FAILED','CANCELLED')`;
  return Number(rows[0]?.net ?? 0);
}

/** Thrown when a withdrawal would draw on balance the ledger cannot account for. */
export class LedgerUnbackedError extends Error {
  constructor(public readonly backed: number, public readonly requested: number) {
    super("LEDGER_UNBACKED");
  }
}

/**
 * Assert that `amountKes` is fully backed by the ledger. Call inside the
 * withdrawal transaction, AFTER the balance debit and BEFORE creating the
 * withdrawal row (so the new debit is not yet counted). Throws
 * LedgerUnbackedError if the request exceeds the ledger-backed balance.
 */
export async function assertLedgerBacked(
  tx: Prisma.TransactionClient,
  userId: string,
  amountKes: number,
): Promise<void> {
  const backed = await ledgerBackedBalanceKes(tx, userId);
  // Small tolerance for rounding on Decimal(18,2) arithmetic.
  if (amountKes > backed + 0.01) {
    throw new LedgerUnbackedError(backed, amountKes);
  }
}

export { CREDIT_TYPES, DEBIT_TYPES };
