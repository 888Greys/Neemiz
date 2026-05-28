import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { verifyAdminToken, COOKIE_NAME } from "@/lib/admin-2fa";
import { cookies } from "next/headers";

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const dbUser = await db.user.findUnique({ where: { supabaseId: user.id }, select: { isAdmin: true } });
  if (!dbUser?.isAdmin) return null;
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token || !verifyAdminToken(token)) return null;
  return true;
}

// PATCH /api/admin/users/[id]  { action: "suspend" | "unsuspend" }
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  if (!await requireAdmin()) return Response.json({ error: "Forbidden" }, { status: 403 });

  const { id } = params;
  let body: { action: string };
  try { body = await req.json(); } catch { return Response.json({ error: "Invalid body" }, { status: 400 }); }

  const isActive = body.action === "unsuspend";

  const target = await db.user.findUnique({ where: { id }, select: { isAdmin: true } });
  if (!target) return Response.json({ error: "User not found" }, { status: 404 });
  if (target.isAdmin) return Response.json({ error: "Cannot suspend an admin account" }, { status: 403 });

  const updated = await db.user.update({
    where: { id },
    data: { isActive },
    select: { id: true, email: true, isActive: true },
  });

  return Response.json(updated);
}
