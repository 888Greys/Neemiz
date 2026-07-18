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

/**
 * Restrict who a user may P2P with. JSON map of email → allowed counterparty
 * emails, e.g. `{"goodhope229@gmail.com":["ombuioira@gmail.com"]}`.
 * Restricted users may ONLY open orders with those counterparts (both directions:
 * as buyer or as merchant). Unlisted users are unrestricted.
 */
export const P2P_PAIR_ALLOWLIST_KEY = "p2p_pair_allowlist";

const CACHE_TTL_MS = 10_000;
let cache: { set: Set<string>; expires: number } | null = null;
let pairCache: { map: Map<string, Set<string>>; expires: number } | null = null;

/**
 * Drop the cached list so the next read hits the DB. Called by the admin route
 * after a change, so the toggle is felt immediately in THIS process. Other
 * cluster workers (WEB_CONCURRENCY) keep their own cache and converge within
 * CACHE_TTL_MS — a block is never more than 10s from taking effect everywhere.
 */
export function invalidateP2pBlockedCache() {
  cache = null;
  pairCache = null;
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

function parsePairAllowlist(raw: string | null | undefined): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  if (!raw?.trim()) return map;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    for (const [email, list] of Object.entries(parsed)) {
      const key = email.trim().toLowerCase();
      if (!key) continue;
      const allowed = Array.isArray(list)
        ? list.map((e) => String(e).trim().toLowerCase()).filter(Boolean)
        : [];
      map.set(key, new Set(allowed));
    }
  } catch {
    // Bad JSON — treat as empty (fail open for everyone else).
  }
  return map;
}

export async function p2pPairAllowlist(): Promise<Map<string, Set<string>>> {
  if (pairCache && pairCache.expires > Date.now()) return pairCache.map;
  let map = new Map<string, Set<string>>();
  try {
    const row = await db.systemSetting.findUnique({
      where: { key: P2P_PAIR_ALLOWLIST_KEY },
      select: { value: true },
    });
    map = parsePairAllowlist(row?.value);
  } catch {
    // ignore
  }
  pairCache = { map, expires: Date.now() + CACHE_TTL_MS };
  return map;
}

/** True if this pair is allowed under the counterparty allowlist. */
export async function isP2pPairAllowed(
  emailA: string | null | undefined,
  emailB: string | null | undefined,
): Promise<boolean> {
  const a = emailA?.trim().toLowerCase();
  const b = emailB?.trim().toLowerCase();
  if (!a || !b || a === b) return false;
  const allow = await p2pPairAllowlist();
  if (allow.has(a) && !allow.get(a)!.has(b)) return false;
  if (allow.has(b) && !allow.get(b)!.has(a)) return false;
  return true;
}

/** 403 if either party is restricted and the other is not on their allowlist. */
export async function p2pPairDeniedResponse(
  emailA: string | null | undefined,
  emailB: string | null | undefined,
): Promise<Response | null> {
  if (await isP2pPairAllowed(emailA, emailB)) return null;
  const a = emailA?.trim().toLowerCase();
  const b = emailB?.trim().toLowerCase();
  if (!a || !b) return null;
  const allow = await p2pPairAllowlist();
  if (!allow.has(a) && !allow.has(b)) return null;
  return Response.json(
    { error: "P2P trading for this account is limited to an approved counterparty." },
    { status: 403 },
  );
}

/** Allowed counterparty emails for a restricted user, or null if unrestricted. */
export async function p2pAllowedCounterparties(
  email: string | null | undefined,
): Promise<Set<string> | null> {
  if (!email) return null;
  const allow = await p2pPairAllowlist();
  const key = email.trim().toLowerCase();
  return allow.has(key) ? allow.get(key)! : null;
}
