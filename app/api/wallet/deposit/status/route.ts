import { createClient } from "@/lib/supabase/server";
import { db }           from "@/lib/db";
import { TransactionStatus } from "@prisma/client";
import { checkAndSettleMegapay } from "@/lib/megapay-settle";
import { settlePesapalTransaction } from "@/lib/pesapal";

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

  const txn = await db.transaction.findFirst({
    where: {
      id: transactionRequestId,
      user: { supabaseId: user.id },
    },
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

  // Still PENDING — actively query Pesapal (card / international deposits).
  // The client polls this on return from the Pesapal checkout page, so we can't
  // rely on the IPN webhook alone having arrived yet.
  if (txn.provider === "pesapal" && txn.reference) {
    const result = await settlePesapalTransaction(txn.id, txn.reference);
    if (result === "confirmed") {
      const fresh = await db.transaction.findUnique({
        where:   { id: txn.id },
        include: { user: { select: { walletBalance: true } } },
      });
      const meta = fresh?.metadata as Record<string, string> | null;
      return Response.json({
        status:     "confirmed",
        newBalance: Number(fresh?.user.walletBalance ?? 0),
        amount:     Number(txn.amount),
        receipt:    meta?.confirmationCode ?? "",
      });
    }
    if (result === "failed") {
      return Response.json({ status: "failed", message: "Payment was not completed. Please try again." });
    }
    return Response.json({ status: "pending", message: "Verifying your payment…" });
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
