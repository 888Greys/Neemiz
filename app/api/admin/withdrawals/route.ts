import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { verifyAdminToken, COOKIE_NAME } from "@/lib/admin-2fa";
import { cookies } from "next/headers";
import { TransactionStatus } from "@prisma/client";

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

export async function GET() {
  if (!await requireAdmin()) return Response.json({ error: "Forbidden" }, { status: 403 });

  const pending = await db.transaction.findMany({
    where: { type: "WITHDRAWAL", status: "PENDING_APPROVAL" as TransactionStatus },
    orderBy: { createdAt: "asc" },
    include: {
      user: { select: { id: true, email: true, username: true, phone: true } },
    },
  });

  return Response.json(pending);
}
