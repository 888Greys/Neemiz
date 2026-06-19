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
    const checkoutRequestId = body.CheckoutRequestID ?? body.checkout_request_id ?? body.checkoutRequestId ?? body.payment_id ?? nested.CheckoutRequestID ?? nested.checkout_request_id ?? nested.checkoutRequestId ?? nested.payment_id;
    const status = String(body.status ?? nested.status ?? "").toLowerCase();
    const success = body.ok === true || body.success === true || body.success === 1 || body.success === "1" || body.success === "true" || status === "success" || status === "successful" || status === "queued";
    if (!response.ok || !success || !checkoutRequestId) {
      console.error("Lipa Haraka STK response was not recognized", { status: response.status, keys: Object.keys(body), nestedKeys: Object.keys(nested) });
      throw new Error(String(body.error ?? body.message ?? `Lipa Haraka error ${response.status}`));
    }
    return { checkoutRequestId: String(checkoutRequestId), transactionId: String(body.transaction_id ?? body.transactionId ?? body.payment_id ?? "") };
  } finally { clearTimeout(timer); }
}

export async function initiateLipaHarakaWithdrawal(phone: string, amount: number) {
  const apiKey = process.env.LIPAHARAKA_API_KEY;
  if (!apiKey) throw new Error("Lipa Haraka is not configured");
  const response = await fetch(`${BASE_URL}?action=api_withdraw`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ api_key: apiKey, phone, amount: String(amount) }) });
  const raw = await response.text();
  let body: Record<string, unknown> = {};
  try { body = JSON.parse(raw) as Record<string, unknown>; } catch {
    console.error("Lipa Haraka B2C returned non-JSON", { status: response.status, contentType: response.headers.get("content-type"), preview: raw.slice(0, 120) });
  }
  const id = body.withdrawal_id ?? body.withdrawalId ?? body.payment_id;
  if (!response.ok || !(body.ok === true || body.success === true) || !id) throw new Error(String(body.error ?? body.message ?? `Lipa Haraka error ${response.status}`));
  return String(id);
}
