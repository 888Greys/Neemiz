import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/get-or-create-user";
import { getTotalKesReservedForMerchant } from "@/lib/p2p/ad-backing";

// GET /api/p2p/ads/backing — how much of the merchant's KES wallet is already
// committed to backing their ACTIVE sell ads (KES + local coins), and therefore
// how much is still FREE to back a new sell ad. This is the single source of
// truth the create-ad form uses to size the max sellable amount, so the amount
// it offers can't be rejected by the server's backing check at submit time.
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await getOrCreateUser(user.id, { email: user.email });
  const walletKes = Number(dbUser.walletBalance ?? 0);

  const merchant = await db.merchantProfile.findUnique({
    where: { userId: dbUser.id },
    select: { id: true },
  });
  if (!merchant) return Response.json({ walletKes, reservedKes: 0, freeKes: walletKes });

  let reservedKes = 0;
  try {
    reservedKes = await getTotalKesReservedForMerchant(dbUser.id, merchant.id);
  } catch {
    // FX rate unavailable (NO_FX_RATE) etc. — don't block the form; report 0
    // reserved so the client falls back to the wallet total and the server's
    // own backing check remains the final gate.
    reservedKes = 0;
  }

  const freeKes = Math.max(0, parseFloat((walletKes - reservedKes).toFixed(2)));
  return Response.json({ walletKes, reservedKes, freeKes });
}
