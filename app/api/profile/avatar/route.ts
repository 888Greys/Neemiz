import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/get-or-create-user";

export async function PATCH(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let body: { imageUrl?: string };
  try { body = await req.json(); } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const imageUrl = body.imageUrl?.trim();
  if (!imageUrl || !/^https:\/\//i.test(imageUrl)) {
    return Response.json({ error: "Valid image URL is required" }, { status: 400 });
  }

  const dbUser = await getOrCreateUser(user.id, {
    email: user.email,
    phone: user.phone,
    imageUrl,
  });
  await db.user.update({ where: { id: dbUser.id }, data: { imageUrl } });

  return Response.json({ imageUrl });
}
