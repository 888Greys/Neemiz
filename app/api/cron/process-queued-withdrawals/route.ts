/**
 * Cron endpoint: drain any M-Pesa withdrawals still flagged `queued` from the
 * old hold-and-auto-retry flow.
 *
 * Auto-crediting queued withdrawals when the float was later topped up has been
 * REMOVED: insufficient float now refunds the customer immediately at request
 * time (see app/api/wallet/withdraw/route.ts) and surfaces a maintenance
 * message. This cron only exists to clean up rows that were queued before that
 * change — each is refunded to the customer's wallet and marked FAILED. It never
 * re-submits a payout, so it can never auto-credit.
 *
 * VPS cron hits this periodically with `Authorization: Bearer CRON_SECRET`.
 */
import { db } from "@/lib/db";
import { TransactionStatus, TransactionType } from "@prisma/client";
import { CURRENCY_SYMBOL } from "@/lib/currency";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const auth   = req.headers.get("authorization") ?? "";
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ error: "CRON_SECRET is not configured" }, { status: 503 });
  if (auth !== `Bearer ${secret}`) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const queued = await db.transaction.findMany({
    where: {
      provider: "lipaharaka",
      type:     TransactionType.WITHDRAWAL,
      status:   TransactionStatus.PENDING,
      metadata: { path: ["queued"], equals: true },
    },
    orderBy: { createdAt: "asc" },
    take: 50,
  });

  let refunded = 0;

  for (const w of queued) {
    const meta = (w.metadata as Record<string, unknown>) ?? {};

    // Refund and notify — never re-submit.
    await db.$transaction(async (tx) => {
      const claimed = await tx.transaction.updateMany({
        where: { id: w.id, status: TransactionStatus.PENDING },
        data:  { status: TransactionStatus.FAILED, metadata: { ...meta, queued: false, refundedReason: "queue_drained", refundedAt: new Date().toISOString() } },
      });
      if (claimed.count) {
        await tx.user.update({ where: { id: w.userId }, data: { walletBalance: { increment: w.amount } } });
        await tx.notification.create({
          data: {
            userId: w.userId,
            type:   "withdrawal_refunded",
            title:  "Withdrawal refunded",
            body:   `We couldn't complete your ${CURRENCY_SYMBOL} ${Number(w.amount).toLocaleString()} M-Pesa withdrawal, so it's been returned to your wallet. Please try again later.`,
            link:   "/wallet",
          },
        }).catch(() => {});
        refunded += 1;
      }
    });
  }

  return Response.json({ ok: true, scanned: queued.length, refunded });
}
