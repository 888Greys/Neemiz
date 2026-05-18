// MegaPay push callback — called by MegaPay when payment completes
// Set MEGAPAY_CALLBACK_URL=https://www.nezeem.com/api/webhooks/megapay in Vercel env
import { db } from "@/lib/db";
import { TransactionStatus } from "@prisma/client";

export async function POST(req: Request) {
  let body: Record<string, string>;
  try {
    body = await req.json();
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  const callbackToken = process.env.MEGAPAY_CALLBACK_TOKEN ?? "";
  if (callbackToken && body.callback_token !== callbackToken) {
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

  if (!existing || existing.status === TransactionStatus.COMPLETED) {
    return new Response("OK", { status: 200 }); // Already processed or not found
  }

  await db.$transaction(async (tx) => {
    await tx.transaction.update({
      where: { reference: transactionRequestId },
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

    await tx.user.update({
      where: { id: existing.userId },
      data: { walletBalance: { increment: Number(existing.amount) } },
    });
  });

  return new Response("OK", { status: 200 });
}
