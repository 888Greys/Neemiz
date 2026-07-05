/**
 * DELETE /api/auth/passkey/[id]
 * Authed. Removes one of the current user's sign-in passkeys.
 */
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await db.user.findUnique({ where: { supabaseId: user.id } });
  if (!dbUser) return Response.json({ error: "Unauthorized" }, { status: 401 });

  // Scope the delete to the owner so one user can't remove another's passkey.
  const result = await db.passkey.deleteMany({ where: { id, userId: dbUser.id } });
  if (result.count === 0) return Response.json({ error: "Passkey not found." }, { status: 404 });

  return Response.json({ ok: true });
}
