import "server-only";
import { cookies, headers } from "next/headers";
import { getFxRatesToKES } from "@/lib/p2p/fx";
import { CURRENCY_COOKIE } from "@/lib/currency-context";
import { DEFAULT_CURRENCY, currencyForCountry, isSupportedCurrency } from "@/lib/currency-config";

/**
 * Resolve the display currency for the current request:
 *   1. explicit user choice  (display_currency cookie)
 *   2. geo guess             (Cloudflare CF-IPCountry header)
 *   3. platform default      (KES)
 * plus the live KES-conversion rates, ready to hand to <CurrencyProvider>.
 */
export async function resolveDisplayCurrency(): Promise<{ code: string; toKES: Record<string, number> }> {
  const [cookieStore, headerStore, rates] = await Promise.all([
    cookies(),
    headers(),
    getFxRatesToKES().catch(() => ({ toKES: { KES: 1 } as Record<string, number> })),
  ]);

  const chosen = cookieStore.get(CURRENCY_COOKIE)?.value;
  if (isSupportedCurrency(chosen)) {
    return { code: chosen!, toKES: rates.toKES };
  }

  const country = headerStore.get("cf-ipcountry"); // set by Cloudflare on every request
  const geoCode = currencyForCountry(country);
  return {
    code: isSupportedCurrency(geoCode) ? geoCode : DEFAULT_CURRENCY,
    toKES: rates.toKES,
  };
}
