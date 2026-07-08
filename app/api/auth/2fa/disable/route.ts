/**
 * POST /api/auth/2fa/disable
 * Body: { code: string }
 * Verifies the current authenticator or email OTP code, then clears 2FA
 * from the DB and removes the Supabase metadata flag.
 */
import { createClient }  from "@/lib/supabase/server";
import { db }             from "@/lib/db";
import { getOrCreateUser } from "@/lib/get-or-create-user";
import { verifyTotp, USER_2FA_COOKIE } from "@/lib/user-2fa";
import { verifyEmailOtp, EMAIL_OTP_COOKIE } from "@/lib/email-2fa";
import { cookies }        from "next/headers";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let body: { code?: string };
  try { body = await req.json(); } catch { return Response.json({ error: "Invalid body" }, { status: 400 }); }

  const code = (body.code ?? "").replace(/\D/g, "");
  if (!code) return Response.json({ error: "code is required" }, { status: 400 });

  const dbUser = await getOrCreateUser(user.id, { email: user.email });
  if (!dbUser.totpEnabled) {
    return Response.json({ error: "2FA is not enabled on this account" }, { status: 400 });
  }

  const jar = await cookies();
  let ok = false;
  if (dbUser.totpSecret && verifyTotp(dbUser.totpSecret, code)) {
    ok = true;
  } else if (dbUser.emailOtpEnabled) {
    const challenge = jar.get(EMAIL_OTP_COOKIE)?.value;
    if (verifyEmailOtp(challenge, user.id, code)) {
      ok = true;
      jar.delete(EMAIL_OTP_COOKIE);
    }
  }

  if (!ok) {
    return Response.json({ error: "Invalid code — check and try again." }, { status: 422 });
  }

  await db.user.update({
    where: { id: dbUser.id },
    data:  { totpSecret: null, totpEnabled: false, emailOtpEnabled: false },
  });

  await supabase.auth.updateUser({
    data: { totp_enabled: false, email_otp_enabled: false },
  });

  jar.delete(USER_2FA_COOKIE);

  return Response.json({ ok: true });
}
