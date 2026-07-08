import { createHmac, randomBytes, timingSafeEqual } from "crypto";

/**
 * Withdrawal step-up proof.
 *
 * A short-lived, HMAC-signed cookie minted ONLY after the server itself has
 * verified the user's password or passkey (never the client). The withdraw API
 * requires and then consumes it, so a caller can't skip the "Confirm it's you"
 * check by POSTing straight to /api/wallet/withdraw.
 *
 * Bound to the Supabase user id + a 5-minute expiry. Stateless (no store), so it
 * is not hard single-use, but the withdraw route clears it on use and the TTL is
 * short; combined with httpOnly + SameSite=Strict this closes the bypass.
 */

export const STEPUP_COOKIE = "__nezeem_stepup";
const TTL_MS = 5 * 60 * 1000; // 5 minutes to go from confirm → withdraw

function secret(): string {
  const s = process.env.STEPUP_SECRET ?? process.env.ADMIN_2FA_SECRET;
  if (!s) throw new Error("STEPUP_SECRET/ADMIN_2FA_SECRET env var not set");
  return s;
}

function sign(data: string): string {
  return createHmac("sha256", secret()).update(data).digest("base64url");
}

/** Mint a step-up proof for `userId` (the Supabase auth user id). */
export function mintStepUpToken(userId: string): string {
  const exp = Date.now() + TTL_MS;
  const nonce = randomBytes(9).toString("base64url");
  const payload = `${userId}|${exp}|${nonce}`;
  return `${payload}|${sign(payload)}`;
}

/** True iff `token` is a valid, unexpired step-up proof for `userId`. */
export function verifyStepUpToken(token: string | undefined | null, userId: string): boolean {
  if (!token) return false;
  const parts = token.split("|");
  if (parts.length !== 4) return false;
  const [uid, expStr, nonce, sig] = parts;
  if (uid !== userId || !expStr || !nonce || !sig) return false;
  if (Date.now() > Number(expStr)) return false;
  const expected = sign(`${uid}|${expStr}|${nonce}`);
  try {
    return timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  } catch {
    return false;
  }
}

/** Standard cookie options for the step-up proof. */
export const stepUpCookieOptions = {
  httpOnly: true as const,
  secure: true as const,
  sameSite: "strict" as const,
  path: "/",
  maxAge: Math.floor(TTL_MS / 1000),
};
