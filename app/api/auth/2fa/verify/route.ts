/**
 * POST /api/auth/2fa/verify
 * Body: { code: string }
 * Called from the /2fa gate page after the user enters their authenticator
 * or email OTP code. Sets the __nezeem_u2fa session cookie on success.
 */
import { createClient }  from "@/lib/supabase/server";
import { getOrCreateUser } from "@/lib/get-or-create-user";
import { verifyTotp, createUserTotpToken, USER_2FA_COOKIE } from "@/lib/user-2fa";
import { verifyEmailOtp, EMAIL_OTP_COOKIE } from "@/lib/email-2fa";
import { cookies }       from "next/headers";

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
    // 2FA not actually enabled — just let them through
    return Response.json({ ok: true });
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

  const token = createUserTotpToken(user.id);
  jar.set(USER_2FA_COOKIE, token, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === "production",
    sameSite: "strict",
    path:     "/",
    maxAge:   8 * 60 * 60,
  });

  return Response.json({ ok: true });
}
