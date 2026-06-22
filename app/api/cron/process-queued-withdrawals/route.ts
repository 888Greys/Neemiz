/**
 * Cron endpoint: auto-process M-Pesa withdrawals that were QUEUED because the
 * payout float was insufficient at request time.
 *
 * For each queued withdrawal:
 *   - If it has waited longer than the max window, refund it and tell the user.
 *   - Otherwise re-submit to Lipa Haraka. If the float is now funded the submit
 *     is accepted → clear the queued flag and let the callback webhook finalize
 *     it (it becomes a normal PENDING withdrawal). If still short, leave queued
 *     for the next run.
 *
 * Safe against double-pay: once a re-submit is accepted we immediately clear
 * `queued`, so the same withdrawal is never submitted twice. The reconcile cron
 * (which refunds stale PENDING rows) skips anything still flagged `queued`.
 *
 * VPS cron hits this periodically with `Authorization: Bearer CRON_SECRET`.
 */
import { db } from "@/lib/db";
import { TransactionStatus, TransactionType } from "@prisma/client";
import { initiateLipaHarakaWithdrawal } from "@/lib/lipaharaka";
import { CURRENCY_SYMBOL } from "@/lib/currency";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const auth   = req.headers.get("authorization") ?? "";
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ error: "CRON_SECRET is not configured" }, { status: 503 });
  if (auth !== `Bearer ${secret}`) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const maxHours = Math.max(1, Number(process.env.QUEUED_WITHDRAWAL_MAX_HOURS ?? "48"));
  const cutoff   = new Date(Date.now() - maxHours * 3_600_000);

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

  let sent = 0, refunded = 0, stillQueued = 0;

  for (const w of queued) {
    const meta    = (w.metadata as Record<string, unknown>) ?? {};
    const msisdn  = String(meta.msisdn ?? "");
    const payout  = Number(meta.payout ?? w.amount);

    // ── Aged out: refund and notify the customer ──────────────────────────────
    if (w.createdAt < cutoff) {
      await db.$transaction(async (tx) => {
        const claimed = await tx.transaction.updateMany({
          where: { id: w.id, status: TransactionStatus.PENDING },
          data:  { status: TransactionStatus.FAILED, metadata: { ...meta, queued: false, refundedReason: "queue_timeout", refundedAt: new Date().toISOString() } },
        });
        if (claimed.count) {
          await tx.user.update({ where: { id: w.userId }, data: { walletBalance: { increment: w.amount } } });
          await tx.notification.create({
            data: {
              userId: w.userId,
              type:   "withdrawal_refunded",
              title:  "Withdrawal refunded",
              body:   `We couldn't complete your ${CURRENCY_SYMBOL} ${Number(w.amount).toLocaleString()} M-Pesa withdrawal, so it's been returned to your wallet. Please try again.`,
              link:   "/wallet",
            },
          }).catch(() => {});
          refunded += 1;
        }
      });
      continue;
    }

    // ── Re-attempt the payout ─────────────────────────────────────────────────
    if (!msisdn || !Number.isInteger(payout)) { stillQueued += 1; continue; }
    try {
      const ack = await initiateLipaHarakaWithdrawal(msisdn, payout);
      if (ack.accepted) {
        // Clear the queued flag FIRST so it can never be submitted twice; the
        // webhook now finalizes it like any normal accepted withdrawal.
        await db.transaction.update({
          where: { id: w.id },
          data:  {
            reference: ack.reference ?? undefined,
            metadata:  { ...meta, queued: false, submittedAt: new Date().toISOString(), lipaWithdrawalId: ack.reference },
          },
        });
        await db.notification.create({
          data: {
            userId: w.userId,
            type:   "withdrawal_sent",
            title:  "Withdrawal on its way",
            body:   `Your ${CURRENCY_SYMBOL} ${payout.toLocaleString()} is now being sent to +${msisdn} via M-Pesa.`,
            link:   "/wallet",
          },
        }).catch(() => {});
        sent += 1;
      } else {
        // Still short on float — leave queued for the next run.
        stillQueued += 1;
      }
    } catch {
      // Transport error — leave queued and retry next run.
      stillQueued += 1;
    }
  }

  return Response.json({ ok: true, scanned: queued.length, sent, refunded, stillQueued, maxHours });
}
