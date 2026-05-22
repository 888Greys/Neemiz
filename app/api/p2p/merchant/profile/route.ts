import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/get-or-create-user";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await getOrCreateUser(user.id, { email: user.email });

  const merchant = await db.merchantProfile.findUnique({
    where: { userId: dbUser.id },
    include: {
      ads: { where: { isActive: true }, select: { id: true } },
    },
  });

  if (!merchant) {
    return Response.json({ isMerchant: false });
  }

  return Response.json({
    isMerchant:      true,
    kycStatus:       merchant.kycStatus,
    isOnline:        merchant.isOnline,
    displayName:     merchant.displayName,
    completedTrades: merchant.completedTrades,
    completionRate:  Number(merchant.completionRate),
    activeAds:       merchant.ads.length,
  });
}
