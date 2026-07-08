/**
 * Forfeit expired bonus wagering cycles for users who stopped playing.
 *
 * Active players get expired/completed cycles settled inline (spendForPlay /
 * creditWinnings call settleBonusCycleIfDue on every touch) — this sweep only
 * catches users whose cycle expired while they were idle, so the dormant bonus
 * liability actually comes off the books.
 *
 * Run from cron with `Authorization: Bearer $CRON_SECRET`. Suggested cadence:
 * hourly.
 */

import { db } from "@/lib/db";
import { settleBonusCycleIfDue } from "@/lib/balance";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const auth   = req.headers.get("authorization") ?? "";
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ error: "CRON_SECRET is not configured" }, { status: 503 });
  if (auth !== `Bearer ${secret}`) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const due = await db.user.findMany({
    where: { bonusExpiresAt: { lte: new Date() } },
    select: { id: true },
    take: 500,
  });

  let settled = 0;
  for (const { id } of due) {
    try {
      await db.$transaction(async (tx) => settleBonusCycleIfDue(tx, id));
      settled++;
    } catch (err) {
      console.error(`expire-bonuses: failed for user ${id}:`, err);
    }
  }

  return Response.json({ ok: true, checked: due.length, settled });
}

export async function GET(req: Request) {
  return POST(req);
}
