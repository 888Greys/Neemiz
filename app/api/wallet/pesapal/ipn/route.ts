import { db } from "@/lib/db";
import { getTransactionStatus } from "@/lib/pesapal";
import { TransactionStatus } from "@prisma/client";

// Pesapal IPN — called by Pesapal when a payment status changes
export async function POST(req: Request) {
  try {
    let body: { OrderTrackingId?: string; OrderMerchantReference?: string; OrderNotificationType?: string };
    try { body = await req.json(); } catch { return Response.json({ error: "Invalid body" }, { status: 400 }); }

    const { OrderTrackingId: trackingId, OrderMerchantReference: txnId } = body;
    if (!trackingId || !txnId) return Response.json({ error: "Missing fields" }, { status: 400 });

    const txn = await db.transaction.findUnique({ where: { id: txnId } });
    if (!txn || txn.provider !== "pesapal") return Response.json({ ok: true }); // not ours — ack anyway

    if (txn.status === TransactionStatus.COMPLETED || txn.status === TransactionStatus.FAILED) {
      return Response.json({ ok: true }); // already settled
    }

    const status = await getTransactionStatus(trackingId);

    if (status.status === "COMPLETED") {
      await db.$transaction([
        db.transaction.update({
          where: { id: txnId },
          data: {
            status:   TransactionStatus.COMPLETED,
            reference: trackingId,
            metadata: {
              orderTrackingId:  trackingId,
              confirmationCode: status.confirmationCode,
              paymentMethod:    status.paymentMethod,
              settledAt:        new Date().toISOString(),
            },
          },
        }),
        db.user.update({
          where: { id: txn.userId },
          data: { walletBalance: { increment: txn.amount } },
        }),
      ]);
    } else if (status.status === "FAILED" || status.status === "INVALID" || status.status === "REVERSED") {
      await db.transaction.update({
        where: { id: txnId },
        data: { status: TransactionStatus.FAILED, reference: trackingId },
      });
    }

    return Response.json({ ok: true });
  } catch (err) {
    console.error("Pesapal IPN error:", err);
    // Always return 200 to Pesapal so it doesn't keep retrying
    return Response.json({ ok: true });
  }
}

// Pesapal also sends GET for status polling
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const trackingId = searchParams.get("OrderTrackingId");
  const txnId      = searchParams.get("OrderMerchantReference");

  if (!trackingId || !txnId) return Response.json({ ok: true });

  const txn = await db.transaction.findUnique({ where: { id: txnId } }).catch(() => null);
  if (!txn || txn.provider !== "pesapal") return Response.json({ ok: true });

  if (txn.status !== TransactionStatus.COMPLETED && txn.status !== TransactionStatus.FAILED) {
    try {
      const status = await getTransactionStatus(trackingId);
      if (status.status === "COMPLETED") {
        await db.$transaction([
          db.transaction.update({
            where: { id: txnId },
            data: { status: TransactionStatus.COMPLETED, reference: trackingId },
          }),
          db.user.update({ where: { id: txn.userId }, data: { walletBalance: { increment: txn.amount } } }),
        ]);
      } else if (["FAILED", "INVALID", "REVERSED"].includes(status.status)) {
        await db.transaction.update({ where: { id: txnId }, data: { status: TransactionStatus.FAILED } });
      }
    } catch { /* best-effort */ }
  }

  return Response.json({ ok: true });
}
