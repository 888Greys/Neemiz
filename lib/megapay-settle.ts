import { db } from "@/lib/db";
import { TransactionStatus } from "@prisma/client";

const MEGAPAY_BASE_URL = (process.env.MEGAPAY_BASE_URL ?? "").replace(/\/+$/, "");
const MEGAPAY_API_KEY  = process.env.MEGAPAY_API_KEY ?? "";
const MEGAPAY_EMAIL    = process.env.MEGAPAY_EMAIL ?? "";

export type SettleOutcome = "completed" | "failed" | "pending" | "skipped";

/**
 * Directly queries MegaPay for a PENDING deposit's status and settles it:
 *  - credits the wallet (once) if MegaPay reports the payment COMPLETED,
 *  - marks it FAILED if MegaPay reports a terminal failure,
 *  - leaves it PENDING (returns "pending") if still in flight.
 *
 * MegaPay is the source of truth — only genuinely-paid deposits get credited.
 * The wallet increment is guarded by a conditional updateMany (status: PENDING),
 * so a concurrent webhook or status-poll can never double-credit.
 */
export async function checkAndSettleMegapay(
  txnId: string,
  providerRequestId: string,
): Promise<SettleOutcome> {
  if (!MEGAPAY_BASE_URL || !MEGAPAY_API_KEY || !MEGAPAY_EMAIL) return "skipped";
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
    if (!res.ok) return "pending";
    const data = await res.json() as Record<string, unknown>;

    // MegaPay marks success with ResultCode "0" / 0 and TransactionStatus "Completed"
    const resultCode  = String(data.ResultCode ?? data.ResponseCode ?? "-1");
    const statusStr   = String(data.TransactionStatus ?? "").toLowerCase();
    const isCompleted = resultCode === "0" || statusStr === "completed";
    const isFailed    = ["1", "1032", "1037", "1019", "1001"].includes(resultCode) || statusStr === "failed";

    if (isCompleted) {
      let didCredit = false;
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
        if (claimed.count === 0) return; // already settled by webhook/poll
        const txnRecord = await tx.transaction.findUnique({ where: { id: txnId } });
        if (txnRecord) {
          await tx.user.update({
            where: { id: txnRecord.userId },
            data:  { walletBalance: { increment: Number(txnRecord.amount) } },
          });
          didCredit = true;
        }
      });
      return didCredit ? "completed" : "skipped";
    }

    if (isFailed) {
      await db.transaction.updateMany({
        where: { id: txnId, status: TransactionStatus.PENDING },
        data:  { status: TransactionStatus.FAILED },
      });
      return "failed";
    }
  } catch { /* best-effort — fall back to DB state */ }
  return "pending";
}
