import { createHmac, randomBytes, timingSafeEqual } from "crypto";

// ─── TOTP (RFC 6238) — no external dependency ────────────────────────────────

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function b32Decode(s: string): Buffer {
  const str = s.replace(/=+$/, "").toUpperCase();
  let bits = 0, value = 0;
  const bytes: number[] = [];
  for (const ch of str) {
    const idx = B32.indexOf(ch);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) { bytes.push((value >>> (bits - 8)) & 0xff); bits -= 8; }
  }
  return Buffer.from(bytes);
}

function b32Encode(buf: Buffer): string {
  let bits = 0, value = 0, out = "";
  for (let i = 0; i < buf.length; i++) {
    value = (value << 8) | buf[i];
    bits += 8;
    while (bits >= 5) { out += B32[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

function hotp(secret: string, counter: number): string {
  const key = b32Decode(secret);
  const buf = Buffer.allocUnsafe(8);
  let c = counter;
  for (let i = 7; i >= 0; i--) { buf[i] = c & 0xff; c = Math.floor(c / 256); }
  const hmac = createHmac("sha1", key).update(buf).digest();
  const off = hmac[19] & 0x0f;
  const code = (((hmac[off] & 0x7f) << 24) | (hmac[off + 1] << 16) | (hmac[off + 2] << 8) | hmac[off + 3]) % 1_000_000;
  return String(code).padStart(6, "0");
}

export function generateTotpSecret(): string {
  return b32Encode(randomBytes(20));
}

export function verifyTotp(secret: string, token: string): boolean {
  const counter = Math.floor(Date.now() / 1000 / 30);
  for (const drift of [-1, 0, 1]) {
    if (hotp(secret, counter + drift) === token.trim()) return true;
  }
  return false;
}

export function totpUri(secret: string, email: string, issuer = "Nezeem Admin"): string {
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(email)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}

// ─── Admin session cookie ─────────────────────────────────────────────────────

const COOKIE_NAME = "__nezeem_a2fa";
const TTL_MS = 8 * 60 * 60 * 1000; // 8 hours

function cookieSecret(): string {
  const s = process.env.ADMIN_2FA_SECRET;
  if (!s) throw new Error("ADMIN_2FA_SECRET env var not set");
  return s;
}

function hmacSign(data: string): string {
  return createHmac("sha256", cookieSecret()).update(data).digest("base64url");
}

export function createAdminToken(userId: string): string {
  const expiry = Date.now() + TTL_MS;
  const payload = `${userId}|${expiry}`;
  return `${payload}|${hmacSign(payload)}`;
}

export function verifyAdminToken(token: string): string | null {
  const parts = token.split("|");
  if (parts.length !== 3) return null;
  const [userId, expiryStr, sig] = parts;
  if (!userId || !expiryStr || !sig) return null;
  if (Date.now() > Number(expiryStr)) return null;
  const payload = `${userId}|${expiryStr}`;
  const expected = hmacSign(payload);
  // Constant-time compare
  try {
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  } catch {
    return null;
  }
  return userId;
}

export { COOKIE_NAME };
