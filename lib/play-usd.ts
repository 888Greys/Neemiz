/**
 * Binary + Forex play in USD (display), ledger stays KES.
 * Min stake / margin is $1, converted via live FX (fallback ~129 KES).
 *
 * Conversion is 2dp-stable: for common play amounts, converting USD→KES→USD
 * does not drift by a cent (the old Math.ceil path turned $10 into $10.01).
 */
import { getFxRatesToKES } from "@/lib/p2p/fx";

export const PLAY_CURRENCY = "USD";
export const MIN_PLAY_USD = 1;
/** Soft ceiling for binary-suite stakes in USD (ledger still KES). */
export const MAX_PLAY_USD = 500;
export const FALLBACK_USD_KES = 129;

function usdRate(toKES: Record<string, number>): number {
  const rate = toKES.USD ?? FALLBACK_USD_KES;
  return rate > 0 ? rate : FALLBACK_USD_KES;
}

/**
 * Display KES as play USD snapped to cents (stable with `usdToKesWithRates`).
 */
export function kesToPlayUsd(amountKes: number, toKES: Record<string, number>): number {
  const n = Number.isFinite(amountKes) ? amountKes : 0;
  return Math.round((n / usdRate(toKES)) * 100) / 100;
}

/**
 * Convert a play-USD amount to integer KES for the ledger.
 * Picks the nearest KES whose cent-rounded USD display equals the input, so
 * typing `10` commits and re-displays as `10` (not `10.01`).
 */
export function usdToKesWithRates(amountUsd: number, toKES: Record<string, number>): number {
  const rate = usdRate(toKES);
  const usd = Math.round((Number.isFinite(amountUsd) ? amountUsd : 0) * 100) / 100;
  if (usd <= 0) return 1;

  const targetCents = Math.round(usd * 100);
  let kes = Math.round(usd * rate);
  // Float edges: nudge until KES → USD cents matches the typed amount.
  for (let i = 0; i < 8; i++) {
    const shownCents = Math.round((kes / rate) * 100);
    if (shownCents === targetCents) break;
    kes += shownCents < targetCents ? 1 : -1;
  }
  return Math.max(1, kes);
}

/**
 * Accept stakes that land 1 KSh under the $1 floor (FX / client disagreement).
 * Returns the stake to debit, or null if out of range.
 */
export function normalizePlayStakeKes(stake: number, minKes: number, maxKes: number): number | null {
  if (!Number.isFinite(stake)) return null;
  let s = stake;
  if (s >= minKes - 1 && s < minKes) s = minKes;
  if (s < minKes || s > maxKes) return null;
  return s;
}

export async function minPlayStakeKes(): Promise<number> {
  const fx = await getFxRatesToKES();
  return usdToKesWithRates(MIN_PLAY_USD, fx.toKES);
}

export async function maxPlayStakeKes(): Promise<number> {
  const fx = await getFxRatesToKES();
  return usdToKesWithRates(MAX_PLAY_USD, fx.toKES);
}
