/**
 * Client for the off-box signer service (signer/), reached ONLY over the
 * WireGuard tunnel to soi. The web app sends a withdrawal request; the signer
 * holds the seed, enforces its own caps, signs, broadcasts, and returns the
 * tx hash. The web app never sees a private key.
 *
 * Auth: HMAC-SHA256 over `${timestamp}.${body}` with a shared secret, plus a
 * timestamp the signer uses to reject replays. The secret + URL live in the web
 * env; neither can move funds without the signer also accepting the request.
 */
import { createHmac, randomUUID } from "crypto";

export interface SignWithdrawalInput {
  /** HD index of the user's deposit address (null only for pre-index legacy rows). */
  hdIndex: number | null;
  /** The user's deposit address the tokens currently sit on. */
  fromAddress: string;
  /** Destination external address. */
  to: string;
  crypto: string;
  network: string;
  amount: number;
  /** Stable per-withdrawal key so a retry never double-broadcasts. */
  idempotencyKey: string;
}

export interface BroadcastResult {
  txHash: string;
  network: string;
  explorer: string;
}

const SIGNER_TIMEOUT_MS = 120_000;

export function isSignerConfigured(): boolean {
  return Boolean(process.env.SIGNER_URL && process.env.SIGNER_HMAC_SECRET);
}

export async function signWithdrawal(input: SignWithdrawalInput): Promise<BroadcastResult> {
  const url    = process.env.SIGNER_URL;
  const secret = process.env.SIGNER_HMAC_SECRET;
  if (!url || !secret) throw new Error("Signer is not configured (SIGNER_URL / SIGNER_HMAC_SECRET)");

  const body = JSON.stringify({ ...input, idempotencyKey: input.idempotencyKey || randomUUID() });
  const ts   = Date.now().toString();
  const sig  = createHmac("sha256", secret).update(`${ts}.${body}`).digest("hex");

  let res: Response;
  try {
    res = await fetch(`${url.replace(/\/$/, "")}/sign-withdrawal`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Signer-Timestamp": ts,
        "X-Signer-Signature": sig,
      },
      body,
      signal: AbortSignal.timeout(SIGNER_TIMEOUT_MS),
    });
  } catch (err) {
    // Network/timeout: the signer never confirmed a broadcast, so the caller
    // can safely refund. (Idempotency key guards a later retry from double-pay.)
    throw new Error(`Signer unreachable: ${err instanceof Error ? err.message : "network error"}`);
  }

  const data = (await res.json().catch(() => ({}))) as Partial<BroadcastResult> & { ok?: boolean; error?: string };
  if (!res.ok || !data.ok || !data.txHash) {
    throw new Error(data.error ?? `Signer rejected withdrawal (HTTP ${res.status})`);
  }

  return { txHash: data.txHash, network: data.network ?? input.network, explorer: data.explorer ?? "" };
}
