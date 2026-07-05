/**
 * GET /api/auth/passkey
 * Authed. Lists the current user's passwordless sign-in passkeys.
 */
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await db.user.findUnique({ where: { supabaseId: user.id } });
  if (!dbUser) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const passkeys = await db.passkey.findMany({
    where: { userId: dbUser.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, deviceName: true, createdAt: true, lastUsedAt: true },
  });

  return Response.json({ passkeys });
}
