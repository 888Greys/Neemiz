import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/get-or-create-user";

export async function PATCH(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let body: { username?: string };
  try { body = await req.json(); } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { username } = body;
  if (!username) return Response.json({ error: "Username is required" }, { status: 400 });
  if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
    return Response.json(
      { error: "Username must be 3–20 characters: letters, numbers, underscore only" },
      { status: 400 },
    );
  }

  const taken = await db.user.findFirst({ where: { username, NOT: { supabaseId: user.id } } });
  if (taken) return Response.json({ error: "Username already taken" }, { status: 409 });

  const dbUser = await getOrCreateUser(user.id, { email: user.email });

  try {
    await db.user.update({ where: { id: dbUser.id }, data: { username } });
    await supabase.auth.updateUser({ data: { username } });
    return Response.json({ username });
  } catch (err) {
    console.error("PATCH /api/profile:", err instanceof Error ? err.message : err);
    return Response.json({ error: "Failed to update username" }, { status: 500 });
  }
}
