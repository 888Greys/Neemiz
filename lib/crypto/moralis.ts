import { timingSafeEqual } from "crypto";
import { keccak256, stringToBytes } from "viem";

const MORALIS_STREAMS_API = "https://api.moralis-streams.com";

function normalizeHex(value: string): string {
  return value.toLowerCase().replace(/^0x/, "");
}

export function verifyMoralisSignature(payload: unknown, providedSignature: string | null): boolean {
  const secret = process.env.MORALIS_STREAM_SECRET;
  if (!secret || !providedSignature) return false;

  const expected = keccak256(stringToBytes(JSON.stringify(payload) + secret));
  const expectedBytes = Buffer.from(normalizeHex(expected), "hex");
  const providedBytes = Buffer.from(normalizeHex(providedSignature), "hex");

  if (expectedBytes.length !== providedBytes.length) return false;
  return timingSafeEqual(expectedBytes, providedBytes);
}

export async function registerMoralisEvmAddress(address: string): Promise<{
  ok: boolean;
  skipped?: boolean;
  status?: number;
  error?: string;
}> {
  const apiKey = process.env.MORALIS_API_KEY;
  const streamId = process.env.MORALIS_EVM_STREAM_ID;
  if (!apiKey || !streamId) return { ok: false, skipped: true, error: "moralis_not_configured" };

  try {
    const res = await fetch(`${MORALIS_STREAMS_API}/streams/evm/${streamId}/address`, {
      method:  "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key":    apiKey,
      },
      body:   JSON.stringify({ address }),
      signal: AbortSignal.timeout(10000),
    });

    if (res.ok) return { ok: true, status: res.status };

    const text = await res.text().catch(() => "");
    const alreadyAdded = res.status === 400 && /already|duplicate|exist/i.test(text);
    if (alreadyAdded) return { ok: true, skipped: true, status: res.status };
    return { ok: false, status: res.status, error: text.slice(0, 500) || res.statusText };
  } catch (error) {
    return {
      ok:    false,
      error: error instanceof Error ? error.message : "moralis_register_failed",
    };
  }
}
