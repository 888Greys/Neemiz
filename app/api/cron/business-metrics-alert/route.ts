/**
 * Periodic business-metric health check. Evaluates the money-movement spine
 * (deposit success, payout confirmation, settlement backlog) and pages the owner
 * — in-app notification + email — when a threshold breaks, deduped per metric.
 *
 * Run from cron with `Authorization: Bearer $CRON_SECRET`. Suggested cadence:
 * every 5 minutes (the alerts are deduped by a cooldown, so this is safe).
 */
import { runBusinessMetricAlerts } from "@/lib/admin/health-alerts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ error: "CRON_SECRET is not configured" }, { status: 503 });
  if (auth !== `Bearer ${secret}`) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const result = await runBusinessMetricAlerts();
    if (result.notified) {
      console.log(`[business-metrics-alert] raised ${result.notified} new alert(s): ${result.alerts.join(", ")}`);
    }
    return Response.json({ ok: true, ...result });
  } catch (e) {
    console.error("[business-metrics-alert] failed", e);
    return Response.json({ ok: false, error: e instanceof Error ? e.message : "failed" }, { status: 500 });
  }
}
