// ─── FX rates for P2P multi-currency aggregation ──────────────────────────────
// Converts any supported fiat into KES (the platform base) so mixed-currency
// listings can be summed into one honest total. Live rates come from the free
// open.er-api.com feed (covers KES, NGN, GHS, ZAR, TZS, UGX, USD, EUR, GBP, INR)
// and are cached by Next's data cache for an hour. If the provider is
// unreachable we fall back to a rough static table so the UI degrades instead
// of breaking — flagged via `live: false` so callers can label it.

import { FIAT_CURRENCIES } from "./currencies";

// KES per 1 unit of currency. Rough fallback only — refreshed live in normal use.
const FALLBACK_KES_PER_UNIT: Record<string, number> = {
  KES: 1,
  USD: 129,
  EUR: 140,
  GBP: 164,
  NGN: 0.084,
  GHS: 8.6,
  ZAR: 7.1,
  TZS: 0.049,
  UGX: 0.034,
  INR: 1.5,
};

export interface FxRates {
  base: "KES";
  toKES: Record<string, number>; // KES value of 1 unit of each currency code
  asOf: string;
  live: boolean;
}

export async function getFxRatesToKES(): Promise<FxRates> {
  try {
    // open.er-api.com returns rates as "units of <code> per 1 KES"
    const res = await fetch("https://open.er-api.com/v6/latest/KES", { next: { revalidate: 3600 } });
    if (!res.ok) throw new Error(`FX provider ${res.status}`);
    const data = await res.json() as {
      result?: string;
      rates?: Record<string, number>;
      time_last_update_utc?: string;
    };
    if (data.result !== "success" || !data.rates) throw new Error("FX provider bad payload");

    const toKES: Record<string, number> = { KES: 1 };
    for (const c of FIAT_CURRENCIES) {
      const perKes = data.rates[c.code]; // <code> per 1 KES
      if (typeof perKes === "number" && perKes > 0) {
        toKES[c.code] = 1 / perKes;       // → KES per 1 <code>
      } else if (FALLBACK_KES_PER_UNIT[c.code]) {
        toKES[c.code] = FALLBACK_KES_PER_UNIT[c.code];
      }
    }
    return {
      base: "KES",
      toKES,
      asOf: data.time_last_update_utc ?? new Date().toISOString(),
      live: true,
    };
  } catch {
    return { base: "KES", toKES: { ...FALLBACK_KES_PER_UNIT }, asOf: new Date().toISOString(), live: false };
  }
}

export function convertToKES(amount: number, currency: string, toKES: Record<string, number>): number {
  const rate = toKES[currency] ?? 1;
  return amount * rate;
}
