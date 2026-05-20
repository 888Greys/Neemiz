import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/get-or-create-user";

// POST /api/p2p/orders — buyer takes an ad and creates an order
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await getOrCreateUser(user.id, { email: user.email });

  const body = await req.json();
  const { adId, cryptoAmount, paymentMethod } = body;

  if (!adId || !cryptoAmount || !paymentMethod) {
    return Response.json({ error: "Missing required fields" }, { status: 400 });
  }

  const ad = await db.p2PAd.findUnique({
    where: { id: adId },
    include: { merchant: true },
  });

  if (!ad || !ad.isActive) return Response.json({ error: "Ad not found or inactive" }, { status: 404 });
  if (ad.merchant.userId === dbUser.id) return Response.json({ error: "Cannot trade with yourself" }, { status: 400 });
  if (Number(ad.availableAmount) < Number(cryptoAmount)) {
    return Response.json({ error: "Insufficient ad liquidity" }, { status: 400 });
  }

  const fiatAmount = Number(cryptoAmount) * Number(ad.pricePerUnit);
  if (fiatAmount < Number(ad.minLimit) || fiatAmount > Number(ad.maxLimit)) {
    return Response.json({
      error: `Order must be between KSh ${ad.minLimit} and KSh ${ad.maxLimit}`,
    }, { status: 400 });
  }

  if (!ad.paymentMethods.includes(paymentMethod)) {
    return Response.json({ error: "Payment method not supported by this ad" }, { status: 400 });
  }

  // Create order + reduce available amount atomically
  const order = await db.$transaction(async (tx) => {
    await tx.p2PAd.update({
      where: { id: adId },
      data: { availableAmount: { decrement: Number(cryptoAmount) } },
    });

    return tx.p2POrder.create({
      data: {
        adId,
        buyerId:      dbUser.id,
        sellerId:     ad.merchantId,
        crypto:       ad.crypto,
        cryptoAmount: Number(cryptoAmount),
        fiatAmount,
        pricePerUnit: Number(ad.pricePerUnit),
        paymentMethod,
        expiresAt:    new Date(Date.now() + ad.paymentWindow * 60 * 1000),
      },
    });
  });

  return Response.json({ orderId: order.id }, { status: 201 });
}
