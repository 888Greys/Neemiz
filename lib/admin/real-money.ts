/**
 * Provider lists + KES valuation for admin cashflow (Money / Cockpit / Profits).
 *
 * Live rails in production today are primarily Lipa Haraka (M-Pesa) and on-chain
 * crypto. Older mega/relworx/pesapal rows stay in the fiat lists so history still
 * counts. Crypto ledger amounts are NOT KES — convert via CoinGecko spot (or FX
 * for stablecoins) before folding into KES KPIs.
 */

import { getFxRatesToKES } from "@/lib/p2p/fx";
import { getSpotRate } from "@/lib/p2p/spot";

/** Fiat wallet deposits that credit the KES cash balance. */
export const ADMIN_FIAT_DEPOSIT_PROVIDERS = [
  "lipaharaka",
  "megapay",
  "pesapal",
  "relworx",
] as const;

/** Fiat wallet payouts that leave the KES cash balance. */
export const ADMIN_FIAT_WITHDRAWAL_PROVIDERS = [
  "lipaharaka",
  "megapay",
  "relworx",
] as const;

/** On-chain deposits into user crypto balances. */
export const ADMIN_CRYPTO_DEPOSIT_PROVIDERS = ["crypto"] as const;

/** On-chain / crypto-desk payouts leaving user crypto or selling to KES. */
export const ADMIN_CRYPTO_WITHDRAWAL_PROVIDERS = ["self_custody", "crypto_sell"] as const;

export type MoneyTx = {
  amount: unknown;
  currency: string;
  provider: string | null;
  createdAt: Date;
};

/** KES value of 1 unit of `currency` (crypto spot or fiat FX). Cached per call. */
export async function buildKesRateTable(currencies: string[]): Promise<Record<string, number>> {
  const rates: Record<string, number> = { KES: 1 };
  const needed = [...new Set(currencies.map((c) => c.toUpperCase()).filter((c) => c && c !== "KES"))];
  if (needed.length === 0) return rates;

  const fx = await getFxRatesToKES();
  await Promise.all(
    needed.map(async (code) => {
      // Prefer live crypto→KES spot (USDT/BTC/ETH/…).
      const spot = await getSpotRate(code, "kes");
      if (spot != null && spot > 0) {
        rates[code] = spot;
        return;
      }
      // Fiat / stablecoin via USD (USDT tracks USD).
      const rateCode = code === "USDT" ? "USD" : code;
      const kesPerUnit = fx.toKES[rateCode];
      if (typeof kesPerUnit === "number" && kesPerUnit > 0) {
        rates[code] = kesPerUnit;
        return;
      }
      // Last resort: treat as already-KES so a missing rate doesn't zero the row out.
      rates[code] = 1;
    }),
  );
  return rates;
}

export function kesAmount(amount: unknown, currency: string, rates: Record<string, number>): number {
  const n = Number(amount);
  if (!Number.isFinite(n)) return 0;
  const code = (currency || "KES").toUpperCase();
  if (code === "KES") return n;
  const per = rates[code];
  return Number.isFinite(per) && per > 0 ? n * per : n;
}

/** Fold fiat + crypto deposit/withdrawal rows into KES totals and provider buckets. */
export function accumulateMoneyFlow(
  depositTx: MoneyTx[],
  withdrawalTx: MoneyTx[],
  rates: Record<string, number>,
  dayKey: (d: Date) => string,
  series: Record<string, { date: string; deposits: number; withdrawals: number; net: number }>,
) {
  const depByProvider: Record<string, { amount: number; count: number }> = {};
  const wdByProvider: Record<string, { amount: number; count: number }> = {};
  let totalDeposits = 0;
  let totalWithdrawals = 0;

  for (const t of depositTx) {
    const amt = kesAmount(t.amount, t.currency, rates);
    totalDeposits += amt;
    const k = dayKey(t.createdAt);
    if (series[k]) {
      series[k].deposits += amt;
      series[k].net += amt;
    }
    const p = t.provider ?? "unknown";
    (depByProvider[p] ??= { amount: 0, count: 0 }).amount += amt;
    depByProvider[p].count += 1;
  }

  for (const t of withdrawalTx) {
    const amt = kesAmount(t.amount, t.currency, rates);
    totalWithdrawals += amt;
    const k = dayKey(t.createdAt);
    if (series[k]) {
      series[k].withdrawals += amt;
      series[k].net -= amt;
    }
    const p = t.provider ?? "unknown";
    (wdByProvider[p] ??= { amount: 0, count: 0 }).amount += amt;
    wdByProvider[p].count += 1;
  }

  return { totalDeposits, totalWithdrawals, depByProvider, wdByProvider };
}
