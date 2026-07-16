import { createClient } from "@/lib/supabase/server";
import { getOrCreateUser } from "@/lib/get-or-create-user";

// GET /api/p2p/ads/backing — how much of the merchant's KES wallet is already
// committed to backing their ACTIVE sell ads (KES + local coins), and therefore
// how much is still FREE to back a new sell ad. Under the shared balance pool
// model, ads are not pre-backed, so reservedKes is always 0.
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await getOrCreateUser(user.id, { email: user.email });
  const walletKes = Number(dbUser.walletBalance ?? 0);

  return Response.json({ walletKes, reservedKes: 0, freeKes: walletKes });
}
