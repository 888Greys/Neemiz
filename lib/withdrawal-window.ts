/**
 * Daily M-Pesa withdrawal window.
 *
 * The KSh limit resets each day at 02:00 East Africa Time (UTC+3), not at the
 * server's midnight. We compute the most recent 02:00 EAT boundary as a real
 * UTC instant so it works regardless of the server timezone.
 */

import { TransactionStatus, TransactionType } from "@prisma/client";

const EAT_OFFSET_MS = 3 * 60 * 60 * 1000; // UTC+3
export const RESET_HOUR_EAT = 2;          // 02:00 EAT

/** Start of the current withdrawal day — the most recent 02:00 EAT, as a UTC Date. */
export function withdrawalDayStart(now: number = Date.now()): Date {
  const eat = new Date(now + EAT_OFFSET_MS); // shift so UTC getters read EAT wall-clock
  let boundary = Date.UTC(eat.getUTCFullYear(), eat.getUTCMonth(), eat.getUTCDate(), RESET_HOUR_EAT, 0, 0);
  if (eat.getUTCHours() < RESET_HOUR_EAT) boundary -= 24 * 60 * 60 * 1000; // before 02:00 → previous day's window
  return new Date(boundary - EAT_OFFSET_MS);
}

/** When the current window resets (next 02:00 EAT), as a UTC Date. */
export function withdrawalDayReset(now: number = Date.now()): Date {
  return new Date(withdrawalDayStart(now).getTime() + 24 * 60 * 60 * 1000);
}

/** Configurable daily cap in KES (default 500). */
export function dailyLimitKes(): number {
  const parsed = Number(process.env.WITHDRAWAL_DAILY_LIMIT_KES ?? "500");
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 500;
}

/**
 * Providers whose outgoing WITHDRAWAL-typed rows count against the shared daily
 * cash-out cap. M-Pesa (lipaharaka) and internal wallet transfers both move
 * value out of the sender's control, so a user can't dodge the M-Pesa cap by
 * routing cash through a transfer to an accomplice who then withdraws.
 *
 * Deliberately EXCLUDED (own controls, not simple cash-outs): p2p_kes_escrow,
 * self_custody (crypto).
 */
export const DAILY_CAP_PROVIDERS = ["lipaharaka", "wallet_transfer"] as const;

/**
 * Prisma `where` for the rows that count against a user's daily cash-out cap,
 * scoped to the current withdrawal day. Shared by the withdraw + transfer routes
 * so they enforce one unified limit. FAILED/CANCELLED (i.e. refunded) excluded.
 */
export function dailyCapWhere(userId: string, now: number = Date.now()) {
  return {
    userId,
    type:      TransactionType.WITHDRAWAL,
    provider:  { in: [...DAILY_CAP_PROVIDERS] },
    status:    { notIn: [TransactionStatus.FAILED, TransactionStatus.CANCELLED] },
    createdAt: { gte: withdrawalDayStart(now) },
  };
}
