const BASE_URL = "https://lipaharakaapis.co.ke/api.php";

export function normalizeKenyanPhone(value: string) {
  const phone = value.trim().replace(/\s+/g, "");
  if (phone.startsWith("+254")) return phone.slice(1);
  if (phone.startsWith("0") && phone.length === 10) return `254${phone.slice(1)}`;
  return phone;
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
    const nested = (body.data ?? body.result ?? {}) as Record<string, unknown>;
    // CheckoutRequestID (ws_CO_…) is what Lipa's paid callback sends. Never fall
    // back to payment_id for that field — the numeric id is different, and storing
    // it as Transaction.reference made webhook matching miss (today: 17/17 numeric
    // refs FAILED, 19/19 ws_CO_ refs COMPLETED). If Lipa only returns payment_id,
    // still accept the STK and let the callback match on phone+amount / lipaTransactionId.
    const checkoutRequestId = body.CheckoutRequestID ?? body.checkout_request_id ?? body.checkoutRequestId
      ?? nested.CheckoutRequestID ?? nested.checkout_request_id ?? nested.checkoutRequestId;
    const paymentId = body.payment_id ?? body.transaction_id ?? body.transactionId
      ?? nested.payment_id ?? nested.transaction_id ?? nested.transactionId;
    const status = String(body.status ?? nested.status ?? "").toLowerCase();
    const success = body.ok === true || body.success === true || body.success === 1 || body.success === "1" || body.success === "true" || status === "success" || status === "successful" || status === "queued";
    if (!response.ok || !success || (checkoutRequestId == null && paymentId == null)) {
      console.error("Lipa Haraka STK response was not recognized", {
        status: response.status,
        keys: Object.keys(body),
        nestedKeys: Object.keys(nested),
        hasCheckoutRequestId: checkoutRequestId != null,
        hasPaymentId: paymentId != null,
      });
      throw new Error(String(body.error ?? body.message ?? `Lipa Haraka error ${response.status}`));
    }
    if (checkoutRequestId == null) {
      console.warn("Lipa Haraka STK accepted without CheckoutRequestID — callback will match via phone/amount or payment_id", {
        paymentId: String(paymentId),
        keys: Object.keys(body),
      });
    }
    return {
      checkoutRequestId: checkoutRequestId != null ? String(checkoutRequestId) : "",
      transactionId: paymentId != null ? String(paymentId) : "",
    };
  } finally { clearTimeout(timer); }
}

export interface LipaWithdrawalAck {
  /** Lipa received and queued the request (async). NOT a confirmation of payout. */
  accepted: boolean;
  /** Provider withdrawal/transaction id, when returned immediately. Often null
   *  until the request moves to PROCESSING — the final status arrives via callback. */
  reference: string | null;
  /** Human-readable provider message, e.g. "Withdrawal request sent". */
  message: string | null;
}

/**
 * Lipa Haraka B2C is ASYNC: a successful submit returns HTTP 200 with a body
 * like `{ status: "...", message: "Withdrawal request sent" }` — usually with
 * NO withdrawal id yet. The id/payout outcome arrives later via the callback
 * webhook. So we must NOT treat a missing id as failure (doing so previously
 * caused refunds for withdrawals Lipa had actually accepted).
 *
 * Returns `accepted:false` for an explicit provider rejection. Throws only on a
 * transport-level failure (no response received) — the caller refunds in both
 * of those cases, but keeps the withdrawal PENDING when `accepted:true`.
 */
export async function initiateLipaHarakaWithdrawal(phone: string, amount: number): Promise<LipaWithdrawalAck> {
  const apiKey = process.env.LIPAHARAKA_API_KEY;
  if (!apiKey) throw new Error("Lipa Haraka is not configured");
  const response = await fetch(`${BASE_URL}?action=api_withdraw`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ api_key: apiKey, phone, amount: String(amount) }) });
  const raw = await response.text();
  let body: Record<string, unknown> = {};
  try { body = JSON.parse(raw) as Record<string, unknown>; } catch {
    // Lipa sometimes replies in plain text ("Withdrawal request sent") — that is
    // still a valid async acknowledgement, so don't treat a non-JSON body as failure.
  }
  const nested = (body.data ?? body.result ?? {}) as Record<string, unknown>;
  const id = body.withdrawal_id ?? body.withdrawalId ?? body.payment_id ?? body.transaction_id
    ?? nested.withdrawal_id ?? nested.withdrawalId ?? nested.payment_id ?? nested.transaction_id;
  const providerMessage = body.error ?? body.message ?? body.error_message ?? body.description ?? body.reason
    ?? nested.error ?? nested.message ?? nested.error_message ?? nested.description ?? nested.reason;
  const providerCode = body.code ?? body.status_code ?? body.error_code
    ?? nested.code ?? nested.status_code ?? nested.error_code;

  const statusStr = String(body.status ?? nested.status ?? "").toLowerCase();
  const haystack = `${statusStr} ${String(providerMessage ?? "")} ${raw}`.toLowerCase();

  // Explicit rejection signals — only these should refund.
  const FAILURE = ["fail", "error", "reject", "declin", "insufficient", "invalid", "not allowed", "unauthor", "duplicate"];
  const explicitFailure = body.success === false || nested.success === false
    || FAILURE.some((s) => statusStr.includes(s));

  // Acceptance signals — async "received/queued" replies count as accepted.
  const ACCEPT = ["request sent", "request received", "queued", "processing", "pending", "success", "accepted", "on its way"];
  const accepted = response.ok && !explicitFailure
    && (body.ok === true || body.success === true || nested.ok === true || nested.success === true
        || id != null || ACCEPT.some((s) => haystack.includes(s)));

  if (!accepted) {
    console.error("Lipa Haraka B2C response was rejected", {
      status: response.status,
      contentType: response.headers.get("content-type"),
      keys: Object.keys(body),
      nestedKeys: Object.keys(nested),
      providerCode: providerCode == null ? undefined : String(providerCode),
      providerMessage: providerMessage == null ? undefined : String(providerMessage),
      preview: raw.slice(0, 160),
    });
    return { accepted: false, reference: id != null ? String(id) : null, message: providerMessage == null ? null : String(providerMessage) };
  }

  return { accepted: true, reference: id != null ? String(id) : null, message: providerMessage == null ? null : String(providerMessage) };
}
