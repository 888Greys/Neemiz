import { isOwnerEmail } from "@/lib/admin-allowlist";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { verifyAdminToken, COOKIE_NAME } from "@/lib/admin-2fa";
import { cookies } from "next/headers";
import { listBroadcasts, createBroadcast, normalizeLevel } from "@/lib/broadcast";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Returns the admin's db user id, or null if not an authenticated 2FA admin. */
async function requireAdmin(): Promise<string | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  if (!isOwnerEmail(user.email)) return null;
  const dbUser = await db.user.findUnique({ where: { supabaseId: user.id }, select: { id: true, isAdmin: true } });
  if (!dbUser?.isAdmin) return null;
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token || !verifyAdminToken(token)) return null;
  return dbUser.id;
}

export async function GET() {
  if (!(await requireAdmin())) return Response.json({ error: "Forbidden" }, { status: 403 });
  return Response.json(await listBroadcasts());
}

export async function POST(req: Request) {
  const adminId = await requireAdmin();
  if (!adminId) return Response.json({ error: "Forbidden" }, { status: 403 });

  let body: { title?: string; message?: string; level?: string; endsAt?: string | null };
  try { body = await req.json(); }
  catch { return Response.json({ error: "Invalid request body" }, { status: 400 }); }

  const title = (body.title ?? "").trim();
  const message = (body.message ?? "").trim();
  if (!title || title.length > 120) {
    return Response.json({ error: "Title is required (max 120 chars)" }, { status: 400 });
  }
  if (!message || message.length > 600) {
    return Response.json({ error: "Message is required (max 600 chars)" }, { status: 400 });
  }

  let endsAt: Date | null = null;
  if (body.endsAt) {
    const d = new Date(body.endsAt);
    if (Number.isNaN(d.getTime())) return Response.json({ error: "Invalid end date" }, { status: 400 });
    endsAt = d;
  }

  const broadcast = await createBroadcast({
    title,
    message,
    level: normalizeLevel(body.level),
    endsAt,
    createdBy: adminId,
  });
  return Response.json(broadcast, { status: 201 });
}
