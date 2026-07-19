import { db } from "@/lib/db";

/**
 * Per-bet-type kill switch. Lets us disable individual exploitable game modes
 * (e.g. binary Even/Odd, directional Touch/No-Touch) without taking the whole
 * game offline, and flip them back on after a pricing fix — no deploy needed.
 *
 * Tokens are `${game}:${type}`, e.g. "binary:Odd", "directional:TOUCH_NO_TOUCH".
 * The live set is the DB flag `system_settings.disabled_bet_types` (a
 * comma-separated list) when present, else the DEFAULT_DISABLED baseline below.
 *
 * Ops — clear a prod override (DB wins over DEFAULT_DISABLED when the row exists):
 *   UPDATE system_settings SET value = '' WHERE key = 'disabled_bet_types';
 *   -- or DELETE FROM system_settings WHERE key = 'disabled_bet_types';
 * There is no admin UI for this flag; RTP guard may re-write it via disableBetType().
 * Cache TTL is 10s, so a clear takes effect within ~10s without restart.
 */
const DEFAULT_DISABLED = new Set<string>([
  // Intentionally empty after house-safe reopen: digit/directional engine path
  // + Acca barrier haircut/50% retention + rtp-guard (incl. accumulator:ALL).
  // R_50 Under remains market-quarantined in lib/binary/quarantine.ts (not a
  // family kill-switch). Kill any token via disabled_bet_types if it bleeds.
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
 * Auto-halt lever: add `${game}:${type}` to the live disabled set and persist it.
 * Merges with the currently-effective set (so the baseline defaults aren't lost)
 * and clears the cache so the block takes effect immediately. Used by the
 * runtime RTP guard to pull an exploitable contract kind offline without a deploy.
 */
export async function disableBetType(game: string, type: string): Promise<void> {
  const token = `${game}:${type}`;
  const current = await disabledBetTypes();
  if (current.has(token)) return;
  current.add(token);
  const value = Array.from(current).join(",");
  await db.systemSetting.upsert({
    where: { key: "disabled_bet_types" },
    update: { value },
    create: { key: "disabled_bet_types", value },
  });
  cache = null; // force re-read on next check
}

/**
 * Trade-type ids the Binary UI may offer right now: every catalogue type whose
 * primary token is not kill-switched via `disabled_bet_types`.
 */
export async function bettableBinaryTradeTypeIds(
  allIds: string[],
  tokenById: Record<string, string>,
): Promise<string[]> {
  const disabled = await disabledBetTypes();
  return allIds.filter((id) => {
    const token = tokenById[id] ?? "";
    if (!token) return false;
    return !disabled.has(token);
  });
}
