import { db } from "@/lib/db";
import { sendLowFloatAlertEmail, sendSuspiciousNumberAlertEmail, sendReconMismatchEmail, sendBotSignupAlertEmail } from "@/lib/brevo";
import { CURRENCY_SYMBOL } from "@/lib/currency";

export interface BotSignupReport {
  windowMinutes: number;
  totalSignups: number;
  burst: boolean;
  burstThreshold: number;
  clusters: Array<{ at: string; count: number }>;
  devices: Array<{ deviceHash: string; users: number }>;
}

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

/**
 * Alert all owners/admins that the daily ledger reconciliation found accounts
 * holding balance the transactions ledger can't explain — i.e. money injected
 * straight into wallet_balance (the signature of a DB compromise / re-breach).
 *
 * Deduped: one alert per 12h (the cron runs daily, but guard against retries).
 */
export async function notifyAdminsReconMismatch(
  findings: Array<{ username: string | null; balance: number; unexplained: number }>,
) {
  if (findings.length === 0) return;

  const since = new Date(Date.now() - 12 * 60 * 60_000);
  const recent = await db.notification.findFirst({
    where: { type: "admin_recon", isRead: false, createdAt: { gte: since } },
    select: { id: true },
  });
  if (recent) return;

  const total = findings.reduce((s, f) => s + f.unexplained, 0);
  const top = findings.slice(0, 5).map((f) => `@${f.username ?? "?"} (+${CURRENCY_SYMBOL} ${f.unexplained.toLocaleString()})`).join(", ");
  const body = `${findings.length} active account(s) hold unexplained balance (no ledger trail) totaling ${CURRENCY_SYMBOL} ${total.toLocaleString()} — possible balance injection / DB re-breach. ${top}. Verify keys are not leaked and review immediately.`;

  const admins = await db.user.findMany({ where: { isAdmin: true }, select: { id: true } });
  if (admins.length > 0) {
    await db.notification.createMany({
      data: admins.map((a) => ({
        userId: a.id,
        type:   "admin_recon",
        title:  "🚨 Unexplained balances detected (possible re-breach)",
        body,
        link:   "/admin/withdrawals",
      })),
    });
  }

  try { await sendReconMismatchEmail(findings, total); }
  catch (e) { console.error("[admin-alert] recon email failed", e); }
}

/**
 * Alert all owners/admins that the signup-velocity tripwire detected likely bot
 * account farming (abnormal signup burst, tight same-second clusters, or one
 * device registering many accounts). Detection-only — no accounts are frozen.
 *
 * Deduped: one alert per 30 min (guards against overlapping cron runs).
 */
export async function notifyAdminsBotSignups(report: BotSignupReport) {
  const since = new Date(Date.now() - 30 * 60_000);
  const recent = await db.notification.findFirst({
    where: { type: "admin_bot_signup", isRead: false, createdAt: { gte: since } },
    select: { id: true },
  });
  if (recent) return; // already alerted recently — avoid noise

  const reasons: string[] = [];
  if (report.burst) reasons.push(`${report.totalSignups} signups in ${report.windowMinutes}m`);
  if (report.clusters.length) reasons.push(`${report.clusters.length} same-second cluster(s)`);
  if (report.devices.length) reasons.push(`${report.devices.length} shared-device group(s)`);
  const body = `Possible bot account farming: ${reasons.join(", ")}. ${report.totalSignups} new account(s) in the last ${report.windowMinutes} min. No accounts frozen — review new signups.`;

  const admins = await db.user.findMany({ where: { isAdmin: true }, select: { id: true } });
  if (admins.length > 0) {
    await db.notification.createMany({
      data: admins.map((a) => ({
        userId: a.id,
        type:   "admin_bot_signup",
        title:  "🤖 Possible bot signups detected",
        body,
        link:   "/admin/players",
      })),
    });
  }

  try { await sendBotSignupAlertEmail(report); }
  catch (e) { console.error("[admin-alert] bot-signup email failed", e); }
}
