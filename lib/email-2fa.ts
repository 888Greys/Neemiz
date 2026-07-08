/**
 * Email OTP challenge for user 2FA (alternative to authenticator-app TOTP).
 * Codes are 6 digits, HMAC-bound into an HttpOnly cookie, 10-minute TTL.
 */
import { createHash, createHmac, randomInt, timingSafeEqual } from "crypto";

export const EMAIL_OTP_COOKIE = "__nezeem_email_otp";
const TTL_MS = 10 * 60 * 1000;

function secret(): string {
  const s = process.env.USER_2FA_SECRET ?? process.env.ADMIN_2FA_SECRET ?? process.env.STEPUP_SECRET;
  if (!s) throw new Error("USER_2FA_SECRET (or ADMIN_2FA_SECRET) env var not set");
  return `email_otp:${s}`;
}

function sign(data: string): string {
  return createHmac("sha256", secret()).update(data).digest("base64url");
}

function hashCode(code: string): string {
  return createHash("sha256").update(`nezeem-email-otp:${code}`).digest("hex");
}

/** Mint a 6-digit code + cookie value for `userId`. */
export function mintEmailOtp(userId: string): { code: string; cookieValue: string; maxAgeSec: number } {
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const expiry = Date.now() + TTL_MS;
  const payload = `${userId}|${expiry}|${hashCode(code)}`;
  return {
    code,
    cookieValue: `${payload}|${sign(payload)}`,
    maxAgeSec: Math.floor(TTL_MS / 1000),
  };
}

/** True iff `cookieValue` holds a valid, unexpired challenge for `userId` + `code`. */
export function verifyEmailOtp(cookieValue: string | undefined, userId: string, code: string): boolean {
  if (!cookieValue || !code || !/^\d{6}$/.test(code)) return false;
  const parts = cookieValue.split("|");
  if (parts.length !== 4) return false;
  const [uid, expiryStr, codeHash, sig] = parts;
  if (!uid || !expiryStr || !codeHash || !sig) return false;
  if (uid !== userId) return false;
  if (Date.now() > Number(expiryStr)) return false;
  const payload = `${uid}|${expiryStr}|${codeHash}`;
  const expected = sign(payload);
  try {
    if (sig.length !== expected.length) return false;
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return false;
  } catch {
    return false;
  }
  const want = hashCode(code);
  try {
    if (codeHash.length !== want.length) return false;
    return timingSafeEqual(Buffer.from(codeHash), Buffer.from(want));
  } catch {
    return false;
  }
}

export const emailOtpCookieOptions = (maxAgeSec: number) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  path: "/",
  maxAge: maxAgeSec,
});
