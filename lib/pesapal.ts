/**
 * Pesapal v3 API integration.
 * Env vars required:
 *   PESAPAL_CONSUMER_KEY
 *   PESAPAL_CONSUMER_SECRET
 *   PESAPAL_IPN_ID          — registered IPN notification ID (set once via register-ipn)
 *   NEXT_PUBLIC_BASE_URL    — e.g. https://nezeem.com
 *
 * Sandbox base: https://cybqa.pesapal.com/pesapalv3
 * Production:   https://pay.pesapal.com/v3
 */

import { db } from "@/lib/db";
import { TransactionStatus } from "@prisma/client";

const BASE_URL = process.env.PESAPAL_ENV === "production"
  ? "https://pay.pesapal.com/v3"
  : "https://cybqa.pesapal.com/pesapalv3";

// ─── Token cache (in-process, 4-minute TTL) ──────────────────────────────────

let _token: string | null = null;
let _tokenExpiry = 0;

async function getToken(): Promise<string> {
  if (_token && Date.now() < _tokenExpiry) return _token;

  const key    = process.env.PESAPAL_CONSUMER_KEY;
  const secret = process.env.PESAPAL_CONSUMER_SECRET;
  if (!key || !secret) throw new Error("PESAPAL_CONSUMER_KEY / PESAPAL_CONSUMER_SECRET not configured");

  const res = await fetch(`${BASE_URL}/api/Auth/RequestToken`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ consumer_key: key, consumer_secret: secret }),
  });

  if (!res.ok) throw new Error(`Pesapal auth failed: ${res.status}`);
  const data = await res.json() as { token: string; expiryDate: string };
  _token = data.token;
  _tokenExpiry = Date.now() + 4 * 60 * 1000;
  return _token;
}

// ─── Register IPN (run once during setup) ────────────────────────────────────

export async function registerIPN(): Promise<{ ipn_id: string }> {
  const token    = await getToken();
  const baseUrl  = process.env.NEXT_PUBLIC_BASE_URL ?? "";
  const res = await fetch(`${BASE_URL}/api/URLSetup/RegisterIPN`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      url: `${baseUrl}/api/wallet/pesapal/ipn`,
      ipn_notification_type: "POST",
    }),
  });
  if (!res.ok) throw new Error(`Pesapal IPN registration failed: ${res.status}`);
  return res.json();
}

// ─── Submit order (returns iframe URL) ───────────────────────────────────────

export interface PesapalOrderInput {
  id:          string;   // our internal transaction ID
  amount:      number;   // KES
  description: string;
  email?:      string;
  phone?:      string;
  firstName?:  string;
  lastName?:   string;
}

export interface PesapalOrderResult {
  redirectUrl: string;
  orderTrackingId: string;
}

export async function submitOrder(input: PesapalOrderInput): Promise<PesapalOrderResult> {
  const token   = await getToken();
  const ipnId   = process.env.PESAPAL_IPN_ID;
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "";

  if (!ipnId) throw new Error("PESAPAL_IPN_ID not configured");

  const res = await fetch(`${BASE_URL}/api/Transactions/SubmitOrderRequest`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      id:                  input.id,
      currency:            "KES",
      amount:              input.amount,
      description:         input.description,
      // Route the return through a server endpoint (not the client page) so the
      // wallet is credited server-side, keyed to the transaction id, before the
      // browser lands. This is independent of the user's session — if they come
      // back logged out, the money still credits. See pesapal/return/route.ts.
      callback_url:        `${baseUrl}/api/wallet/pesapal/return?ref=${input.id}`,
      notification_id:     ipnId,
      billing_address: {
        email_address: input.email ?? "",
        phone_number:  input.phone ?? "",
        first_name:    input.firstName ?? "",
        last_name:     input.lastName ?? "",
        country_code:  "KE",
      },
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => null) as Record<string, unknown> | null;
    throw new Error((err?.message as string) ?? `Pesapal submit failed: ${res.status}`);
  }

  const data = await res.json() as { redirect_url: string; order_tracking_id: string };
  return { redirectUrl: data.redirect_url, orderTrackingId: data.order_tracking_id };
}

// ─── Query transaction status ─────────────────────────────────────────────────

export interface PesapalStatusResult {
  status: "COMPLETED" | "FAILED" | "INVALID" | "REVERSED" | "PENDING";
  paymentMethod: string;
  amount: number;
  createdDate: string;
  confirmationCode: string;
}

export async function getTransactionStatus(orderTrackingId: string): Promise<PesapalStatusResult> {
  const token = await getToken();
  const res = await fetch(
    `${BASE_URL}/api/Transactions/GetTransactionStatus?orderTrackingId=${orderTrackingId}`,
    { headers: { Accept: "application/json", Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) throw new Error(`Pesapal status check failed: ${res.status}`);
  const d = await res.json() as {
    payment_status_description: string;
    payment_method: string;
    amount: number;
    created_date: string;
    confirmation_code: string;
  };
  return {
    // Pesapal is inconsistent about casing here — it returns "Completed",
    // "Failed", "INVALID", "Reversed" (mixed case) even though the values are
    // otherwise our uppercase union. Normalize so the settle logic's
    // `=== "COMPLETED"` comparison actually matches a paid order. Without this,
    // a genuinely-paid deposit is read as PENDING forever and never credits.
    status:           d.payment_status_description?.toUpperCase() as PesapalStatusResult["status"],
    paymentMethod:    d.payment_method,
    amount:           d.amount,
    createdDate:      d.created_date,
    confirmationCode: d.confirmation_code,
  };
}

// ─── Settle a deposit (shared by the IPN webhook + the status poll) ───────────

export type PesapalSettleResult = "confirmed" | "failed" | "pending";

/**
 * Idempotently settle a pending Pesapal deposit against Pesapal's authoritative
 * status. Credits the wallet exactly once: the conditional update on PENDING is
 * the guard, so if the IPN webhook and the client status-poll race, only the
 * first one to flip PENDING→COMPLETED credits the balance.
 */
export async function settlePesapalTransaction(
  txnId: string,
  orderTrackingId: string,
): Promise<PesapalSettleResult> {
  const status = await getTransactionStatus(orderTrackingId);

  if (status.status === "COMPLETED") {
    await db.$transaction(async (tx) => {
      const claimed = await tx.transaction.updateMany({
        where: { id: txnId, status: TransactionStatus.PENDING },
        data:  {
          status:    TransactionStatus.COMPLETED,
          reference: orderTrackingId,
          metadata:  {
            orderTrackingId,
            confirmationCode: status.confirmationCode,
            paymentMethod:    status.paymentMethod,
            settledAt:        new Date().toISOString(),
          },
        },
      });
      if (claimed.count === 1) {
        const txn = await tx.transaction.findUnique({
          where:  { id: txnId },
          select: { userId: true, amount: true },
        });
        if (txn) {
          await tx.user.update({
            where: { id: txn.userId },
            data:  { walletBalance: { increment: txn.amount } },
          });
        }
      }
    });
    return "confirmed";
  }

  if (status.status === "FAILED" || status.status === "INVALID" || status.status === "REVERSED") {
    await db.transaction.updateMany({
      where: { id: txnId, status: TransactionStatus.PENDING },
      data:  { status: TransactionStatus.FAILED, reference: orderTrackingId },
    });
    return "failed";
  }

  return "pending";
}
