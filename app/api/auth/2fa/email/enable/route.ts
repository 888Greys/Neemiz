/**
 * POST /api/auth/2fa/email/enable
 * Body: { code: string }
 * Confirms the emailed OTP and turns on email-based 2FA for the account.
 * Sets totp_enabled metadata so middleware gates login the same way as app TOTP.
 */
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/get-or-create-user";
import { createUserTotpToken, USER_2FA_COOKIE } from "@/lib/user-2fa";
import { verifyEmailOtp, EMAIL_OTP_COOKIE } from "@/lib/email-2fa";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!user.email) {
    return Response.json({ error: "Add an email to your account first." }, { status: 400 });
  }

  let body: { code?: string };
  try { body = await req.json(); } catch { return Response.json({ error: "Invalid body" }, { status: 400 }); }
  const code = (body.code ?? "").replace(/\D/g, "");
  if (code.length !== 6) return Response.json({ error: "Enter the 6-digit email code" }, { status: 400 });

  const jar = await cookies();
  const challenge = jar.get(EMAIL_OTP_COOKIE)?.value;
  if (!verifyEmailOtp(challenge, user.id, code)) {
    return Response.json({ error: "Invalid or expired code. Request a new one." }, { status: 422 });
  }
  jar.delete(EMAIL_OTP_COOKIE);

  const dbUser = await getOrCreateUser(user.id, { email: user.email });
  await db.user.update({
    where: { id: dbUser.id },
    data: { emailOtpEnabled: true, totpEnabled: true },
  });

  await supabase.auth.updateUser({ data: { totp_enabled: true, email_otp_enabled: true } });

  const token = createUserTotpToken(user.id);
  jar.set(USER_2FA_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 8 * 60 * 60,
  });

  return Response.json({ ok: true });
}
