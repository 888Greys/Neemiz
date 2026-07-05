import { db } from "@/lib/db";
import { settlePesapalTransaction } from "@/lib/pesapal";
import { TransactionStatus } from "@prisma/client";

// Settle a Pesapal notification (POST webhook or GET poll). Credits the wallet
// idempotently via the shared settle helper — safe to call multiple times.
async function handleNotification(trackingId: string | null | undefined, txnId: string | null | undefined) {
  if (!trackingId || !txnId) return;

  const txn = await db.transaction.findUnique({
    where:  { id: txnId },
    select: { provider: true, status: true },
  }).catch(() => null);
  if (!txn || txn.provider !== "pesapal") return;                    // not ours — ignore
  if (txn.status === TransactionStatus.COMPLETED || txn.status === TransactionStatus.FAILED) return; // already settled

  await settlePesapalTransaction(txnId, trackingId);
}

// Pesapal IPN — called by Pesapal when a payment status changes
export async function POST(req: Request) {
  try {
    let body: { OrderTrackingId?: string; OrderMerchantReference?: string; OrderNotificationType?: string };
    try { body = await req.json(); } catch { return Response.json({ error: "Invalid body" }, { status: 400 }); }
    await handleNotification(body.OrderTrackingId, body.OrderMerchantReference);
    return Response.json({ ok: true });
  } catch (err) {
    console.error("Pesapal IPN error:", err);
    // Always return 200 to Pesapal so it doesn't keep retrying
    return Response.json({ ok: true });
  }
}

// Pesapal also sends GET for status polling
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    await handleNotification(searchParams.get("OrderTrackingId"), searchParams.get("OrderMerchantReference"));
  } catch { /* best-effort */ }
  return Response.json({ ok: true });
}
