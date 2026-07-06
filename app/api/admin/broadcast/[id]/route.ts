import { isOwnerEmail } from "@/lib/admin-allowlist";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { verifyAdminToken, COOKIE_NAME } from "@/lib/admin-2fa";
import { cookies } from "next/headers";
import { updateBroadcast, deleteBroadcast, normalizeLevel } from "@/lib/broadcast";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireAdmin(): Promise<boolean> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  if (!isOwnerEmail(user.email)) return false;
  const dbUser = await db.user.findUnique({ where: { supabaseId: user.id }, select: { isAdmin: true } });
  if (!dbUser?.isAdmin) return false;
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  return Boolean(token && verifyAdminToken(token));
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  if (!(await requireAdmin())) return Response.json({ error: "Forbidden" }, { status: 403 });

  let body: { title?: string; message?: string; level?: string; isActive?: boolean; endsAt?: string | null };
  try { body = await req.json(); }
  catch { return Response.json({ error: "Invalid request body" }, { status: 400 }); }

  const fields: { title?: string; message?: string; level?: ReturnType<typeof normalizeLevel>; isActive?: boolean; endsAt?: Date | null } = {};
  if (typeof body.title === "string") {
    const t = body.title.trim();
    if (!t || t.length > 120) return Response.json({ error: "Title must be 1–120 chars" }, { status: 400 });
    fields.title = t;
  }
  if (typeof body.message === "string") {
    const m = body.message.trim();
    if (!m || m.length > 600) return Response.json({ error: "Message must be 1–600 chars" }, { status: 400 });
    fields.message = m;
  }
  if (body.level !== undefined) fields.level = normalizeLevel(body.level);
  if (typeof body.isActive === "boolean") fields.isActive = body.isActive;
  if (body.endsAt !== undefined) {
    if (body.endsAt === null) fields.endsAt = null;
    else {
      const d = new Date(body.endsAt);
      if (Number.isNaN(d.getTime())) return Response.json({ error: "Invalid end date" }, { status: 400 });
      fields.endsAt = d;
    }
  }

  const updated = await updateBroadcast(params.id, fields);
  if (!updated) return Response.json({ error: "Nothing to update or broadcast not found" }, { status: 400 });
  return Response.json(updated);
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  if (!(await requireAdmin())) return Response.json({ error: "Forbidden" }, { status: 403 });
  await deleteBroadcast(params.id);
  return Response.json({ ok: true });
}
