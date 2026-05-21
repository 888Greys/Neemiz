/**
 * NOWPayments API client
 * Docs: https://documenter.getpostman.com/view/7907941/2s93JxqLZH
 *
 * Required env vars:
 *   NOWPAYMENTS_API_KEY      — from NOWPayments dashboard
 *   NOWPAYMENTS_IPN_SECRET   — set in NOWPayments dashboard under "IPN settings"
 *   NOWPAYMENTS_CALLBACK_URL — public URL of /api/crypto/deposit-webhook
 */

import { createHmac } from "crypto";

const BASE    = "https://api.nowpayments.io/v1";
const API_KEY = process.env.NOWPAYMENTS_API_KEY ?? "";

// ─── Currency map ─────────────────────────────────────────────────────────────
// Maps NOWPayments pay_currency codes → our internal (crypto, network) pair

export const NP_TO_INTERNAL: Record<string, { crypto: string; network: string }> = {
  usdttrc20:  { crypto: "USDT",  network: "TRC20"   },
  usdterc20:  { crypto: "USDT",  network: "ERC20"   },
  usdtbsc:    { crypto: "USDT",  network: "BEP20"   },
  usdcmatic:  { crypto: "USDC",  network: "POLYGON" },
  usdcerc20:  { crypto: "USDC",  network: "ERC20"   },
  btc:        { crypto: "BTC",   network: "BTC"     },
  eth:        { crypto: "ETH",   network: "ERC20"   },
  bnbbsc:     { crypto: "BNB",   network: "BEP20"   },
  maticmainnet: { crypto: "MATIC", network: "POLYGON" },
};

// Maps our (crypto:network) → NOWPayments pay_currency code
export const INTERNAL_TO_NP: Record<string, string> = {
  "USDT:TRC20":    "usdttrc20",
  "USDT:ERC20":    "usdterc20",
  "USDT:BEP20":    "usdtbsc",
  "USDC:POLYGON":  "usdcmatic",
  "USDC:ERC20":    "usdcerc20",
  "BTC:BTC":       "btc",
  "ETH:ERC20":     "eth",
  "BNB:BEP20":     "bnbbsc",
  "MATIC:POLYGON": "maticmainnet",
};

export function toNpCurrency(crypto: string, network: string): string {
  const key = `${crypto.toUpperCase()}:${network.toUpperCase()}`;
  return INTERNAL_TO_NP[key] ?? crypto.toLowerCase();
}

// ─── Core fetch helper ────────────────────────────────────────────────────────

async function npFetch<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  if (!API_KEY) throw new Error("NOWPAYMENTS_API_KEY is not configured");

  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      "x-api-key":    API_KEY,
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });

  const text = await res.text();
  let json: unknown;
  try   { json = JSON.parse(text); }
  catch { json = { raw: text };    }

  if (!res.ok) {
    const msg = (json as Record<string, unknown>)?.message
      ?? (json as Record<string, unknown>)?.error
      ?? text;
    throw new Error(`NOWPayments ${res.status}: ${msg}`);
  }
  return json as T;
}

// ─── Payment (deposit) ────────────────────────────────────────────────────────

export interface NpPayment {
  payment_id:      string;
  pay_address:     string;
  pay_currency:    string;
  pay_amount:      number;
  price_amount:    number;
  price_currency:  string;
  payment_status:  string;
  expiration_estimate_date?: string;
}

export async function createPayment(opts: {
  payCurrency:  string;   // e.g. "usdttrc20"
  priceAmount:  number;   // amount the user wants to deposit (in that crypto — we pass 1:1)
  orderId:      string;   // userId
  callbackUrl?: string;
}): Promise<NpPayment> {
  const callbackUrl =
    opts.callbackUrl ??
    process.env.NOWPAYMENTS_CALLBACK_URL ??
    `${process.env.NEXTAUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? ""}/api/crypto/deposit-webhook`;

  return npFetch<NpPayment>("/payment", {
    method: "POST",
    body: JSON.stringify({
      price_amount:      opts.priceAmount,
      price_currency:    opts.payCurrency,   // treat amount as in-crypto (1:1)
      pay_currency:      opts.payCurrency,
      ipn_callback_url:  callbackUrl,
      order_id:          opts.orderId,
      order_description: `Nezeem crypto deposit — ${opts.orderId}`,
    }),
  });
}

export async function getPaymentStatus(paymentId: string): Promise<NpPayment> {
  return npFetch<NpPayment>(`/payment/${paymentId}`);
}

// ─── Payout (withdrawal) ──────────────────────────────────────────────────────

export interface NpPayout {
  id:       string;
  status:   string;
  batch_withdrawal_id?: string;
}

export async function createPayout(opts: {
  address:    string;
  currency:   string;   // e.g. "usdttrc20"
  amount:     number;
  externalId: string;   // unique — use withdrawalTxId
  callbackUrl?: string;
}): Promise<NpPayout> {
  const callbackUrl =
    opts.callbackUrl ??
    process.env.NOWPAYMENTS_CALLBACK_URL ??
    `${process.env.NEXTAUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? ""}/api/crypto/withdraw-webhook`;

  return npFetch<NpPayout>("/payout", {
    method: "POST",
    body: JSON.stringify({
      withdrawals: [{
        address:            opts.address,
        currency:           opts.currency,
        amount:             opts.amount,
        unique_external_id: opts.externalId,
        ipn_callback_url:   callbackUrl,
      }],
    }),
  });
}

// ─── IPN signature verification ───────────────────────────────────────────────

export function verifyIpnSignature(rawBody: string, signature: string): boolean {
  const secret = process.env.NOWPAYMENTS_IPN_SECRET;
  if (!secret) {
    console.warn("NOWPAYMENTS_IPN_SECRET not set — rejecting IPN signature check");
    return false;
  }
  const expected = createHmac("sha512", secret).update(rawBody).digest("hex");
  return expected === signature;
}

// ─── IPN payload types ────────────────────────────────────────────────────────

export interface NpIpnPayload {
  payment_id:      string;
  payment_status:  "waiting" | "confirming" | "confirmed" | "sending" | "partially_paid" | "finished" | "failed" | "refunded" | "expired";
  pay_address:     string;
  price_amount:    number;
  price_currency:  string;
  pay_amount:      number;
  actually_paid:   number;
  pay_currency:    string;    // e.g. "usdttrc20"
  outcome_amount:  number;    // after NOWPayments fee
  outcome_currency:string;
  order_id:        string;    // our userId
  order_description?: string;
}

// Statuses that mean "money has arrived and is settled"
export const SETTLED_STATUSES = new Set(["finished", "confirmed"]);
// Statuses that mean "this payment is dead"
export const FAILED_STATUSES  = new Set(["failed", "refunded", "expired"]);
