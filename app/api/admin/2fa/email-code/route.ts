import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { isOwnerEmail } from "@/lib/admin-allowlist";
import { mintEmailOtp, emailOtpCookieOptions } from "@/lib/email-2fa";
import { ADMIN_EMAIL_OTP_COOKIE } from "@/lib/admin-2fa";
import { sendAdminLoginCodeEmail } from "@/lib/brevo";
import { rateLimit, clientIp, tooManyRequests } from "@/lib/rate-limit";

// POST /api/admin/2fa/email-code — emails a 6-digit login code to the owner as a
// fallback when the authenticator app isn't available. Only reachable by an
// authenticated, owner-allowlisted admin; the code is bound into an HttpOnly
// cookie (10-min TTL) and verified by /api/admin/2fa/verify.
export async function POST(req: Request) {
  // Throttle sends: a handful per window is plenty and stops email-bombing.
  const rl = await rateLimit(`a2fa-email:${clientIp(req)}`, 4, 10 * 60_000);
  if (!rl.ok) return tooManyRequests(rl.retryAfterSec);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!isOwnerEmail(user.email)) return Response.json({ error: "Forbidden" }, { status: 403 });

  const dbUser = await db.user.findUnique({
    where: { supabaseId: user.id },
    select: { id: true, isAdmin: true, email: true },
  });
  if (!dbUser?.isAdmin) return Response.json({ error: "Forbidden" }, { status: 403 });

  const to = user.email ?? dbUser.email;
  if (!to) return Response.json({ error: "No email on file for this admin." }, { status: 400 });

  const { code, cookieValue, maxAgeSec } = mintEmailOtp(dbUser.id);
  await sendAdminLoginCodeEmail(to, code);

  const opts = emailOtpCookieOptions(maxAgeSec);
  const cookie = [
    `${ADMIN_EMAIL_OTP_COOKIE}=${cookieValue}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Strict",
    opts.secure ? "Secure" : "",
    `Max-Age=${maxAgeSec}`,
  ].filter(Boolean).join("; ");

  // Mask the destination so a shoulder-surfer can't read the full address.
  const masked = to.replace(/^(.).*(.@.*)$/, (_m, a, b) => `${a}•••${b}`);
  return new Response(JSON.stringify({ ok: true, sentTo: masked }), {
    status: 200,
    headers: { "Content-Type": "application/json", "Set-Cookie": cookie },
  });
}
