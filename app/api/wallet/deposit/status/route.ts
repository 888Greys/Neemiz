import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { TransactionStatus } from "@prisma/client";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const baseUrl = (
    process.env.MEGAPAY_BASE_URL ??
    process.env.MEGAPAY_API_URL ??
    process.env.NEZEEM_MEGAPAY_BASE_URL ??
    process.env.ACEGIRLS_MEGAPAY_BASE_URL ??
    ""
  ).replace(/\/+$/, "");
  const apiKey = process.env.MEGAPAY_API_KEY ?? process.env.NEZEEM_MEGAPAY_API_KEY ?? process.env.ACEGIRLS_MEGAPAY_API_KEY ?? "";
  const email = process.env.MEGAPAY_EMAIL ?? process.env.NEZEEM_MEGAPAY_EMAIL ?? process.env.ACEGIRLS_MEGAPAY_EMAIL ?? "";

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

  let existing = null;
  try {
    existing = await db.transaction.findUnique({
      where: { reference: transactionRequestId },
      include: { user: { select: { walletBalance: true } } },
    });
  } catch (ledgerErr) {
    console.error("Deposit status ledger lookup failed:", ledgerErr);
  }

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

  if (!existing) {
    return Response.json({
      status: "confirmed",
      message: "Payment confirmed.",
      receipt: mpData.TransactionReceipt ?? "",
    });
  }

  try {
    const updated = await db.$transaction(async (tx) => {
      const claimed = await tx.transaction.updateMany({
        where: { reference: transactionRequestId, status: TransactionStatus.PENDING },
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
      if (claimed.count === 0) {
        return tx.user.findUniqueOrThrow({
          where: { id: existing.userId },
          select: { walletBalance: true },
        });
      }

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
  } catch (ledgerErr) {
    console.error("Deposit status ledger update failed:", ledgerErr);
    return Response.json({
      status: "confirmed",
      message: "Payment confirmed.",
      receipt: mpData.TransactionReceipt ?? "",
    });
  }
}
