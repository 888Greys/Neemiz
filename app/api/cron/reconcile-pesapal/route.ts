/**
 * Cron endpoint: reconcile stale PENDING Pesapal deposits.
 *
 * Backstop for the two normal crediting paths (the /api/wallet/pesapal/return
 * server redirect and the IPN webhook). If both are missed — user closes the
 * tab before returning, IPN never arrives — a paid deposit would otherwise sit
 * PENDING forever. This sweep re-queries Pesapal for any pesapal transaction
 * still PENDING after a short grace period and settles it idempotently.
 *
 * Guarded by CRON_SECRET, same as check-deposits. Run every few minutes from
 * the VPS cron on nez.
 */
import { db } from "@/lib/db";
import { settlePesapalTransaction } from "@/lib/pesapal";
import { TransactionStatus } from "@prisma/client";

export const runtime = "nodejs";

// Only touch deposits older than this, so we don't race the return redirect /
// IPN for a payment that's still mid-flight.
const GRACE_MS = 2 * 60 * 1000;

export async function GET(req: Request) {
  const auth   = req.headers.get("authorization") ?? "";
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ error: "CRON_SECRET is not configured" }, { status: 503 });
  if (auth !== `Bearer ${secret}`) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const cutoff = new Date(Date.now() - GRACE_MS);
  const pending = await db.transaction.findMany({
    where: {
      provider:  "pesapal",
      status:    TransactionStatus.PENDING,
      reference: { not: null },       // orderTrackingId stored at checkout
      createdAt: { lt: cutoff },
    },
    select: { id: true, reference: true },
    take:   100,
  });

  let confirmed = 0, failed = 0, stillPending = 0;
  const errors: string[] = [];

  for (const txn of pending) {
    try {
      const result = await settlePesapalTransaction(txn.id, txn.reference!);
      if (result === "confirmed") confirmed++;
      else if (result === "failed") failed++;
      else stillPending++;
    } catch (e) {
      errors.push(`${txn.id}: ${e instanceof Error ? e.message : "error"}`);
    }
  }

  return Response.json({ ok: true, scanned: pending.length, confirmed, failed, stillPending, errors });
}
