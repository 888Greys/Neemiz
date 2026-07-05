/**
 * Cron endpoint: daily ledger reconciliation tripwire.
 *
 * Recomputes each user's expected KES balance from the transactions ledger and
 * flags ACTIVE, non-admin accounts whose wallet_balance exceeds it by more than
 * a threshold. Balance with no ledger trail is the signature of a direct write
 * to wallet_balance — i.e. the DB-compromise vector from 2026-06-26. If anything
 * is flagged, all owners/admins are alerted (in-app + email).
 *
 * VPS cron should run this once a day. Auth: Bearer CRON_SECRET.
 *
 *   curl -sL -X POST -H "Authorization: Bearer $CRON_SECRET" \
 *     https://www.nezeem.com/api/cron/reconcile-balances
 *
 * Env:
 *   RECON_ALERT_THRESHOLD   — min unexplained KES to flag (default 100)
 *   RECON_EXCLUDE_USERNAMES — extra comma-separated usernames to ignore
 */
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { notifyAdminsReconMismatch } from "@/lib/admin-alert";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Owner/test accounts intentionally credited outside the normal deposit flow.
const DEFAULT_EXCLUDES = ["silas_binary", "newtonmulti", "collinskipkiru", "oira", "pom", "goodhope229"];

export async function GET(req: Request) {
  const auth   = req.headers.get("authorization") ?? "";
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ error: "CRON_SECRET is not configured" }, { status: 503 });
  if (auth !== `Bearer ${secret}`) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const threshold = Math.max(1, Number(process.env.RECON_ALERT_THRESHOLD ?? 100));
  const extra = (process.env.RECON_EXCLUDE_USERNAMES ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const excludes = [...new Set([...DEFAULT_EXCLUDES, ...extra])];

  const rows = await db.$queryRaw<Array<{ username: string | null; balance: number; unexplained: number }>>(Prisma.sql`
    SELECT u.username,
           u.wallet_balance::float8 AS balance,
           (u.wallet_balance - COALESCE(led.expected, 0))::float8 AS unexplained
    FROM users u
    LEFT JOIN (
      SELECT user_id, SUM(CASE
        WHEN currency <> 'KES' THEN 0
        WHEN type IN ('DEPOSIT','BET_WIN','BONUS','REFUND') AND status = 'COMPLETED' THEN amount
        WHEN type = 'WITHDRAWAL' AND status IN ('PENDING','PENDING_APPROVAL','COMPLETED') THEN -amount
        WHEN type = 'BET_STAKE' AND status = 'COMPLETED' THEN -amount
        ELSE 0 END) AS expected
      FROM transactions GROUP BY user_id
    ) led ON led.user_id = u.id
    WHERE u.is_active = true
      AND u.is_admin = false
      AND u.wallet_balance > 0
      AND (u.wallet_balance - COALESCE(led.expected, 0)) > ${threshold}
      AND u.username NOT IN (${Prisma.join(excludes)})
    ORDER BY unexplained DESC
    LIMIT 50
  `);

  if (rows.length > 0) {
    await notifyAdminsReconMismatch(rows).catch((e) => console.error("[reconcile] alert failed", e));
  }

  const total = rows.reduce((s, r) => s + r.unexplained, 0);
  return Response.json({ ok: true, flagged: rows.length, unexplainedTotal: total, accounts: rows });
}

// Allow POST too, so the same VPS curl pattern works either way.
export async function POST(req: Request) {
  return GET(req);
}
