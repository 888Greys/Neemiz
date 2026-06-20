/**
 * Cron endpoint: reconcile stuck Lipa Haraka (M-Pesa B2C) withdrawals.
 *
 * Lipa Haraka exposes NO status-query endpoint — final status arrives only via
 * the callback webhook. So if a withdrawal is accepted (kept PENDING) but Lipa
 * never disburses and never calls back, the user's balance would stay debited
 * forever. This cron refunds withdrawals stuck in PENDING beyond a safe window.
 *
 * Safe against double-pay: if Lipa later DOES disburse a withdrawal we refunded,
 * the callback webhook re-debits it (see app/api/webhooks/lipaharaka/route.ts).
 *
 * VPS cron hits this periodically with `Authorization: Bearer CRON_SECRET`.
 */
import { db } from "@/lib/db";
import { TransactionStatus, TransactionType } from "@prisma/client";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const auth   = req.headers.get("authorization") ?? "";
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ error: "CRON_SECRET is not configured" }, { status: 503 });
  if (auth !== `Bearer ${secret}`) return Response.json({ error: "Unauthorized" }, { status: 401 });

  // How long a withdrawal may sit PENDING before we treat it as failed and refund.
  const staleMinutes = Math.max(30, Number(process.env.LIPAHARAKA_RECONCILE_STALE_MINUTES ?? "360"));
  const cutoff = new Date(Date.now() - staleMinutes * 60_000);

  const stale = await db.transaction.findMany({
    where: {
      provider:  "lipaharaka",
      type:      TransactionType.WITHDRAWAL,
      status:    TransactionStatus.PENDING,
      createdAt: { lt: cutoff },
      // Queued-for-low-float withdrawals are managed by process-queued-withdrawals
      // (which has its own, longer timeout) — never refund them here.
      NOT: { metadata: { path: ["queued"], equals: true } },
    },
    orderBy: { createdAt: "asc" },
    take: 100,
  });

  let refunded = 0;
  const details: Array<{ id: string; amount: number }> = [];

  for (const w of stale) {
    await db.$transaction(async (prisma) => {
      // Atomic claim — only the call that flips PENDING→FAILED issues the refund,
      // so a concurrent webhook can't double-process the same withdrawal.
      const claimed = await prisma.transaction.updateMany({
        where: { id: w.id, status: TransactionStatus.PENDING },
        data:  {
          status:   TransactionStatus.FAILED,
          metadata: {
            ...((w.metadata as Record<string, unknown>) ?? {}),
            reconcileRefunded: true,
            reconcileReason:   `stale_pending_${staleMinutes}m`,
            reconciledAt:      new Date().toISOString(),
          },
        },
      });
      if (claimed.count) {
        await prisma.user.update({
          where: { id: w.userId },
          data:  { walletBalance: { increment: w.amount } },
        });
        refunded += 1;
        details.push({ id: w.id, amount: Number(w.amount) });
      }
    });
  }

  if (refunded) {
    console.log(`[reconcile-withdrawals] refunded ${refunded} stale PENDING withdrawal(s) older than ${staleMinutes}m`, details);
  }

  return Response.json({ ok: true, scanned: stale.length, refunded, staleMinutes });
}
