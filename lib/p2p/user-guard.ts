import { db } from "@/lib/db";

/**
 * Per-user P2P block. Lets an owner disable ALL P2P money actions (buy orders,
 * express trades, posting ads, merchant funding/cash-out) for a specific account
 * without a deploy — e.g. an admin who asked to have their own P2P turned off.
 *
 * Source: `system_settings.p2p_blocked_users` — a comma-separated list of
 * emails. Empty/absent = nobody blocked. 10s cache.
 */
export const P2P_BLOCKED_KEY = "p2p_blocked_users";

const CACHE_TTL_MS = 10_000;
let cache: { set: Set<string>; expires: number } | null = null;

/**
 * Drop the cached list so the next read hits the DB. Called by the admin route
 * after a change, so the toggle is felt immediately in THIS process. Other
 * cluster workers (WEB_CONCURRENCY) keep their own cache and converge within
 * CACHE_TTL_MS — a block is never more than 10s from taking effect everywhere.
 */
export function invalidateP2pBlockedCache() {
  cache = null;
}

/** Parse the stored comma-separated list into normalised emails. */
export function parseP2pBlockedList(value: string | null | undefined): string[] {
  if (!value) return [];
  return [...new Set(value.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean))];
}

export async function p2pBlockedEmails(): Promise<Set<string>> {
  if (cache && cache.expires > Date.now()) return cache.set;
  let set = new Set<string>();
  try {
    const row = await db.systemSetting.findUnique({
      where: { key: P2P_BLOCKED_KEY },
      select: { value: true },
    });
    if (row?.value) set = new Set(parseP2pBlockedList(row.value));
  } catch {
    // Table/flag missing — nobody blocked.
  }
  cache = { set, expires: Date.now() + CACHE_TTL_MS };
  return set;
}

export async function isP2pBlocked(email: string | null | undefined): Promise<boolean> {
  if (!email) return false;
  return (await p2pBlockedEmails()).has(email.trim().toLowerCase());
}

/** Returns a 403 Response if the user's P2P is disabled, else null. */
export async function p2pBlockedResponse(email: string | null | undefined): Promise<Response | null> {
  if (await isP2pBlocked(email)) {
    return Response.json({ error: "P2P trading is disabled for this account." }, { status: 403 });
  }
  return null;
}
