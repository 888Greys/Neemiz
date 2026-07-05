import { db } from "@/lib/db";
import { sendBusinessMetricAlertEmail } from "@/lib/brevo";

// ─── Business-metric alerting ────────────────────────────────────────────────
// A periodic health check over the money-movement spine: deposits, payouts, and
// settlement. It exists so an operational problem (the payment provider rejecting
// STK pushes, payouts not confirming, a settlement backlog) pages the owner
// instead of being noticed days later on the provider dashboard. Each metric has
// an env-tunable threshold; a breach raises a deduped admin notification + one
// consolidated owner email. Read-only except for the notifications it writes.

export type MetricAlert = {
  /** Stable key, also used to dedupe (notification type = `admin_metric:<key>`). */
  key: string;
  title: string;
  detail: string;
  /** Where the owner should look. */
  link: string;
  severity: "warn" | "critical";
};

const num = (v: string | undefined, fallback: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

/** Pure evaluation: compute the current metrics and return any that breach. */
export async function evaluateBusinessMetrics(): Promise<MetricAlert[]> {
  const windowMin = num(process.env.METRIC_WINDOW_MINUTES, 60);
  const since = new Date(Date.now() - windowMin * 60_000);

  // Thresholds (env-overridable so they can be tuned without a deploy).
  const depInitErrThreshold = num(process.env.METRIC_DEPOSIT_INIT_ERRORS, 5);
  const depMinSample        = num(process.env.METRIC_DEPOSIT_MIN_SAMPLE, 10);
  const depMinSuccessRate   = num(process.env.METRIC_DEPOSIT_MIN_SUCCESS_RATE, 0.2);
  const wdStuckMinutes      = num(process.env.METRIC_WITHDRAWAL_STUCK_MINUTES, 25);
  const wdStuckThreshold    = num(process.env.METRIC_WITHDRAWAL_STUCK_COUNT, 1);
  const approvalAgeMinutes  = num(process.env.METRIC_APPROVAL_AGE_MINUTES, 60);
  const approvalThreshold   = num(process.env.METRIC_APPROVAL_COUNT, 1);
  const settlementThreshold = num(process.env.METRIC_SETTLEMENT_BACKLOG, 25);

  const wdStuckCutoff   = new Date(Date.now() - wdStuckMinutes * 60_000);
  const approvalCutoff  = new Date(Date.now() - approvalAgeMinutes * 60_000);
  const dayAgo          = new Date(Date.now() - 24 * 60 * 60_000);

  const [depAgg, depInitErrRows, wdStuck, wdApproval, settlementBacklog] = await Promise.all([
    // Deposit completion vs failure within the window (terminal states only).
    db.$queryRaw<Array<{ status: string; n: bigint }>>`
      SELECT status::text AS status, count(*) AS n
      FROM transactions
      WHERE provider = 'lipaharaka' AND type = 'DEPOSIT'
        AND status IN ('COMPLETED','FAILED') AND created_at >= ${since}
      GROUP BY status`,
    // STK-initiation failures: FAILED with no provider callback and not expired by
    // the reconcile sweep — i.e. Lipa rejected our STK request synchronously.
    db.$queryRaw<Array<{ n: bigint }>>`
      SELECT count(*) AS n
      FROM transactions
      WHERE provider = 'lipaharaka' AND type = 'DEPOSIT' AND status = 'FAILED'
        AND created_at >= ${since}
        AND NOT (metadata ? 'lipaCallback') AND NOT (metadata ? 'lipaReconciled')`,
    // Payouts sent to Lipa but unconfirmed past the stuck window.
    db.transaction.count({
      where: { provider: "lipaharaka", type: "WITHDRAWAL", status: "PENDING", createdAt: { lt: wdStuckCutoff } },
    }),
    // Withdrawals awaiting owner approval beyond the SLA age.
    db.transaction.count({
      where: { type: "WITHDRAWAL", status: "PENDING_APPROVAL", createdAt: { lt: approvalCutoff } },
    }),
    // Settlement backlog: sports bets stuck PENDING past 24h (the stateId-5 bug).
    db.bet.count({ where: { status: "PENDING", createdAt: { lt: dayAgo } } }),
  ]);

  const completed = Number(depAgg.find((r) => r.status === "COMPLETED")?.n ?? 0);
  const failed = Number(depAgg.find((r) => r.status === "FAILED")?.n ?? 0);
  const terminal = completed + failed;
  const successRate = terminal > 0 ? completed / terminal : 1;
  const initErrors = Number(depInitErrRows[0]?.n ?? 0);

  const alerts: MetricAlert[] = [];

  if (initErrors >= depInitErrThreshold) {
    alerts.push({
      key: "deposit_init_errors",
      severity: "critical",
      title: `Deposits being rejected at STK push (${initErrors} in ${windowMin}m)`,
      detail: `${initErrors} deposit prompts failed to even reach the customer's phone in the last ${windowMin} minutes — the payment provider is rejecting our STK requests. This is a provider/integration outage, not customers abandoning prompts.`,
      link: "/admin/money",
    });
  }

  if (terminal >= depMinSample && successRate < depMinSuccessRate) {
    alerts.push({
      key: "deposit_success_rate",
      severity: "critical",
      title: `Deposit success rate collapsed to ${(successRate * 100).toFixed(0)}%`,
      detail: `Only ${completed} of ${terminal} completed deposits in the last ${windowMin} minutes (${(successRate * 100).toFixed(0)}% success, threshold ${(depMinSuccessRate * 100).toFixed(0)}%). Normal abandonment runs higher than this — investigate the provider.`,
      link: "/admin/money",
    });
  }

  if (wdStuck >= wdStuckThreshold) {
    alerts.push({
      key: "withdrawals_stuck",
      severity: "warn",
      title: `${wdStuck} payout(s) unconfirmed > ${wdStuckMinutes}m`,
      detail: `${wdStuck} M-Pesa withdrawal(s) have been sent to Lipa but have no completion callback after ${wdStuckMinutes} minutes. They will auto-refund at the safety window, but a growing count signals a payout outage.`,
      link: "/admin/withdrawals",
    });
  }

  if (wdApproval >= approvalThreshold) {
    alerts.push({
      key: "withdrawals_approval",
      severity: "warn",
      title: `${wdApproval} withdrawal(s) awaiting approval > ${approvalAgeMinutes}m`,
      detail: `${wdApproval} customer withdrawal(s) have been waiting for owner approval longer than ${approvalAgeMinutes} minutes.`,
      link: "/admin/withdrawals",
    });
  }

  if (settlementBacklog >= settlementThreshold) {
    alerts.push({
      key: "settlement_backlog",
      severity: "warn",
      title: `${settlementBacklog} sports bets unsettled > 24h`,
      detail: `${settlementBacklog} sports bets are stuck PENDING past 24 hours — the settlement pipeline is falling behind (known getFixtureDetail stateId-5 issue).`,
      link: "/admin/markets/sports",
    });
  }

  return alerts;
}

/**
 * Evaluate the metrics and, for any breach not already alerted within the
 * cooldown, raise an admin notification and (once per run) email the owner.
 * Returns a summary for the cron response.
 */
export async function runBusinessMetricAlerts() {
  const cooldownMin = num(process.env.METRIC_ALERT_COOLDOWN_MINUTES, 60);
  const cooldownSince = new Date(Date.now() - cooldownMin * 60_000);

  const alerts = await evaluateBusinessMetrics();
  if (alerts.length === 0) return { firing: 0, notified: 0, alerts: [] as string[] };

  const admins = await db.user.findMany({ where: { isAdmin: true }, select: { id: true } });

  const fresh: MetricAlert[] = [];
  for (const a of alerts) {
    const type = `admin_metric:${a.key}`;
    const recent = await db.notification.findFirst({
      where: { type, isRead: false, createdAt: { gte: cooldownSince } },
      select: { id: true },
    });
    if (recent) continue; // still in cooldown — don't re-notify
    fresh.push(a);
    if (admins.length) {
      await db.notification.createMany({
        data: admins.map((adm) => ({
          userId: adm.id,
          type,
          title: a.title,
          body: a.detail,
          link: a.link,
        })),
      });
    }
  }

  if (fresh.length) {
    // Best-effort owner email — never let a mail failure break the cron.
    try { await sendBusinessMetricAlertEmail(fresh); }
    catch (e) { console.error("[health-alerts] owner email failed", e); }
  }

  return { firing: alerts.length, notified: fresh.length, alerts: fresh.map((a) => a.key) };
}
