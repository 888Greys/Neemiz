import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/get-or-create-user";
import { isSupportedCurrency } from "@/lib/currency-config";

export const dynamic = "force-dynamic";

/** GET — the signed-in user's saved display currency (or null). */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ code: null });
  const dbUser = await getOrCreateUser(user.id, { email: user.email });
  return Response.json({ code: dbUser.displayCurrency ?? null }, { headers: { "Cache-Control": "no-store" } });
}

/** POST { code } — persist the user's display currency to their account. */
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let body: { code?: string };
  try { body = await req.json(); } catch { return Response.json({ error: "Invalid body" }, { status: 400 }); }

  const code = body.code;
  if (!isSupportedCurrency(code)) return Response.json({ error: "Unsupported currency" }, { status: 400 });

  const dbUser = await getOrCreateUser(user.id, { email: user.email });
  await db.user.update({ where: { id: dbUser.id }, data: { displayCurrency: code } });
  return Response.json({ ok: true, code });
}
