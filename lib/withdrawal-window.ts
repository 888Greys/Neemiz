/**
 * Daily M-Pesa withdrawal window.
 *
 * The KSh limit resets each day at 02:00 East Africa Time (UTC+3), not at the
 * server's midnight. We compute the most recent 02:00 EAT boundary as a real
 * UTC instant so it works regardless of the server timezone.
 */

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
