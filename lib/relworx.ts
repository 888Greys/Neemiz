const RELWORX_SEND_URL    = "https://payments.relworx.com/api/mobile-money/send-payment";
const RELWORX_REQUEST_URL = "https://payments.relworx.com/api/mobile-money/request-payment";

interface RelworxPayload {
  account_no: string;
  reference:  string;
  msisdn:     string;
  currency:   string;
  amount:     number;
  description: string;
}

export interface RelworxResult {
  success:   boolean;
  message?:  string;
  reference?: string;
  raw:        unknown;
}

async function relworxPost(url: string, payload: RelworxPayload): Promise<RelworxResult> {
  const apiKey = process.env.RELWORX_API_KEY;
  if (!apiKey) throw new Error("RELWORX_API_KEY not configured");

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept":        "application/vnd.relworx.v2",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  let raw: unknown;
  try { raw = await res.json(); } catch { raw = null; }

  if (!res.ok) {
    const msg = (raw as Record<string, string> | null)?.message ?? `Relworx error ${res.status}`;
    throw new Error(msg);
  }

  const data = raw as Record<string, unknown>;
  return {
    success:   true,
    message:   data?.message as string | undefined,
    reference: data?.reference as string | undefined,
    raw,
  };
}

export function relworxSend(payload: RelworxPayload): Promise<RelworxResult> {
  return relworxPost(RELWORX_SEND_URL, payload);
}

export function relworxRequestPayment(payload: RelworxPayload): Promise<RelworxResult> {
  return relworxPost(RELWORX_REQUEST_URL, payload);
}
