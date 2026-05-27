import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { verifyTotp, COOKIE_NAME } from "@/lib/admin-2fa";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await db.user.findUnique({
    where: { supabaseId: user.id },
    select: { id: true, isAdmin: true, totpSecret: true, totpEnabled: true },
  });
  if (!dbUser?.isAdmin)   return Response.json({ error: "Forbidden" }, { status: 403 });
  if (!dbUser.totpEnabled) return Response.json({ error: "2FA not enabled" }, { status: 400 });

  let body: { code: string };
  try   { body = await req.json(); }
  catch { return Response.json({ error: "Invalid request" }, { status: 400 }); }

  if (!verifyTotp(dbUser.totpSecret!, body.code)) {
    return Response.json({ error: "Invalid code" }, { status: 401 });
  }

  await db.user.update({
    where: { id: dbUser.id },
    data: { totpEnabled: false, totpSecret: null },
  });

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`,
    },
  });
}
