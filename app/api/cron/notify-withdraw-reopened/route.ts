/**
 * One-shot cron endpoint: email everyone who opted in to be notified when
 * M-Pesa withdrawals reopen, then clear the opt-in list.
 *
 * Run this once right after flipping MPESA_WITHDRAWALS_ENABLED back to true
 * (see /opt/neemiz/notify-withdraw-reopened.sh). Safe to re-run: each send is
 * removed from the list, so a second run only targets people who subscribed
 * in between. Hit with `Authorization: Bearer CRON_SECRET`.
 */
import { db } from "@/lib/db";
import { sendWithdrawReopenedEmail } from "@/lib/brevo";

export const runtime = "nodejs";

const NOTIFY_TYPE = "withdraw_reopen";

async function run(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ error: "CRON_SECRET is not configured" }, { status: 503 });
  if (auth !== `Bearer ${secret}`) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const subs = await db.notification.findMany({
    where: { type: NOTIFY_TYPE },
    include: { user: { select: { email: true, firstName: true } } },
  });

  const sentIds: string[] = [];
  let failed = 0;
  for (const sub of subs) {
    const email = sub.user?.email;
    if (!email) { sentIds.push(sub.id); continue; } // no address — drop from list
    try {
      await sendWithdrawReopenedEmail(email, sub.user?.firstName ?? "");
      sentIds.push(sub.id);
    } catch {
      failed += 1; // keep on the list so a re-run retries
    }
  }

  if (sentIds.length) await db.notification.deleteMany({ where: { id: { in: sentIds } } });

  return Response.json({ subscribers: subs.length, sent: sentIds.length, failed });
}

export const GET = run;
export const POST = run;
