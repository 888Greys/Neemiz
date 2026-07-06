import { db } from "@/lib/db";

/**
 * Per-bet-type kill switch. Lets us disable individual exploitable game modes
 * (e.g. binary Even/Odd, directional Touch/No-Touch) without taking the whole
 * game offline, and flip them back on after a pricing fix — no deploy needed.
 *
 * Tokens are `${game}:${type}`, e.g. "binary:Odd", "directional:TOUCH_NO_TOUCH".
 * The live set is the DB flag `system_settings.disabled_bet_types` (a
 * comma-separated list) when present, else the DEFAULT_DISABLED baseline below.
 * Set the DB flag to an empty string to re-enable everything.
 */
const DEFAULT_DISABLED = new Set([
  // Binary: players win a positive edge here (Even/Odd win >50%; Matches
  // over-pays). Over/Under/Differs are house-favorable and stay live.
  "binary:Odd", "binary:Even", "binary:Matches",
  // Directional: Touch/No-Touch far-barrier + Higher/Lower deep-ITM +
  // Rise/Fall are player-favorable. Vanilla stays live.
  "directional:TOUCH_NO_TOUCH", "directional:HIGHER_LOWER", "directional:RISE_FALL",
  // Accumulator: whole game pays a +363% player edge — disable entirely.
  "accumulator:ALL",
]);

const CACHE_TTL_MS = 10_000;
let cache: { set: Set<string>; expires: number } | null = null;

export async function disabledBetTypes(): Promise<Set<string>> {
  if (cache && cache.expires > Date.now()) return cache.set;
  let set = new Set(DEFAULT_DISABLED);
  try {
    const row = await db.systemSetting.findUnique({
      where: { key: "disabled_bet_types" },
      select: { value: true },
    });
    if (row?.value != null) {
      set = new Set(row.value.split(",").map((s) => s.trim()).filter(Boolean));
    }
  } catch {
    // Table/flag missing — fall back to the baseline set.
  }
  cache = { set, expires: Date.now() + CACHE_TTL_MS };
  return set;
}

export async function isBetTypeDisabled(game: string, type: string): Promise<boolean> {
  return (await disabledBetTypes()).has(`${game}:${type}`);
}

/**
 * Whole-suite maintenance switch for the binary-options product (the /binary
 * page and every contract it sells: digits, directional, accumulators,
 * multipliers/turbos, vanillas, auto-trader). Used while the pricing spine is
 * rebuilt so the entire product is offline behind one professional maintenance
 * screen — not a half-working game.
 *
 * Defaults to ON (offline) so a deploy alone takes it down. Re-enable WITHOUT a
 * deploy by inserting/updating the `system_settings` row
 * `binary_options_maintenance` to `off` (also accepts `0`/`false`/`disabled`).
 * Any other value — or the row being absent — keeps it in maintenance.
 */
const BINARY_MAINTENANCE_DEFAULT = true;
const MAINTENANCE_OFF = new Set(["off", "0", "false", "no", "disabled"]);

export const BINARY_MAINTENANCE_MESSAGE =
  "Binary is temporarily offline for scheduled maintenance while we upgrade the platform. Your balance is safe and every other market stays open.";

let maintCache: { on: boolean; expires: number } | null = null;

export async function isBinaryOptionsInMaintenance(): Promise<boolean> {
  if (maintCache && maintCache.expires > Date.now()) return maintCache.on;
  let on = BINARY_MAINTENANCE_DEFAULT;
  try {
    const row = await db.systemSetting.findUnique({
      where: { key: "binary_options_maintenance" },
      select: { value: true },
    });
    if (row?.value != null) on = !MAINTENANCE_OFF.has(row.value.trim().toLowerCase());
  } catch {
    // Table/flag missing — fall back to the default (offline).
  }
  maintCache = { on, expires: Date.now() + CACHE_TTL_MS };
  return on;
}

/**
 * Per-family re-enable allowlist for the binary-options rebuild. While the
 * suite is in maintenance, specific families that have been rebuilt on the
 * engine-priced path can be brought back one at a time WITHOUT lifting the whole
 * maintenance switch. Tokens are `${game}:${type}`, e.g. "directional:RISE_FALL".
 *
 * Source: `system_settings.binary_live_families` (comma-separated). Defaults to
 * EMPTY — nothing is live until an owner explicitly adds a token, so the product
 * stays fully offline by default even as the wiring lands.
 */
let liveCache: { set: Set<string>; expires: number } | null = null;

export async function binaryLiveFamilies(): Promise<Set<string>> {
  if (liveCache && liveCache.expires > Date.now()) return liveCache.set;
  let set = new Set<string>();
  try {
    const row = await db.systemSetting.findUnique({
      where: { key: "binary_live_families" },
      select: { value: true },
    });
    if (row?.value) set = new Set(row.value.split(",").map((s) => s.trim()).filter(Boolean));
  } catch {
    // Table/flag missing — nothing live.
  }
  liveCache = { set, expires: Date.now() + CACHE_TTL_MS };
  return set;
}

export async function isBinaryFamilyLive(game: string, type: string): Promise<boolean> {
  return (await binaryLiveFamilies()).has(`${game}:${type}`);
}

/**
 * Should a specific binary contract be served? True when the suite is not in
 * maintenance, OR the specific family has been explicitly re-enabled. Callers
 * that get `false` return the maintenance 503.
 */
export async function isBinaryContractServable(game: string, type: string): Promise<boolean> {
  if (!(await isBinaryOptionsInMaintenance())) return true;
  return isBinaryFamilyLive(game, type);
}
