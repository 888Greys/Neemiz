/**
 * Lipa Haraka API v2.0.0 client.
 * Docs: POST https://lipaharakaapis.co.ke/api.php?action=…
 * Auth: api_key form field. STK needs channel_id. Callbacks are signed with
 * X-Signature = HMAC-SHA256(rawBody, webhookSecret) — verified in the webhook route.
 */

const BASE_URL = "https://lipaharakaapis.co.ke/api.php";

export function normalizeKenyanPhone(value: string) {
  const phone = value.trim().replace(/\s+/g, "");
  if (phone.startsWith("+254")) return phone.slice(1);
  if (phone.startsWith("0") && phone.length === 10) return `254${phone.slice(1)}`;
  return phone;
}

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
}

/** v2 nests ids under `data`; older replies put them on the top level. */
function pick(body: Record<string, unknown>, ...keys: string[]): unknown {
  const data = asRecord(body.data ?? body.result);
  for (const key of keys) {
    if (data[key] != null && data[key] !== "") return data[key];
  }
  for (const key of keys) {
    if (body[key] != null && body[key] !== "") return body[key];
  }
  return undefined;
}

export async function initiateLipaHarakaStk(phone: string, amount: number) {
  const apiKey = process.env.LIPAHARAKA_API_KEY;
  const channelId = process.env.LIPAHARAKA_CHANNEL_ID;
  if (!apiKey || !channelId) throw new Error("Lipa Haraka is not configured");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(`${BASE_URL}?action=api_stk`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ api_key: apiKey, phone, amount: String(amount), channel_id: channelId }),
      signal: controller.signal,
    });
    const body = await response.json().catch(() => ({})) as Record<string, unknown>;
    const nested = asRecord(body.data ?? body.result);

    // v2 success:
    // { success:true, data:{ payment_id, checkout_request_id, merchant_request_id } }
    // Callback matches on checkout_request_id (ws_CO_…). Never use payment_id as
    // Transaction.reference — that caused paid deposits to miss the webhook.
    const checkoutRequestId = pick(body, "checkout_request_id", "CheckoutRequestID", "checkoutRequestId");
    const paymentId = pick(body, "payment_id", "merchant_request_id");
    const status = String(body.status ?? nested.status ?? "").toLowerCase();
    const success = body.success === true || body.ok === true || body.success === 1 || body.success === "1"
      || body.success === "true" || status === "success" || status === "successful" || status === "queued";

    if (!response.ok || !success || (checkoutRequestId == null && paymentId == null)) {
      console.error("Lipa Haraka STK response was not recognized", {
        status: response.status,
        keys: Object.keys(body),
        nestedKeys: Object.keys(nested),
        hasCheckoutRequestId: checkoutRequestId != null,
        hasPaymentId: paymentId != null,
      });
      throw new Error(String(body.message ?? body.error ?? `Lipa Haraka error ${response.status}`));
    }
    if (checkoutRequestId == null) {
      console.warn("Lipa Haraka STK accepted without checkout_request_id — callback will match via phone/amount or payment_id", {
        paymentId: String(paymentId),
      });
    }
    return {
      checkoutRequestId: checkoutRequestId != null ? String(checkoutRequestId) : "",
      transactionId: paymentId != null ? String(paymentId) : "",
    };
  } finally {
    clearTimeout(timer);
  }
}

export interface LipaWithdrawalAck {
  /** Lipa received and queued the request (async). NOT a confirmation of payout. */
  accepted: boolean;
  /** v2 `data.withdrawal_id` (e.g. WD_…) — store as Transaction.reference. */
  reference: string | null;
  /** v2 `data.transaction_id` when present at submit time (often only on callback). */
  providerTxnId: string | null;
  /** Human-readable provider message. */
  message: string | null;
}

/**
 * v2 B2C submit success:
 * { success:true, data:{ withdrawal_id, amount, balance_after, transaction_id } }
 * Final outcome arrives on the webhook with { phone, amount, transaction_id, status }.
 * Note: callback `transaction_id` is NOT the same field as submit `withdrawal_id`.
 */
export async function initiateLipaHarakaWithdrawal(phone: string, amount: number): Promise<LipaWithdrawalAck> {
  const apiKey = process.env.LIPAHARAKA_API_KEY;
  if (!apiKey) throw new Error("Lipa Haraka is not configured");
  const response = await fetch(`${BASE_URL}?action=api_withdraw`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ api_key: apiKey, phone, amount: String(amount) }),
  });
  const raw = await response.text();
  let body: Record<string, unknown> = {};
  try {
    body = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    // Older plain-text acks ("Withdrawal request sent") still count as accepted.
  }
  const nested = asRecord(body.data ?? body.result);
  const withdrawalId = pick(body, "withdrawal_id", "withdrawalId");
  const providerTxnId = pick(body, "transaction_id", "transactionId");
  const providerMessage = body.message ?? body.error ?? body.error_message ?? body.description
    ?? nested.message ?? nested.error ?? nested.error_message ?? nested.description;
  const providerCode = body.code ?? nested.code;

  const statusStr = String(body.status ?? nested.status ?? "").toLowerCase();
  const haystack = `${statusStr} ${String(providerMessage ?? "")} ${raw}`.toLowerCase();

  const FAILURE = ["fail", "error", "reject", "declin", "insufficient", "invalid", "not allowed", "unauthor", "duplicate", "low_balance"];
  const explicitFailure = body.success === false || nested.success === false
    || FAILURE.some((s) => statusStr.includes(s));

  const ACCEPT = ["request sent", "initiated successfully", "request received", "queued", "processing", "pending", "success", "accepted", "on its way"];
  const accepted = response.ok && !explicitFailure
    && (body.success === true || body.ok === true || nested.success === true || nested.ok === true
      || withdrawalId != null || ACCEPT.some((s) => haystack.includes(s)));

  if (!accepted) {
    console.error("Lipa Haraka B2C response was rejected", {
      status: response.status,
      keys: Object.keys(body),
      nestedKeys: Object.keys(nested),
      providerCode: providerCode == null ? undefined : String(providerCode),
      providerMessage: providerMessage == null ? undefined : String(providerMessage),
      preview: raw.slice(0, 160),
    });
    return {
      accepted: false,
      reference: withdrawalId != null ? String(withdrawalId) : null,
      providerTxnId: providerTxnId != null ? String(providerTxnId) : null,
      message: providerMessage == null ? null : String(providerMessage),
    };
  }

  return {
    accepted: true,
    reference: withdrawalId != null ? String(withdrawalId) : null,
    providerTxnId: providerTxnId != null ? String(providerTxnId) : null,
    message: providerMessage == null ? null : String(providerMessage),
  };
}
