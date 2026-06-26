import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { verifyTotp, createAdminToken, COOKIE_NAME } from "@/lib/admin-2fa";
import { isOwnerEmail } from "@/lib/admin-allowlist";

export async function POST(req: Request) {
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
  if (!dbUser.totpSecret)  return Response.json({ error: "2FA not set up" }, { status: 400 });

  let body: { code: string };
  try   { body = await req.json(); }
  catch { return Response.json({ error: "Invalid request" }, { status: 400 }); }

  const { code } = body;
  if (!code || typeof code !== "string") {
    return Response.json({ error: "Code required" }, { status: 400 });
  }

  if (!verifyTotp(dbUser.totpSecret, code)) {
    return Response.json({ error: "Invalid or expired code" }, { status: 401 });
  }

  // First-time setup: mark as enabled
  if (!dbUser.totpEnabled) {
    await db.user.update({ where: { id: dbUser.id }, data: { totpEnabled: true } });
  }

  const token = createAdminToken(dbUser.id);

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": [
        `${COOKIE_NAME}=${token}`,
        "Path=/",
        "HttpOnly",
        "SameSite=Strict",
        process.env.NODE_ENV === "production" ? "Secure" : "",
        "Max-Age=28800",
      ].filter(Boolean).join("; "),
    },
  });
}
