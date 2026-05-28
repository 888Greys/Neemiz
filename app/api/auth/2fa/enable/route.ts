/**
 * POST /api/auth/2fa/enable
 * Body: { secret: string; code: string }
 * Validates the TOTP code, then saves the secret to the DB and sets
 * totp_enabled=true in Supabase user metadata so the middleware can
 * enforce 2FA on the next login.
 */
import { createClient }    from "@/lib/supabase/server";
import { db }               from "@/lib/db";
import { getOrCreateUser }  from "@/lib/get-or-create-user";
import { verifyTotp, createUserTotpToken, USER_2FA_COOKIE } from "@/lib/user-2fa";
import { cookies }          from "next/headers";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let body: { secret?: string; code?: string };
  try { body = await req.json(); } catch { return Response.json({ error: "Invalid body" }, { status: 400 }); }

  const { secret, code } = body;
  if (!secret || !code) return Response.json({ error: "secret and code are required" }, { status: 400 });

  if (!verifyTotp(secret, code)) {
    return Response.json({ error: "Invalid code — check the time on your device and try again." }, { status: 422 });
  }

  // Save to DB
  const dbUser = await getOrCreateUser(user.id, { email: user.email });
  await db.user.update({
    where: { id: dbUser.id },
    data:  { totpSecret: secret, totpEnabled: true },
  });

  // Update Supabase user metadata so middleware can check without a DB call
  await supabase.auth.updateUser({
    data: { totp_enabled: true },
  });

  // Issue a verified session cookie so the user isn't immediately re-challenged
  const token = createUserTotpToken(user.id);
  const jar   = await cookies();
  jar.set(USER_2FA_COOKIE, token, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === "production",
    sameSite: "strict",
    path:     "/",
    maxAge:   8 * 60 * 60,
  });

  return Response.json({ ok: true });
}
