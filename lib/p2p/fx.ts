// ─── FX rates for P2P multi-currency aggregation ──────────────────────────────
// Converts any supported fiat into KES (the platform base) so mixed-currency
// listings can be summed into one honest total. Live rates come from the free
// open.er-api.com feed (covers KES, NGN, GHS, ZAR, TZS, UGX, USD, EUR, GBP, INR)
// and are cached by Next's data cache for an hour. If the provider is
// unreachable we fall back to a rough static table so the UI degrades instead
// of breaking — flagged via `live: false` so callers can label it.

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

// Last-known-good rates are persisted to SystemSetting so a provider outage
// falls back to the full recent (~160-currency) snapshot instead of the tiny
// static table below. Without this, ~135 active in-app coins would have no rate
// during an outage and every order-creation / backing check for them would
// refuse (NO_FX_RATE), stranding those markets.
const FX_CACHE_KEY = "p2p_fx_last_good";
const FX_PERSIST_INTERVAL_MS = 55 * 60_000; // ~hourly — matches the fetch revalidate

// db is imported dynamically so this module stays safe to import from client
// components that only use the pure convert helpers below.
async function readLastGoodRates(): Promise<{ toKES: Record<string, number>; ageMs: number } | null> {
  try {
    const { db } = await import("@/lib/db");
    const row = await db.systemSetting.findUnique({ where: { key: FX_CACHE_KEY } });
    if (!row) return null;
    const parsed = JSON.parse(row.value) as { toKES?: Record<string, number> };
    if (!parsed?.toKES || typeof parsed.toKES !== "object") return null;
    return { toKES: parsed.toKES, ageMs: Date.now() - new Date(row.updatedAt).getTime() };
  } catch {
    return null;
  }
}

async function saveLastGoodRates(toKES: Record<string, number>): Promise<void> {
  try {
    const { db } = await import("@/lib/db");
    const value = JSON.stringify({ toKES });
    await db.systemSetting.upsert({
      where:  { key: FX_CACHE_KEY },
      update: { value },
      create: { key: FX_CACHE_KEY, value },
    });
  } catch {
    /* best-effort cache; never block a rate lookup on it */
  }
}

export async function getFxRatesToKES(): Promise<FxRates> {
  const lastGood = await readLastGoodRates();

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
    // Pass through EVERY currency the provider returns (~160) so the display
    // layer can localize to any world currency. The curated P2P FIAT_CURRENCIES
    // list is unaffected (it governs the P2P UI, not this rate map).
    for (const [code, perKes] of Object.entries(data.rates)) {
      if (typeof perKes === "number" && perKes > 0) {
        toKES[code] = 1 / perKes;          // → KES per 1 <code>
      }
    }
    // Backstop core currencies if the provider omitted any.
    for (const [code, v] of Object.entries(FALLBACK_KES_PER_UNIT)) {
      if (!(code in toKES)) toKES[code] = v;
    }
    // Refresh the persisted snapshot at most ~hourly so we don't hammer the row
    // on every call (this runs even on fetch cache hits).
    if (!lastGood || lastGood.ageMs > FX_PERSIST_INTERVAL_MS) {
      await saveLastGoodRates(toKES);
    }
    return {
      base: "KES",
      toKES,
      asOf: data.time_last_update_utc ?? new Date().toISOString(),
      live: true,
    };
  } catch {
    // Provider down: prefer the full last-known-good snapshot, backstopped by the
    // static table for anything it lacks (or if we've never fetched live yet).
    const toKES = { ...FALLBACK_KES_PER_UNIT, ...(lastGood?.toKES ?? {}) };
    return { base: "KES", toKES, asOf: new Date().toISOString(), live: false };
  }
}

export function convertToKES(amount: number, currency: string, toKES: Record<string, number>): number {
  const rate = toKES[currency];
  if (!rate || rate <= 0) {
    throw new Error("NO_FX_RATE");
  }
  return amount * rate;
}
