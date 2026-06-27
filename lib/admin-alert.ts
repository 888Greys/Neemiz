import { db } from "@/lib/db";
import { sendLowFloatAlertEmail, sendSuspiciousNumberAlertEmail } from "@/lib/brevo";
import { CURRENCY_SYMBOL } from "@/lib/currency";

/**
 * Alert all owners/admins that the M-Pesa float is too low to pay out a
 * customer withdrawal, so they can top it up. The withdrawal stays queued and
 * is auto-processed once funds are available.
 *
 * Deduped: if an unread `admin_low_float` alert was raised in the last 30 min,
 * we don't spam another round of notifications/emails.
 */
export async function notifyAdminsLowFloat(info: { amountKes: number; msisdn?: string }) {
  const since = new Date(Date.now() - 30 * 60_000);
  const recent = await db.notification.findFirst({
    where: { type: "admin_low_float", isRead: false, createdAt: { gte: since } },
    select: { id: true },
  });
  if (recent) return; // already alerted recently — avoid noise

  const admins = await db.user.findMany({ where: { isAdmin: true }, select: { id: true } });
  if (admins.length > 0) {
    await db.notification.createMany({
      data: admins.map((a) => ({
        userId: a.id,
        type:   "admin_low_float",
        title:  "M-Pesa float low — top up now",
        body:   `A customer withdrawal of ${CURRENCY_SYMBOL} ${info.amountKes.toLocaleString()} couldn't be paid out (insufficient float). It's queued and will auto-send once you top up.`,
        link:   "/admin/withdrawals",
      })),
    });
  }

  // Best-effort owner email — never let a mail failure block the withdrawal flow.
  try { await sendLowFloatAlertEmail(info.amountKes, info.msisdn); }
  catch (e) { console.error("[admin-alert] low-float email failed", e); }
}

/**
 * Alert all owners/admins that one M-Pesa destination number is receiving an
 * unusual volume of withdrawals (possible mule/collector funneling drained
 * accounts into a single number). The triggering withdrawal is auto-held for
 * approval by the caller; this just raises the alert.
 *
 * Deduped per number: if an unread alert for the same msisdn was raised in the
 * last 30 min, we skip re-notifying.
 */
export async function notifyAdminsSuspiciousNumber(info: { msisdn: string; count: number; amountKes: number; held: boolean; autoKilled?: boolean; distinctUsers?: number }) {
  // An auto-kill event is high-severity — never suppress it by dedupe.
  if (!info.autoKilled) {
    const since = new Date(Date.now() - 30 * 60_000);
    const recent = await db.notification.findFirst({
      where: { type: "admin_suspicious_number", isRead: false, createdAt: { gte: since }, body: { contains: info.msisdn } },
      select: { id: true },
    });
    if (recent) return; // already alerted for this number recently
  }

  const usersNote = info.distinctUsers ? ` from ${info.distinctUsers} accounts` : "";
  const title = info.autoKilled
    ? "🚨 Withdrawals AUTO-DISABLED — collector number"
    : "⚠️ Repeated withdrawals to one number";
  const body = info.autoKilled
    ? `+${info.msisdn} received ${info.count} withdrawals${usersNote} — all withdrawals have been automatically frozen. Review and re-enable from the kill switch when safe.`
    : `+${info.msisdn} has received ${info.count} withdrawals in 24h (latest ${CURRENCY_SYMBOL} ${info.amountKes.toLocaleString()}). ${info.held ? "Held for approval." : "Allowed."}`;

  const admins = await db.user.findMany({ where: { isAdmin: true }, select: { id: true } });
  if (admins.length > 0) {
    await db.notification.createMany({
      data: admins.map((a) => ({
        userId: a.id,
        type:   "admin_suspicious_number",
        title,
        body,
        link:   "/admin/withdrawals",
      })),
    });
  }

  try { await sendSuspiciousNumberAlertEmail(info); }
  catch (e) { console.error("[admin-alert] suspicious-number email failed", e); }
}
