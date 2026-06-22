import { db } from "@/lib/db";
import { sendLowFloatAlertEmail } from "@/lib/brevo";
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
