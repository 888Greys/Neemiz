import { db } from "@/lib/db";
import { settlePesapalTransaction } from "@/lib/pesapal";
import { TransactionStatus } from "@prisma/client";

export const runtime = "nodejs";

/**
 * Pesapal checkout return handler.
 *
 * Pesapal redirects the customer's browser here after payment, appending
 * OrderTrackingId, OrderMerchantReference and OrderNotificationType to the
 * callback URL we registered (we also carry our own txn id as `ref`).
 *
 * We settle the wallet HERE — server-side, keyed to the transaction id — so the
 * credit does not depend on the browser still holding a valid session. If the
 * user returns logged out, the money still lands. Settlement is idempotent
 * (settlePesapalTransaction guards on PENDING), so racing with the IPN webhook
 * or the reconcile cron is safe. Then we bounce to /wallet, where the existing
 * client effect shows the confirmation and refreshes the balance.
 */
export async function GET(req: Request) {
  const { searchParams, origin } = new URL(req.url);

  // Behind nginx/Cloudflare the request's own origin is the container's internal
  // bind address (e.g. http://0.0.0.0:3000), which is useless as a browser
  // redirect target. Send the user back to the PUBLIC site instead — the same
  // base we registered the callback with — falling back to the request origin
  // only if it's not configured.
  const publicBase = (process.env.NEXT_PUBLIC_BASE_URL ?? origin).replace(/\/$/, "");

  const orderTrackingId = searchParams.get("OrderTrackingId");
  // OrderMerchantReference is our txn id; fall back to the `ref` we appended.
  const txnId = searchParams.get("OrderMerchantReference") ?? searchParams.get("ref");

  if (txnId) {
    try {
      const txn = await db.transaction.findUnique({
        where:  { id: txnId },
        select: { provider: true, status: true, reference: true },
      });
      if (
        txn &&
        txn.provider === "pesapal" &&
        txn.status !== TransactionStatus.COMPLETED &&
        txn.status !== TransactionStatus.FAILED
      ) {
        // Prefer the tracking id Pesapal handed us; otherwise use the one we
        // stored on the txn at checkout time.
        const tracking = orderTrackingId ?? txn.reference;
        if (tracking) await settlePesapalTransaction(txnId, tracking);
      }
    } catch (err) {
      // Best-effort: even if settling here fails, the IPN webhook and the
      // reconcile cron will still credit. Never block the redirect.
      console.error("[pesapal/return] settle failed", err);
    }
  }

  const dest = txnId
    ? `${publicBase}/wallet?pesapal_order_id=${encodeURIComponent(txnId)}`
    : `${publicBase}/wallet`;
  return Response.redirect(dest, 302);
}
