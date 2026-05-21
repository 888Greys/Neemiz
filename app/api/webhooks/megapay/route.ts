// MegaPay push callback — called by MegaPay when payment completes
// Reads MEGAPAY_BASE_URL or MEGAPAY_API_URL (either name works)
// Set MEGAPAY_CALLBACK_URL=https://www.nezeem.com/api/webhooks/megapay in Vercel env
import { db } from "@/lib/db";
import { TransactionStatus } from "@prisma/client";

export async function POST(req: Request) {
  const callbackToken = process.env.MEGAPAY_CALLBACK_TOKEN ?? "";
  if (!callbackToken) {
    console.error("MegaPay webhook rejected: MEGAPAY_CALLBACK_TOKEN is not configured");
    return new Response("Webhook not configured", { status: 503 });
  }

  let body: Record<string, string>;
  try {
    body = await req.json();
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  const suppliedToken =
    body.callback_token ??
    req.headers.get("x-callback-token") ??
    req.headers.get("x-megapay-token") ??
    "";
  if (suppliedToken !== callbackToken) {
    return new Response("Unauthorized", { status: 401 });
  }

  const transactionRequestId = String(body.transaction_request_id ?? body.TransactionRequestID ?? "");
  const txStatus = String(body.TransactionStatus ?? body.status ?? "").toLowerCase();
  const confirmed = txStatus === "completed" || txStatus === "success" || txStatus === "paid";

  if (!transactionRequestId || !confirmed) {
    return new Response("OK", { status: 200 }); // Not a successful payment, ignore
  }

  const existing = await db.transaction.findUnique({
    where: { reference: transactionRequestId },
  });

  if (!existing || existing.status !== TransactionStatus.PENDING) {
    return new Response("OK", { status: 200 }); // Already processed or not found
  }

  await db.$transaction(async (tx) => {
    const claimed = await tx.transaction.updateMany({
      where: { reference: transactionRequestId, status: TransactionStatus.PENDING },
      data: {
        status: TransactionStatus.COMPLETED,
        metadata: {
          ...(existing.metadata as object),
          transactionId: body.TransactionID ?? "",
          receipt: body.TransactionReceipt ?? "",
          mpesaRef: body.TransactionReference ?? "",
          source: "webhook",
        },
      },
    });
    if (claimed.count === 0) return;

    await tx.user.update({
      where: { id: existing.userId },
      data: { walletBalance: { increment: Number(existing.amount) } },
    });
  });

  return new Response("OK", { status: 200 });
}
