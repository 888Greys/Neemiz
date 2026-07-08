/**
 * POST /api/auth/2fa/email/send
 * Sends a 6-digit email OTP to the signed-in user's email and stores the
 * challenge in an HttpOnly cookie. Used for login challenges when email OTP
 * 2FA is enabled, and for enabling email OTP from Security settings.
 */
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateUser } from "@/lib/get-or-create-user";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { sendEmailOtpCode } from "@/lib/brevo";
import { mintEmailOtp, EMAIL_OTP_COOKIE, emailOtpCookieOptions } from "@/lib/email-2fa";

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!user.email) {
    return Response.json({ error: "Add an email to your account before enabling email authentication." }, { status: 400 });
  }

  const rl = rateLimit(`email-otp:${user.id}`, 3, 60_000);
  if (!rl.ok) return tooManyRequests(rl.retryAfterSec);

  const dbUser = await getOrCreateUser(user.id, { email: user.email });
  const { code, cookieValue, maxAgeSec } = mintEmailOtp(user.id);

  try {
    await sendEmailOtpCode(user.email, dbUser.firstName ?? "", code);
  } catch (err) {
    console.error("POST /api/auth/2fa/email/send:", err);
    return Response.json({ error: "Could not send the email code. Try again." }, { status: 502 });
  }

  const jar = await cookies();
  jar.set(EMAIL_OTP_COOKIE, cookieValue, emailOtpCookieOptions(maxAgeSec));

  return Response.json({
    ok: true,
    maskedEmail: user.email.replace(/(.{2}).+(@.+)/, "$1***$2"),
  });
}
