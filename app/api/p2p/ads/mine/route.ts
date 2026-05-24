import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/get-or-create-user";
import { validateP2PAd } from "@/lib/p2p/ad-guards";

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

  return Response.json(ads.map((ad) => {
    const pricePerUnit = Number(ad.pricePerUnit);
    const totalAmount = Number(ad.totalAmount);
    const availableAmount = Number(ad.availableAmount);
    const minLimit = Number(ad.minLimit);
    const maxLimit = Number(ad.maxLimit);

    return {
      id:              ad.id,
      side:            ad.side,
      crypto:          ad.crypto,
      fiat:            ad.fiat,
      pricePerUnit,
      totalAmount,
      availableAmount,
      minLimit,
      maxLimit,
      paymentMethods:  ad.paymentMethods,
      paymentWindow:   ad.paymentWindow,
      isActive:        ad.isActive,
      createdAt:       ad.createdAt,
      validationError: validateP2PAd({ crypto: ad.crypto, pricePerUnit, totalAmount, availableAmount, minLimit, maxLimit }),
    };
  }));
}
