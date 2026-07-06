/**
 * Periodic security check: pages the owner when an `is_admin` flag changes on
 * the users table (see lib/admin/admin-change-alerts). Deduped per audit row.
 *
 * Run from cron with `Authorization: Bearer $CRON_SECRET`. Suggested cadence:
 * every 5 minutes (ADMIN_ALERT_LOOKBACK_MINUTES defaults to 15, so a missed
 * run still catches recent changes).
 */
import { runAdminChangeAlerts } from "@/lib/admin/admin-change-alerts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ error: "CRON_SECRET is not configured" }, { status: 503 });
  if (auth !== `Bearer ${secret}`) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const result = await runAdminChangeAlerts();
    if (result.notified) {
      console.log(`[admin-change-alert] ${result.notified} new alert(s), ${result.critical} critical`);
    }
    return Response.json({ ok: true, ...result });
  } catch (e) {
    console.error("[admin-change-alert] failed", e);
    return Response.json({ ok: false, error: e instanceof Error ? e.message : "failed" }, { status: 500 });
  }
}
