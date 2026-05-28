/**
 * POST /api/auth/2fa/disable
 * Body: { code: string }
 * Verifies the current TOTP code, then clears totpSecret/totpEnabled
 * from the DB and removes the Supabase metadata flag.
 */
import { createClient }  from "@/lib/supabase/server";
import { db }             from "@/lib/db";
import { getOrCreateUser } from "@/lib/get-or-create-user";
import { verifyTotp, USER_2FA_COOKIE } from "@/lib/user-2fa";
import { cookies }        from "next/headers";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let body: { code?: string };
  try { body = await req.json(); } catch { return Response.json({ error: "Invalid body" }, { status: 400 }); }

  const { code } = body;
  if (!code) return Response.json({ error: "code is required" }, { status: 400 });

  const dbUser = await getOrCreateUser(user.id, { email: user.email });
  if (!dbUser.totpEnabled || !dbUser.totpSecret) {
    return Response.json({ error: "2FA is not enabled on this account" }, { status: 400 });
  }

  if (!verifyTotp(dbUser.totpSecret, code)) {
    return Response.json({ error: "Invalid code — check the time on your device and try again." }, { status: 422 });
  }

  // Clear from DB
  await db.user.update({
    where: { id: dbUser.id },
    data:  { totpSecret: null, totpEnabled: false },
  });

  // Clear Supabase metadata flag
  await supabase.auth.updateUser({
    data: { totp_enabled: false },
  });

  // Remove the verified session cookie
  const jar = await cookies();
  jar.delete(USER_2FA_COOKIE);

  return Response.json({ ok: true });
}
