import { db } from "@/lib/db";
import { TransactionStatus, TransactionType } from "@prisma/client";

// Relworx fires this for both:
//   - request-payment (deposit) completions  → credit user balance
//   - send-payment    (withdrawal) results    → confirm or refund
//
// Register this URL in Relworx dashboard under both:
//   "Request Payment Webhook" and "Send Payment Webhook":
//   https://www.nezeem.com/api/webhooks/relworx?secret=<RELWORX_WEBHOOK_SECRET>

export async function POST(req: Request) {
  const url    = new URL(req.url);
  const secret = url.searchParams.get("secret");

  const expected = process.env.RELWORX_WEBHOOK_SECRET;
  if (!expected || secret !== expected) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return Response.json({ error: "Invalid body" }, { status: 400 }); }

  // Relworx payload: { reference, status, amount, msisdn, ... }
  const reference = body.reference as string | undefined;
  const status    = (body.status as string | undefined)?.toLowerCase();

  if (!reference) return Response.json({ error: "Missing reference" }, { status: 400 });

  const txn = await db.transaction.findFirst({
    where: { OR: [{ id: reference }, { reference }] },
    select: { id: true, userId: true, amount: true, status: true, type: true },
  });

  if (!txn) return Response.json({ ok: true, note: "unknown reference" });

  // Idempotency guard
  if (txn.status !== TransactionStatus.PENDING) {
    return Response.json({ ok: true, note: "already settled" });
  }

  // ── DEPOSIT (request-payment) ──────────────────────────────────────────────
  if (txn.type === TransactionType.DEPOSIT) {
    if (status === "successful") {
      await db.$transaction([
        db.transaction.update({
          where: { id: txn.id },
          data:  { status: TransactionStatus.COMPLETED, metadata: { relworxRef: reference } },
        }),
        db.user.update({
          where: { id: txn.userId },
          data:  { walletBalance: { increment: txn.amount } },
        }),
      ]);
    } else if (status === "failed") {
      await db.transaction.update({
        where: { id: txn.id },
        data:  { status: TransactionStatus.FAILED },
      });
    }
    return Response.json({ ok: true });
  }

  // ── WITHDRAWAL (send-payment) ──────────────────────────────────────────────
  if (txn.type === TransactionType.WITHDRAWAL) {
    if (status === "successful") {
      await db.transaction.update({
        where: { id: txn.id },
        data:  { status: TransactionStatus.COMPLETED },
      });
    } else if (status === "failed") {
      await db.$transaction([
        db.transaction.update({ where: { id: txn.id }, data: { status: TransactionStatus.FAILED } }),
        db.user.update({ where: { id: txn.userId }, data: { walletBalance: { increment: txn.amount } } }),
      ]);
    }
    return Response.json({ ok: true });
  }

  return Response.json({ ok: true, note: "unhandled type" });
}
