/**
 * Binary + Forex play in USD (display), ledger stays KES.
 * Min stake / margin is $1, converted via live FX (fallback ~129 KES).
 */
import { getFxRatesToKES } from "@/lib/p2p/fx";
import { convertToKes } from "@/lib/currency-config";

export const PLAY_CURRENCY = "USD";
export const MIN_PLAY_USD = 1;
/** Soft ceiling for binary-suite stakes in USD (ledger still KES). */
export const MAX_PLAY_USD = 500;
export const FALLBACK_USD_KES = 129;

export function usdToKesWithRates(amountUsd: number, toKES: Record<string, number>): number {
  const n = Number.isFinite(amountUsd) ? amountUsd : 0;
  const kes = convertToKes(n, "USD", { ...toKES, USD: toKES.USD ?? FALLBACK_USD_KES });
  return Math.max(1, Math.ceil(kes));
}

export async function minPlayStakeKes(): Promise<number> {
  const fx = await getFxRatesToKES();
  return usdToKesWithRates(MIN_PLAY_USD, fx.toKES);
}

export async function maxPlayStakeKes(): Promise<number> {
  const fx = await getFxRatesToKES();
  return usdToKesWithRates(MAX_PLAY_USD, fx.toKES);
}
