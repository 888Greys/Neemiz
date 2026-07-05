/**
 * Cron endpoint: signup-velocity tripwire.
 *
 * Detection-only early warning for bot account farming (the mule / bonus-abuse
 * pattern behind e.g. the same-second `babybot9054` + `botbaby9054` accounts).
 * Looks over a short rolling window for three signals and alerts owners/admins
 * (in-app + email) if any trips. It NEVER freezes accounts — humans decide.
 *
 * Signals:
 *   1. Burst   — total non-admin signups in the window exceeds a threshold.
 *   2. Cluster — >= N accounts created within the same ~10-second bucket
 *                (no human fills signup forms that fast; = a script).
 *   3. Device  — one device_hash (login_devices) tied to >= N distinct users
 *                first seen in the window (one machine farming accounts).
 *   4. Email   — >= N accounts whose email normalizes to the same inbox, i.e.
 *                the `+alias` / dotted-Gmail trick (conniemutile+1..+5@gmail.com
 *                and c.o.nniemutile@gmail.com all deliver to one mailbox).
 *
 * VPS cron should run this every few minutes. Auth: Bearer CRON_SECRET.
 *
 *   curl -sL -X POST -H "Authorization: Bearer $CRON_SECRET" \
 *     https://www.nezeem.com/api/cron/detect-bot-signups
 *
 * Env (all optional):
 *   BOT_SIGNUP_WINDOW_MIN       — lookback window in minutes (default 30)
 *   BOT_SIGNUP_BURST            — signups/window that counts as a burst (default 15)
 *   BOT_SIGNUP_CLUSTER          — accounts in one 10s bucket to flag (default 4)
 *   BOT_SIGNUP_DEVICE_USERS     — distinct users per device to flag (default 3)
 *   BOT_SIGNUP_EMAIL_ALIAS      — accounts per normalized inbox to flag (default 3)
 */
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { notifyAdminsBotSignups, type BotSignupReport } from "@/lib/admin-alert";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth   = req.headers.get("authorization") ?? "";
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ error: "CRON_SECRET is not configured" }, { status: 503 });
  if (auth !== `Bearer ${secret}`) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const windowMin       = Math.max(1, Number(process.env.BOT_SIGNUP_WINDOW_MIN ?? 30));
  const burstThreshold  = Math.max(1, Number(process.env.BOT_SIGNUP_BURST ?? 15));
  const clusterMin      = Math.max(2, Number(process.env.BOT_SIGNUP_CLUSTER ?? 4));
  const deviceMin       = Math.max(2, Number(process.env.BOT_SIGNUP_DEVICE_USERS ?? 3));
  const emailAliasMin   = Math.max(2, Number(process.env.BOT_SIGNUP_EMAIL_ALIAS ?? 3));
  const windowSql = Prisma.sql`(now() - (${windowMin}::int * interval '1 minute'))`;

  // 1. Burst — total non-admin signups in the window.
  const burstRow = await db.$queryRaw<Array<{ n: bigint }>>(Prisma.sql`
    SELECT count(*)::bigint AS n FROM users
    WHERE created_at > ${windowSql} AND is_admin = false
  `);
  const totalSignups = Number(burstRow[0]?.n ?? 0);

  // 2. Cluster — accounts created within the same 10-second bucket.
  const clusterRows = await db.$queryRaw<Array<{ at: Date; n: bigint }>>(Prisma.sql`
    SELECT to_timestamp(floor(extract(epoch FROM created_at) / 10) * 10) AS at, count(*)::bigint AS n
    FROM users
    WHERE created_at > ${windowSql} AND is_admin = false
    GROUP BY 1 HAVING count(*) >= ${clusterMin}
    ORDER BY n DESC LIMIT 25
  `);
  const clusters = clusterRows.map((r) => ({ at: new Date(r.at).toISOString(), count: Number(r.n) }));

  // 3. Device — one device_hash tied to many distinct users first seen in window.
  const deviceRows = await db.$queryRaw<Array<{ device_hash: string; users: bigint }>>(Prisma.sql`
    SELECT device_hash, count(DISTINCT user_id)::bigint AS users
    FROM login_devices
    WHERE first_seen_at > ${windowSql}
    GROUP BY device_hash HAVING count(DISTINCT user_id) >= ${deviceMin}
    ORDER BY users DESC LIMIT 25
  `);
  const devices = deviceRows.map((r) => ({ deviceHash: r.device_hash, users: Number(r.users) }));

  // 4. Email — accounts whose address normalizes to the same inbox. For gmail/
  //    googlemail, strip the "+tag" and remove dots from the local part; for
  //    other providers just strip the "+tag" (dots are provider-specific).
  const emailRows = await db.$queryRaw<Array<{ canon: string; n: bigint }>>(Prisma.sql`
    WITH norm AS (
      SELECT CASE
        WHEN lower(split_part(email, '@', 2)) IN ('gmail.com', 'googlemail.com')
          THEN replace(regexp_replace(lower(split_part(email, '@', 1)), '\\+.*$', ''), '.', '') || '@gmail.com'
        ELSE regexp_replace(lower(email), '\\+[^@]*@', '@')
      END AS canon
      FROM users
      WHERE created_at > ${windowSql} AND is_admin = false AND email IS NOT NULL
    )
    SELECT canon, count(*)::bigint AS n
    FROM norm GROUP BY canon HAVING count(*) >= ${emailAliasMin}
    ORDER BY n DESC LIMIT 25
  `);
  const emailClusters = emailRows.map((r) => ({ email: r.canon, count: Number(r.n) }));

  const burst = totalSignups >= burstThreshold;
  const tripped = burst || clusters.length > 0 || devices.length > 0 || emailClusters.length > 0;

  const report: BotSignupReport = { windowMinutes: windowMin, totalSignups, burst, burstThreshold, clusters, devices, emailClusters };

  if (tripped) {
    await notifyAdminsBotSignups(report).catch((e) => console.error("[bot-signup] alert failed", e));
  }

  return Response.json({ ok: true, tripped, ...report });
}

// Allow POST too, so the same VPS curl pattern works either way.
export async function POST(req: Request) {
  return GET(req);
}
