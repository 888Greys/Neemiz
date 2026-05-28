import { createClient } from "@/lib/supabase/server";
import { db }           from "@/lib/db";
import { TransactionStatus } from "@prisma/client";

const MEGAPAY_BASE_URL = (process.env.MEGAPAY_BASE_URL ?? "").replace(/\/+$/, "");
const MEGAPAY_API_KEY  = process.env.MEGAPAY_API_KEY ?? "";
const MEGAPAY_EMAIL    = process.env.MEGAPAY_EMAIL ?? "";

/**
 * Directly queries MegaPay for the transaction status and credits the
 * wallet if COMPLETED. Returns true if the transaction was settled.
 */
async function checkAndSettleMegapay(txnId: string, providerRequestId: string): Promise<boolean> {
  if (!MEGAPAY_BASE_URL || !MEGAPAY_API_KEY || !MEGAPAY_EMAIL) return false;
  try {
    const res = await fetch(`${MEGAPAY_BASE_URL}/backend/v1/transactionstatus`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        api_key:                MEGAPAY_API_KEY,
        email:                  MEGAPAY_EMAIL,
        transaction_request_id: providerRequestId,
      }),
    });
    if (!res.ok) return false;
    const data = await res.json() as Record<string, unknown>;

    // MegaPay marks success with ResultCode "0" / 0 and TransactionStatus "Completed"
    const resultCode   = String(data.ResultCode  ?? data.ResponseCode ?? "-1");
    const statusStr    = String(data.TransactionStatus ?? "").toLowerCase();
    const isCompleted  = resultCode === "0" || statusStr === "completed";
    const isFailed     = ["1", "1032", "1037", "1019", "1001"].includes(resultCode) || statusStr === "failed";

    if (isCompleted) {
      await db.$transaction(async (tx) => {
        const claimed = await tx.transaction.updateMany({
          where: { id: txnId, status: TransactionStatus.PENDING },
          data: {
            status:   TransactionStatus.COMPLETED,
            metadata: {
              megapayPolled:      true,
              TransactionReceipt: String(data.TransactionReceipt ?? ""),
              TransactionCode:    String(data.TransactionCode    ?? ""),
              settledAt:          new Date().toISOString(),
            },
          },
        });
        if (claimed.count === 0) return; // already settled by webhook
        const txnRecord = await tx.transaction.findUnique({ where: { id: txnId } });
        if (txnRecord) {
          await tx.user.update({
            where: { id: txnRecord.userId },
            data:  { walletBalance: { increment: Number(txnRecord.amount) } },
          });
        }
      });
      return true;
    }

    if (isFailed) {
      await db.transaction.updateMany({
        where: { id: txnId, status: TransactionStatus.PENDING },
        data:  { status: TransactionStatus.FAILED },
      });
      return false;
    }
  } catch { /* best-effort — fall back to DB state */ }
  return false;
}

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
    if (settled) {
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
