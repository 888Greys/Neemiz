import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { verifyTotp, createAdminToken, COOKIE_NAME, ADMIN_EMAIL_OTP_COOKIE } from "@/lib/admin-2fa";
import { verifyEmailOtp } from "@/lib/email-2fa";
import { isOwnerEmail } from "@/lib/admin-allowlist";
import { rateLimit, clientIp, tooManyRequests } from "@/lib/rate-limit";

export async function POST(req: Request) {
  // Throttle TOTP guesses hard: a 6-digit code is only ~10^6 wide and the
  // verify window accepts ±1 step, so unbounded attempts are brute-forceable.
  const rl = await rateLimit(`a2fa-verify:${clientIp(req)}`, 10, 5 * 60_000);
  if (!rl.ok) return tooManyRequests(rl.retryAfterSec);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  // Defense-in-depth: admin access requires an allowlisted owner email, not
  // just is_admin (which lives in the DB an attacker can write). See
  // lib/admin-allowlist.ts.
  if (!isOwnerEmail(user.email)) return Response.json({ error: "Forbidden" }, { status: 403 });

  const dbUser = await db.user.findUnique({
    where: { supabaseId: user.id },
    select: { id: true, isAdmin: true, totpSecret: true, totpEnabled: true },
  });
  if (!dbUser?.isAdmin) return Response.json({ error: "Forbidden" }, { status: 403 });

  let body: { code: string };
  try   { body = await req.json(); }
  catch { return Response.json({ error: "Invalid request" }, { status: 400 }); }

  const { code } = body;
  if (!code || typeof code !== "string") {
    return Response.json({ error: "Code required" }, { status: 400 });
  }

  // Two ways to clear 2FA: the authenticator app (TOTP), or an emailed one-time
  // code (fallback when the authenticator isn't available). Either is sufficient.
  const emailCookie = (await cookies()).get(ADMIN_EMAIL_OTP_COOKIE)?.value;
  const emailOk = verifyEmailOtp(emailCookie, dbUser.id, code.trim());
  const totpOk  = !emailOk && !!dbUser.totpSecret && verifyTotp(dbUser.totpSecret, code);

  if (!emailOk && !totpOk) {
    if (!dbUser.totpSecret && !emailCookie) {
      return Response.json({ error: "2FA not set up" }, { status: 400 });
    }
    return Response.json({ error: "Invalid or expired code" }, { status: 401 });
  }

  // First-time authenticator setup: mark as enabled (only on the TOTP path).
  if (totpOk && !dbUser.totpEnabled) {
    await db.user.update({ where: { id: dbUser.id }, data: { totpEnabled: true } });
  }

  const token = createAdminToken(dbUser.id);
  const secure = process.env.NODE_ENV === "production" ? "Secure" : "";

  const headers = new Headers({ "Content-Type": "application/json" });
  // Issue the admin session and burn the one-time email challenge.
  headers.append("Set-Cookie", [`${COOKIE_NAME}=${token}`, "Path=/", "HttpOnly", "SameSite=Strict", secure, "Max-Age=28800"].filter(Boolean).join("; "));
  headers.append("Set-Cookie", [`${ADMIN_EMAIL_OTP_COOKIE}=`, "Path=/", "HttpOnly", "SameSite=Strict", secure, "Max-Age=0"].filter(Boolean).join("; "));

  return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
}
