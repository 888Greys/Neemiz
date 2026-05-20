import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/get-or-create-user";
import { AdSide } from "@prisma/client";

// GET /api/p2p/ads — browse ads
export async function GET(req: Request) {
  const url  = new URL(req.url);
  const side   = url.searchParams.get("side") as AdSide | null;
  const crypto = url.searchParams.get("crypto");
  const payment = url.searchParams.get("payment");

  const ads = await db.p2PAd.findMany({
    where: {
      isActive: true,
      ...(side   ? { side }   : {}),
      ...(crypto ? { crypto } : {}),
      ...(payment ? { paymentMethods: { has: payment } } : {}),
      availableAmount: { gt: 0 },
    },
    include: {
      merchant: {
        select: {
          displayName: true,
          isOnline: true,
          completedTrades: true,
          completionRate: true,
          avgReleaseTime: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return Response.json(ads.map((ad) => ({
    id:              ad.id,
    side:            ad.side,
    crypto:          ad.crypto,
    fiat:            ad.fiat,
    pricePerUnit:    Number(ad.pricePerUnit),
    availableAmount: Number(ad.availableAmount),
    minLimit:        Number(ad.minLimit),
    maxLimit:        Number(ad.maxLimit),
    paymentMethods:  ad.paymentMethods,
    paymentWindow:   ad.paymentWindow,
    terms:           ad.terms,
    merchant: {
      displayName:    ad.merchant.displayName,
      isOnline:       ad.merchant.isOnline,
      completedTrades: ad.merchant.completedTrades,
      completionRate: Number(ad.merchant.completionRate),
      avgReleaseTime: ad.merchant.avgReleaseTime,
    },
  })));
}

// POST /api/p2p/ads — merchant creates ad
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await getOrCreateUser(user.id, { email: user.email });
  const merchant = await db.merchantProfile.findUnique({ where: { userId: dbUser.id } });
  if (!merchant?.isVerified) return Response.json({ error: "Merchant account required" }, { status: 403 });

  const body = await req.json();
  const { side, crypto, pricePerUnit, totalAmount, minLimit, maxLimit, paymentMethods, paymentWindow, terms } = body;

  if (!side || !crypto || !pricePerUnit || !totalAmount || !minLimit || !maxLimit || !paymentMethods?.length) {
    return Response.json({ error: "Missing required fields" }, { status: 400 });
  }

  // For SELL ads — verify merchant has enough crypto balance
  if (side === "SELL") {
    const balance = await db.p2PCryptoBalance.findUnique({
      where: { merchantId_crypto: { merchantId: merchant.id, crypto } },
    });
    if (!balance || Number(balance.available) < Number(totalAmount)) {
      return Response.json({ error: `Insufficient ${crypto} balance. Deposit first.` }, { status: 400 });
    }

    // Lock the crypto
    await db.p2PCryptoBalance.update({
      where: { merchantId_crypto: { merchantId: merchant.id, crypto } },
      data: {
        locked:    { increment: Number(totalAmount) },
        available: { decrement: Number(totalAmount) },
      },
    });
  }

  const ad = await db.p2PAd.create({
    data: {
      merchantId:      merchant.id,
      side,
      crypto,
      pricePerUnit,
      totalAmount,
      availableAmount: totalAmount,
      minLimit,
      maxLimit,
      paymentMethods,
      paymentWindow:   paymentWindow ?? 15,
      terms,
    },
  });

  return Response.json(ad, { status: 201 });
}
