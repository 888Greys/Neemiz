import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/get-or-create-user";
import { normalizeUsername } from "@/lib/user-identity";
import { Prisma } from "@prisma/client";

export async function PATCH(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let body: { username?: string };
  try { body = await req.json(); } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const username = body.username ? normalizeUsername(body.username) : "";
  if (!username) return Response.json({ error: "Username is required" }, { status: 400 });
  if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
    return Response.json(
      { error: "Username must be 3–20 characters: letters, numbers, underscore only" },
      { status: 400 },
    );
  }

  const dbUser = await getOrCreateUser(user.id, { email: user.email });
  if (dbUser.usernameChangedAt) {
    return Response.json({ error: "Username can only be changed once" }, { status: 403 });
  }
  if (dbUser.username === username) {
    return Response.json({ error: "Choose a different username" }, { status: 400 });
  }

  try {
    await db.user.update({
      where: { id: dbUser.id },
      data: { username, usernameChangedAt: new Date() },
    });
    await supabase.auth.updateUser({ data: { username } });
    return Response.json({ username });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return Response.json({ error: "Username already taken" }, { status: 409 });
    }
    console.error("PATCH /api/profile:", err instanceof Error ? err.message : err);
    return Response.json({ error: "Failed to update username" }, { status: 500 });
  }
}
