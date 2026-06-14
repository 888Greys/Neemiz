import { db } from "@/lib/db";
import { TransactionStatus } from "@prisma/client";

/**
 * MegaPay webhook — fired after each STK push completes or fails.
 *
 * MegaPay payload shape:
 * {
 *   ResponseCode:          0,                        // 0 = success, anything else = failure
 *   ResponseDescription:   "Success...",
 *   TransactionID:         "SOFTPID28092024...",     // MegaPay's request ID (matches our tx.reference)
 *   TransactionAmount:     100,
 *   TransactionReceipt:    "SIS88JC7AM",
 *   TransactionDate:       "20240928222012",
 *   TransactionReference:  "our-internal-txn-id",   // the value we sent as `reference`
 *   Msisdn:                "254769290734"
 * }
 *
 * Belt-and-suspenders: the status-polling route also settles transactions
 * from our DB, so even if this webhook is delayed the UI will catch up.
 */
export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  // Fail closed: an unsigned callback must never be able to credit a wallet.
  const callbackToken = process.env.MEGAPAY_CALLBACK_TOKEN ?? "";
  if (!callbackToken) {
    console.error("MegaPay callback rejected: MEGAPAY_CALLBACK_TOKEN is not configured");
    return new Response("Webhook not configured", { status: 503 });
  }
  const supplied =
    String(body.callback_token ?? body.CallbackToken ?? "") ||
    req.headers.get("x-callback-token") ||
    req.headers.get("x-megapay-token") ||
    "";
  if (supplied !== callbackToken) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Locate our internal transaction —
  // TransactionReference = the `reference` value we passed to MegaPay = our tx.id
  // Fallback: look up by the provider request ID stored in tx.reference
  const internalId  = String(body.TransactionReference ?? body.transaction_reference ?? "");
  const providerId  = String(body.TransactionID ?? body.transaction_request_id ?? body.TransactionRequestID ?? "");

  if (!internalId && !providerId) {
    console.error("MegaPay callback: missing TransactionReference / TransactionID", body);
    return new Response("Missing identifiers", { status: 400 });
  }

  const tx = await db.transaction.findFirst({
    where: internalId
      ? { id: internalId }
      : { reference: providerId },
    include: { user: { select: { id: true } } },
  });

  if (!tx) {
    // Not ours — ack so MegaPay doesn't retry indefinitely
    return new Response("OK", { status: 200 });
  }
  if (tx.status !== TransactionStatus.PENDING) {
    return new Response("OK", { status: 200 }); // already settled (idempotent)
  }

  // Determine outcome
  // ResponseCode 0 = success; also accept string "0"
  const responseCode = Number(body.ResponseCode ?? body.response_code ?? -1);
  // Some implementations also echo TransactionStatus: "Completed"
  const statusStr    = String(body.TransactionStatus ?? body.status ?? "").toLowerCase();
  const isSuccess    =
    responseCode === 0 ||
    statusStr === "completed" ||
    statusStr === "success" ||
    statusStr === "paid";

  const meta = {
    megapayCallback:     true,
    TransactionID:       providerId,
    TransactionReceipt:  String(body.TransactionReceipt ?? ""),
    TransactionDate:     String(body.TransactionDate    ?? ""),
    Msisdn:              String(body.Msisdn              ?? ""),
    ResponseCode:        responseCode,
    settledAt:           new Date().toISOString(),
  };

  if (isSuccess) {
    await db.$transaction(async (prismaTx) => {
      const claimed = await prismaTx.transaction.updateMany({
        where: { id: tx.id, status: TransactionStatus.PENDING },
        data:  { status: TransactionStatus.COMPLETED, metadata: meta },
      });
      if (claimed.count === 0) return; // race-condition guard

      await prismaTx.user.update({
        where: { id: tx.userId },
        data:  { walletBalance: { increment: Number(tx.amount) } },
      });
    });
  } else {
    await db.transaction.updateMany({
      where: { id: tx.id, status: TransactionStatus.PENDING },
      data:  { status: TransactionStatus.FAILED, metadata: meta },
    });
  }

  return new Response("OK", { status: 200 });
}
