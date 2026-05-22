import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/get-or-create-user";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await getOrCreateUser(user.id, { email: user.email });

  let body: { isOnline: boolean };
  try   { body = await req.json(); }
  catch { return Response.json({ error: "Invalid body" }, { status: 400 }); }

  const merchant = await db.merchantProfile.findUnique({
    where: { userId: dbUser.id },
  });
  if (!merchant) return Response.json({ error: "Not a merchant" }, { status: 404 });

  await db.merchantProfile.update({
    where: { userId: dbUser.id },
    data:  { isOnline: body.isOnline },
  });

  return Response.json({ ok: true, isOnline: body.isOnline });
}
