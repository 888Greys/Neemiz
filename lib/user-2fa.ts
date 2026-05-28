/**
 * User-facing TOTP helpers.
 * TOTP logic (generateTotpSecret / verifyTotp / totpUri) is re-exported
 * from lib/admin-2fa.ts — it's the same RFC 6238 implementation.
 *
 * This file adds the user session-cookie functions using a separate
 * namespace so user tokens can never be confused with admin tokens.
 */
export { generateTotpSecret, verifyTotp, totpUri } from "@/lib/admin-2fa";

import { createHmac, timingSafeEqual } from "crypto";

export const USER_2FA_COOKIE = "__nezeem_u2fa";
const TTL_MS = 8 * 60 * 60 * 1000; // 8 hours

function secret(): string {
  // Prefer a dedicated USER_2FA_SECRET; fall back to ADMIN_2FA_SECRET (different namespace)
  const s = process.env.USER_2FA_SECRET ?? process.env.ADMIN_2FA_SECRET;
  if (!s) throw new Error("USER_2FA_SECRET (or ADMIN_2FA_SECRET) env var not set");
  return `user_totp:${s}`;
}

function sign(data: string): string {
  return createHmac("sha256", secret()).update(data).digest("base64url");
}

/** Create a signed session token to store in the HttpOnly cookie */
export function createUserTotpToken(userId: string): string {
  const expiry = Date.now() + TTL_MS;
  const payload = `${userId}|${expiry}`;
  return `${payload}|${sign(payload)}`;
}

/** Returns userId if the token is valid and not expired; null otherwise */
export function verifyUserTotpToken(token: string): string | null {
  if (!token) return null;
  const parts = token.split("|");
  if (parts.length !== 3) return null;
  const [userId, expiryStr, sig] = parts;
  if (!userId || !expiryStr || !sig) return null;
  if (Date.now() > Number(expiryStr)) return null;
  const payload = `${userId}|${expiryStr}`;
  const expected = sign(payload);
  try {
    if (sig.length !== expected.length) return null;
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  } catch { return null; }
  return userId;
}
