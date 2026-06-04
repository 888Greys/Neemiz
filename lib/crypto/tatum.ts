import { createHmac, timingSafeEqual } from "crypto";

const TATUM_API = "https://api.tatum.io";

function getWebhookUrl(): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? "https://www.nezeem.com";
  return new URL("/api/webhooks/tatum", baseUrl).toString();
}

function tatumChainForNetwork(network: string): string | null {
  if (network === "BITCOIN") return "BTC";
  if (network === "TRC20") return "TRON";
  return null;
}

function tatumSubscriptionTypesForNetwork(network: string): string[] {
  if (network === "BITCOIN") return ["INCOMING_NATIVE_TX"];
  if (network === "TRC20") return ["INCOMING_NATIVE_TX", "INCOMING_FUNGIBLE_TX"];
  return [];
}

export function isTatumDepositNetwork(network: string): boolean {
  return tatumChainForNetwork(network) !== null;
}

export function isTatumWebhookSecretConfigured(): boolean {
  return Boolean(process.env.TATUM_WEBHOOK_SECRET);
}

export function verifyTatumPayload(payload: unknown, providedHash: string | null): boolean {
  const secret = process.env.TATUM_WEBHOOK_SECRET;
  if (!secret || !providedHash) return false;

  const expected = createHmac("sha512", secret)
    .update(JSON.stringify(payload))
    .digest("base64");

  const expectedBytes = Buffer.from(expected);
  const providedBytes = Buffer.from(providedHash);
  if (expectedBytes.length !== providedBytes.length) return false;

  return timingSafeEqual(expectedBytes, providedBytes);
}

export async function registerTatumAddress(address: string, network: string): Promise<{
  ok: boolean;
  skipped?: boolean;
  status?: number;
  id?: string;
  error?: string;
}> {
  const apiKey = process.env.TATUM_API_KEY;
  const chain = tatumChainForNetwork(network);
  const subscriptionTypes = tatumSubscriptionTypesForNetwork(network);
  if (!apiKey || !chain) return { ok: false, skipped: true, error: "tatum_not_configured" };

  try {
    let created = 0;
    let duplicate = 0;
    const errors: string[] = [];

    for (const subscriptionType of subscriptionTypes) {
      const attr: Record<string, unknown> = {
        chain,
        address,
        url: getWebhookUrl(),
      };
      if (chain === "TRON") attr.finality = "confirmed";

      const res = await fetch(`${TATUM_API}/v4/subscription?type=mainnet`, {
        method:  "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key":    apiKey,
        },
        body: JSON.stringify({
          type: subscriptionType,
          attr,
        }),
        signal: AbortSignal.timeout(10000),
      });

      if (res.ok) {
        created++;
        continue;
      }

      const text = await res.text().catch(() => "");
      const alreadyAdded = [400, 403].includes(res.status) && /already|duplicate|exist|unique/i.test(text);
      if (alreadyAdded) {
        duplicate++;
        continue;
      }

      errors.push(`${subscriptionType}: ${text.slice(0, 300) || res.statusText}`);
    }

    if (errors.length > 0) return { ok: false, error: errors.join("; ") };
    return { ok: true, skipped: created === 0 && duplicate > 0 };
  } catch (error) {
    return {
      ok:    false,
      error: error instanceof Error ? error.message : "tatum_register_failed",
    };
  }
}
