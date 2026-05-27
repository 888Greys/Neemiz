import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { TransactionStatus } from "@prisma/client";

// Relworx confirms deposits via webhook (POST /api/webhooks/relworx).
// This route just polls our DB — the webhook handler marks it COMPLETED
// and credits the balance once Relworx fires.

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let body: { transactionRequestId: string };
  try { body = await req.json(); }
  catch { return Response.json({ error: "Invalid body" }, { status: 400 }); }

  const { transactionRequestId } = body;
  if (!transactionRequestId) {
    return Response.json({ error: "Missing transactionRequestId" }, { status: 400 });
  }

  const txn = await db.transaction.findUnique({
    where: { id: transactionRequestId },
    include: { user: { select: { walletBalance: true } } },
  });

  if (!txn) {
    return Response.json({ status: "pending", message: "Waiting for confirmation…" });
  }

  if (txn.status === TransactionStatus.COMPLETED) {
    return Response.json({
      status:     "confirmed",
      newBalance: Number(txn.user.walletBalance),
      message:    `KSh ${Number(txn.amount).toLocaleString()} added to your wallet!`,
      receipt:    (txn.metadata as Record<string, string> | null)?.relworxRef ?? "",
    });
  }

  if (txn.status === TransactionStatus.FAILED) {
    return Response.json({ status: "failed", message: "Payment was not completed." });
  }

  // Still PENDING — webhook hasn't fired yet
  return Response.json({ status: "pending", message: "Waiting for M-Pesa confirmation…" });
}
