import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/get-or-create-user";

// GET /api/p2p/ads/mine — merchant's own ads
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await getOrCreateUser(user.id, { email: user.email });
  const merchant = await db.merchantProfile.findUnique({ where: { userId: dbUser.id } });
  if (!merchant) return Response.json([], { status: 200 });

  const ads = await db.p2PAd.findMany({
    where: { merchantId: merchant.id },
    orderBy: { createdAt: "desc" },
  });

  return Response.json(ads.map((ad) => ({
    id:              ad.id,
    side:            ad.side,
    crypto:          ad.crypto,
    fiat:            ad.fiat,
    pricePerUnit:    Number(ad.pricePerUnit),
    totalAmount:     Number(ad.totalAmount),
    availableAmount: Number(ad.availableAmount),
    minLimit:        Number(ad.minLimit),
    maxLimit:        Number(ad.maxLimit),
    paymentMethods:  ad.paymentMethods,
    paymentWindow:   ad.paymentWindow,
    isActive:        ad.isActive,
    createdAt:       ad.createdAt,
  })));
}
