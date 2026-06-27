import { db } from "@/lib/db";

// ─── Master money-out kill switches ───────────────────────────────────────────
// Levers to block money-out paths platform-wide for incident response. Two
// independent switches:
//
//   • WITHDRAWALS — blocks EVERY cash-out vector (fiat + crypto withdrawals AND
//     user-to-user transfers).
//   • TRANSFERS   — blocks only user-to-user transfers (KES wallet→wallet and
//     internal crypto). Disabled by DEFAULT: nezeem does not offer peer
//     transfers unless explicitly turned back on, since they're a laundering
//     route (hop funds to an accomplice who cashes out).
//
// Each switch can be flipped two ways:
//   1. Env var  — needs an app restart to take effect (process.env is read once
//      per request, but a redeploy/restart is needed to change it).
//   2. DB flag  — flippable instantly from the admin kill-switch endpoint with
//      NO restart (system_settings row). Honored alongside the env var.
//
// Added 2026-06-25 (withdrawals) after accounts withdrew balances they did not
// hold. Extended 2026-06-27 with the DB toggle + transfers switch after a
// destination-number mule pattern was spotted in the Lipa Haraka dashboard.

const WITHDRAWALS_KEY = "withdrawals_disabled";
const TRANSFERS_KEY   = "transfers_disabled";

// Per-process cache so we don't hit the DB on every request. Short TTL keeps
// incident-response propagation fast (≤ CACHE_TTL_MS across all workers).
const CACHE_TTL_MS = 10_000;
const cache = new Map<string, { value: string | null; expires: number }>();

async function readFlag(key: string): Promise<string | null> {
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.value;
  let value: string | null = null;
  try {
    const row = await db.systemSetting.findUnique({ where: { key }, select: { value: true } });
    value = row?.value ?? null;
  } catch {
    // Table missing (pre-migration) or DB blip — fall back to env only.
    value = null;
  }
  cache.set(key, { value, expires: Date.now() + CACHE_TTL_MS });
  return value;
}

/** Set a flag instantly (admin kill-switch endpoint). Clears the local cache. */
export async function setFlag(key: string, value: string): Promise<void> {
  await db.systemSetting.upsert({
    where:  { key },
    create: { key, value },
    update: { value },
  });
  cache.delete(key);
}

// ─── Withdrawals ──────────────────────────────────────────────────────────────

export async function withdrawalsDisabled(): Promise<boolean> {
  if (process.env.WITHDRAWALS_DISABLED === "true") return true;
  return (await readFlag(WITHDRAWALS_KEY)) === "true";
}

/** Returns a 503 Response when withdrawals are globally disabled, else null. */
export async function withdrawalsDisabledResponse(): Promise<Response | null> {
  if (!(await withdrawalsDisabled())) return null;
  return Response.json(
    { error: "Withdrawals are temporarily disabled while we complete a security review. Your balance is safe." },
    { status: 503 },
  );
}

export async function setWithdrawalsDisabled(disabled: boolean): Promise<void> {
  await setFlag(WITHDRAWALS_KEY, disabled ? "true" : "false");
}

// ─── Transfers (user-to-user) ─────────────────────────────────────────────────
// Disabled by DEFAULT. Only enabled when explicitly turned on via env
// (TRANSFERS_ENABLED=true) or the DB flag (transfers_disabled=false). A global
// withdrawals kill also blocks transfers.

export async function transfersDisabled(): Promise<boolean> {
  if (await withdrawalsDisabled()) return true;
  if (process.env.TRANSFERS_ENABLED === "true") return false;
  // DB flag explicitly "false" re-enables; anything else (incl. absent) = off.
  return (await readFlag(TRANSFERS_KEY)) !== "false";
}

/** Returns a 503 Response when user-to-user transfers are disabled, else null. */
export async function transfersDisabledResponse(): Promise<Response | null> {
  if (!(await transfersDisabled())) return null;
  return Response.json(
    { error: "Sending money to other users is currently disabled." },
    { status: 503 },
  );
}

export async function setTransfersDisabled(disabled: boolean): Promise<void> {
  await setFlag(TRANSFERS_KEY, disabled ? "true" : "false");
}
