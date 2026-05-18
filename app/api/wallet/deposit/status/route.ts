import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { TransactionStatus } from "@prisma/client";

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const baseUrl = (process.env.MEGAPAY_BASE_URL ?? process.env.MEGAPAY_API_URL ?? "").replace(/\/+$/, "");
  const apiKey  = process.env.MEGAPAY_API_KEY ?? "";
  const email   = process.env.MEGAPAY_EMAIL ?? "";

  if (!baseUrl || !apiKey || !email) {
    return Response.json({ error: "MegaPay not configured" }, { status: 503 });
  }

  let body: { transactionRequestId: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid body" }, { status: 400 });
  }

  const { transactionRequestId } = body;
  if (!transactionRequestId) {
    return Response.json({ error: "Missing transactionRequestId" }, { status: 400 });
  }

  // Check if already credited (idempotency)
  const existing = await db.transaction.findUnique({
    where: { reference: transactionRequestId },
    include: { user: { select: { clerkId: true, walletBalance: true } } },
  });

  if (existing?.status === TransactionStatus.COMPLETED) {
    return Response.json({
      status: "confirmed",
      newBalance: Number(existing.user.walletBalance),
      message: "Deposit already credited.",
    });
  }

  // Ask MegaPay for status
  const mpRes = await fetch(`${baseUrl}/backend/v1/transactionstatus`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ api_key: apiKey, email, transaction_request_id: transactionRequestId }),
  });

  const mpData = await mpRes.json().catch(() => ({})) as Record<string, string>;
  const txStatus = String(mpData.TransactionStatus ?? mpData.status ?? "").toLowerCase();
  const confirmed = txStatus === "completed" || txStatus === "success" || txStatus === "paid";

  if (!confirmed) {
    return Response.json({
      status: "pending",
      message: mpData.ResultDesc ?? "Transaction still pending.",
    });
  }

  // Credit the wallet in a transaction
  if (!existing) {
    return Response.json({ status: "pending", message: "Transaction record not found." });
  }

  const updated = await db.$transaction(async (tx) => {
    await tx.transaction.update({
      where: { reference: transactionRequestId },
      data: {
        status: TransactionStatus.COMPLETED,
        metadata: {
          ...(existing.metadata as object),
          transactionId: mpData.TransactionID ?? "",
          receipt: mpData.TransactionReceipt ?? "",
          mpesaRef: mpData.TransactionReference ?? "",
        },
      },
    });

    return tx.user.update({
      where: { id: existing.userId },
      data: { walletBalance: { increment: Number(existing.amount) } },
      select: { walletBalance: true },
    });
  });

  return Response.json({
    status: "confirmed",
    newBalance: Number(updated.walletBalance),
    message: `KSh ${Number(existing.amount).toFixed(2)} added to your wallet!`,
    receipt: mpData.TransactionReceipt ?? "",
  });
}
