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

  // Locked-for-life: once a withdrawal number is set it is bound to the account
  // permanently. Changing it to a DIFFERENT number is refused (SIM swap / mule
  // rerouting needs support/admin). Admins are exempt so they can test payouts
  // to arbitrary numbers without support tickets.
  if (dbUser.phone && !dbUser.isAdmin) {
    return Response.json(
      { error: "Your withdrawal number is locked and can't be changed. Contact support to update it." },
      { status: 409 },
    );
  }

  try {
    await db.user.update({ where: { id: dbUser.id }, data: { phone } });
  } catch (err) {
    // Unique constraint — the number is linked to a different account.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      // Admins may still withdraw to that number (withdraw route doesn't re-bind);
      // just don't steal another account's phone row.
      if (dbUser.isAdmin) return Response.json({ phone: dbUser.phone, unbound: true });
      return Response.json({ error: "This mobile number is already registered." }, { status: 409 });
    }
    throw err;
  }
  return Response.json({ phone });
}
