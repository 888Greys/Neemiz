/**
 * Watches the `security_user_audit` trail for `is_admin` changes and pages the
 * owner — in-app notification + email — the moment an admin flag flips, deduped
 * per audit row. A flip to TRUE on a NON-allowlisted email is the
 * josemuthama-class signature (someone with DB/service-role access self-granting
 * admin); requireOwnerAdmin already neuters it, but the owner should still know.
 *
 * Run from cron with `Authorization: Bearer $CRON_SECRET`, every ~5 min.
 */
import { db } from "@/lib/db";
import { isOwnerEmail } from "@/lib/admin-allowlist";
import { sendAdminChangeAlertEmail } from "@/lib/brevo";

export type AdminAuditRow = {
  id: string;
  email: string | null;
  username: string | null;
  old_admin: string | null;   // 'true' | 'false' | null
  new_admin: string | null;
  app: string | null;
  ip: string | null;
  created_at: Date;
};

export type AdminChange = {
  auditId: string;
  email: string;
  username: string | null;
  from: string;
  to: string;
  app: string | null;
  ip: string | null;
  at: string;
  allowlisted: boolean;
  critical: boolean;          // granted admin to a non-allowlisted email
};

/** Pure: turn an audit row into a classified change (critical = grant to a
 *  non-allowlisted email). Exported for testing. */
export function classifyAdminChange(row: AdminAuditRow): AdminChange {
  const to = String(row.new_admin);
  const allowlisted = isOwnerEmail(row.email);
  return {
    auditId: row.id,
    email: row.email ?? "(unknown)",
    username: row.username,
    from: String(row.old_admin),
    to,
    app: row.app,
    ip: row.ip,
    at: row.created_at.toISOString().replace("T", " ").slice(0, 19),
    allowlisted,
    critical: to === "true" && !allowlisted,
  };
}

export async function runAdminChangeAlerts() {
  const lookbackMin = Number(process.env.ADMIN_ALERT_LOOKBACK_MINUTES ?? 15);
  const since = new Date(Date.now() - lookbackMin * 60_000);

  const rows = await db.$queryRaw<AdminAuditRow[]>`
    SELECT id,
           email,
           username,
           old_values->>'is_admin' AS old_admin,
           new_values->>'is_admin' AS new_admin,
           application_name        AS app,
           host(client_addr)       AS ip,
           created_at
    FROM public.security_user_audit
    WHERE 'is_admin' = ANY(changed_fields)
      AND created_at > ${since}
      AND old_values->>'is_admin' IS DISTINCT FROM new_values->>'is_admin'
    ORDER BY created_at DESC
    LIMIT 100
  `;
  if (rows.length === 0) return { found: 0, notified: 0, critical: 0 };

  const admins = await db.user.findMany({ where: { isAdmin: true }, select: { id: true } });

  const fresh: AdminChange[] = [];
  for (const row of rows) {
    const type = `admin_flag_change:${row.id}`;
    // Dedupe: one alert per audit row, ever.
    const already = await db.notification.findFirst({ where: { type }, select: { id: true } });
    if (already) continue;

    const change = classifyAdminChange(row);
    fresh.push(change);

    if (admins.length) {
      await db.notification.createMany({
        data: admins.map((adm) => ({
          userId: adm.id,
          type,
          title: change.critical ? "🚨 Admin flag granted to a non-allowlisted account" : "Admin flag changed",
          body: `${change.email}: is_admin ${change.from} → ${change.to}${change.critical ? " — NOT on the owner allowlist" : ""} (via ${change.app ?? "?"} / ${change.ip ?? "?"}).`,
          link: "/admin/users",
        })),
      });
    }
  }

  if (fresh.length) {
    try { await sendAdminChangeAlertEmail(fresh.map(({ email, username, from, to, app, ip, at, allowlisted }) => ({ email, username, from, to, app, ip, at, allowlisted }))); }
    catch (e) { console.error("[admin-change-alerts] owner email failed", e); }
  }

  return { found: rows.length, notified: fresh.length, critical: fresh.filter((c) => c.critical).length };
}
