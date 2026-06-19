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
    if (!response.ok || body.success !== true || !body.CheckoutRequestID) {
      throw new Error(String(body.error ?? body.message ?? `Lipa Haraka error ${response.status}`));
    }
    return { checkoutRequestId: String(body.CheckoutRequestID), transactionId: String(body.transaction_id ?? "") };
  } finally { clearTimeout(timer); }
}
