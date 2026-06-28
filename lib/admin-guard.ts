import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { cookies } from "next/headers";
import { verifyAdminToken, COOKIE_NAME } from "@/lib/admin-2fa";
import { isOwnerEmail } from "@/lib/admin-allowlist";

// ─── Single source of truth for admin authorization ──────────────────────────
// Every admin route must clear ALL of these, in order:
//   1. authenticated Supabase user
//   2. email on the owner allowlist (env-config, NOT the DB) — see
//      lib/admin-allowlist.ts. This is the gate that survives an attacker
//      flipping `is_admin` directly in the database.
//   3. `is_admin` set in the DB
//   4. a valid, unexpired admin 2FA cookie (HMAC-bound to ADMIN_2FA_SECRET)
//
// Returns the internal user id on success, or null. Centralizing this prevents
// the checks from drifting apart across the ~20 admin routes.
export async function requireOwnerAdmin(): Promise<string | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  if (!isOwnerEmail(user.email)) return null;

  const dbUser = await db.user.findUnique({
    where: { supabaseId: user.id },
    select: { id: true, isAdmin: true },
  });
  if (!dbUser?.isAdmin) return null;

  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token || !verifyAdminToken(token)) return null;

  return dbUser.id;
}
