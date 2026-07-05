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
