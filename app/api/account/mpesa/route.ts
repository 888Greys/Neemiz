import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/get-or-create-user";
import { normalizeKenyanPhone } from "@/lib/lipaharaka";
import { Prisma } from "@prisma/client";

export const runtime = "nodejs";

/**
 * The user's saved M-Pesa number — used to prefill deposit and withdrawal.
 * Stored on User.phone (unique, so a number maps to one account).
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const dbUser = await getOrCreateUser(user.id, { email: user.email });
  return Response.json({ phone: dbUser.phone ?? null });
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null) as { phone?: string } | null;
  const phone = normalizeKenyanPhone(String(body?.phone ?? ""));
  if (!/^254[17]\d{8}$/.test(phone)) {
    return Response.json({ error: "Enter a valid Safaricom number (07XX or 01XX)." }, { status: 400 });
  }

  const dbUser = await getOrCreateUser(user.id, { email: user.email });
  if (dbUser.phone === phone) return Response.json({ phone });

  try {
    await db.user.update({ where: { id: dbUser.id }, data: { phone } });
  } catch (err) {
    // Unique constraint — the number is linked to a different account.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return Response.json({ error: "This M-Pesa number is already linked to another account." }, { status: 409 });
    }
    throw err;
  }
  return Response.json({ phone });
}
