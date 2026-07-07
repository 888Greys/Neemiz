/**
 * Daily cash-out window.
 *
 * Uses a ROLLING 24-hour window, NOT a fixed calendar-day reset. A fixed reset
 * (e.g. 02:00 EAT) is gameable at the boundary: a user could withdraw the full
 * limit at 01:59 and the full limit again at 02:01 — double the cap in minutes.
 * (This was exploited: see the muuoeric91 2×500 incident, 2026-06-26.) With a
 * rolling window the sum of the last 24h can never exceed the limit.
 */

import { TransactionStatus, TransactionType } from "@prisma/client";

/** Length of the rolling cash-out window. */
export const WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

/** Start of the current rolling window — exactly 24h ago, as a UTC Date. */
export function withdrawalWindowStart(now: number = Date.now()): Date {
  return new Date(now - WINDOW_MS);
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
 * Prisma `where` for the rows that count against a user's cash-out cap, scoped
 * to the rolling 24h window. Shared by the withdraw + transfer routes so they
 * enforce one unified limit. FAILED/CANCELLED (i.e. refunded) excluded.
 */
export function dailyCapWhere(userId: string, now: number = Date.now()) {
  return {
    userId,
    type:      TransactionType.WITHDRAWAL,
    provider:  { in: [...DAILY_CAP_PROVIDERS] },
    status:    { notIn: [TransactionStatus.FAILED, TransactionStatus.CANCELLED] },
    createdAt: { gte: withdrawalWindowStart(now) },
  };
}

/**
 * Prisma `where` for outgoing WALLET TRANSFERS only, in the rolling window.
 * Admins are exempt from the withdrawal cap (owner treasury) but STILL capped on
 * transfers, so a compromised admin account can only send the daily limit — not
 * drain the treasury via user-to-user sends.
 */
export function transferCapWhere(userId: string, now: number = Date.now()) {
  return {
    userId,
    type:      TransactionType.WITHDRAWAL,
    provider:  "wallet_transfer",
    status:    { notIn: [TransactionStatus.FAILED, TransactionStatus.CANCELLED] },
    createdAt: { gte: withdrawalWindowStart(now) },
  };
}
