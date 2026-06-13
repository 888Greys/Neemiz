import { createClient } from "@/lib/supabase/server";
import { db }           from "@/lib/db";
import { TransactionStatus } from "@prisma/client";
import { checkAndSettleMegapay } from "@/lib/megapay-settle";

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
    where:   { id: transactionRequestId },
    include: { user: { select: { walletBalance: true } } },
  });

  if (!txn) return Response.json({ status: "pending", message: "Waiting for confirmation…" });

  // Already settled
  if (txn.status === TransactionStatus.COMPLETED) {
    const meta    = txn.metadata as Record<string, string> | null;
    const receipt = meta?.TransactionReceipt ?? meta?.relworxRef ?? meta?.confirmationCode ?? "";
    return Response.json({
      status:     "confirmed",
      newBalance: Number(txn.user.walletBalance),
      amount:     Number(txn.amount),
      receipt,
    });
  }
  if (txn.status === TransactionStatus.FAILED) {
    return Response.json({ status: "failed", message: "Payment was not completed. Please try again." });
  }

  // Still PENDING — actively query MegaPay for MegaPay transactions
  if (txn.provider === "megapay" && txn.reference) {
    const settled = await checkAndSettleMegapay(txn.id, txn.reference);
    if (settled === "completed") {
      // Re-fetch with updated balance
      const fresh = await db.transaction.findUnique({
        where:   { id: txn.id },
        include: { user: { select: { walletBalance: true } } },
      });
      const meta    = fresh?.metadata as Record<string, string> | null;
      const receipt = meta?.TransactionReceipt ?? "";
      return Response.json({
        status:     "confirmed",
        newBalance: Number(fresh?.user.walletBalance ?? 0),
        amount:     Number(txn.amount),
        receipt,
      });
    }
  }

  return Response.json({ status: "pending", message: "Waiting for M-Pesa confirmation…" });
}
