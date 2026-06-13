import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/get-or-create-user";
import { validateP2PAd } from "@/lib/p2p/ad-guards";
import { assertKesSellBacking, deactivateUnbackedKesSellAds } from "@/lib/p2p/ad-backing";

function hasPaymentMethods(value: unknown): value is string[] {
  return Array.isArray(value) && value.length > 0 && value.every((m) => typeof m === "string");
}

// GET /api/p2p/ads/mine — merchant's own ads
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await getOrCreateUser(user.id, { email: user.email });
  const merchant = await db.merchantProfile.findUnique({ where: { userId: dbUser.id } });
  if (!merchant) return Response.json([], { status: 200 });
  await deactivateUnbackedKesSellAds();

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
      terms:           ad.terms,
      isActive:        ad.isActive,
      createdAt:       ad.createdAt,
      validationError: validateP2PAd({ crypto: ad.crypto, pricePerUnit, totalAmount, availableAmount, minLimit, maxLimit }),
    };
  }));
}

// PATCH /api/p2p/ads/mine — merchant updates one of their ads
export async function PATCH(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await getOrCreateUser(user.id, { email: user.email });
  const merchant = await db.merchantProfile.findUnique({ where: { userId: dbUser.id } });
  if (!merchant?.isVerified) return Response.json({ error: "Merchant account required" }, { status: 403 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const adId = body.id;
  if (typeof adId !== "string") return Response.json({ error: "Ad id is required" }, { status: 400 });

  const ad = await db.p2PAd.findFirst({
    where: { id: adId, merchantId: merchant.id },
  });
  if (!ad) return Response.json({ error: "Ad not found" }, { status: 404 });

  const pricePerUnit = body.pricePerUnit == null ? Number(ad.pricePerUnit) : Number(body.pricePerUnit);
  const minLimit = body.minLimit == null ? Number(ad.minLimit) : Number(body.minLimit);
  const maxLimit = body.maxLimit == null ? Number(ad.maxLimit) : Number(body.maxLimit);
  const paymentWindow = body.paymentWindow == null ? ad.paymentWindow : Number(body.paymentWindow);
  const paymentMethods = body.paymentMethods == null ? ad.paymentMethods : body.paymentMethods;
  const terms = body.terms == null ? ad.terms : String(body.terms || "");
  const isActive = typeof body.isActive === "boolean" ? body.isActive : ad.isActive;

  if (!Number.isFinite(pricePerUnit) || pricePerUnit <= 0) {
    return Response.json({ error: "Invalid price per unit" }, { status: 400 });
  }
  if (ad.crypto.toUpperCase() === "KES" && (pricePerUnit < 0.5 || pricePerUnit > 2)) {
    return Response.json({ error: "KES Coin price must be between 0.50 and 2.00 (max ±100% spread on the 1:1 peg)." }, { status: 400 });
  }
  if (!Number.isFinite(minLimit) || minLimit <= 0) {
    return Response.json({ error: "Invalid minimum limit" }, { status: 400 });
  }
  if (!Number.isFinite(maxLimit) || maxLimit <= 0 || maxLimit < minLimit) {
    return Response.json({ error: "Maximum limit must be greater than or equal to minimum" }, { status: 400 });
  }
  if (!Number.isFinite(paymentWindow) || paymentWindow < 5 || paymentWindow > 180) {
    return Response.json({ error: "Payment window must be 5-180 minutes" }, { status: 400 });
  }
  if (!hasPaymentMethods(paymentMethods)) {
    return Response.json({ error: "Select at least one payment method" }, { status: 400 });
  }
  const savedPaymentMethods = await db.p2PPaymentMethod.findMany({
    where: { merchantId: merchant.id, isActive: true },
    select: { name: true },
  });
  const savedPaymentCodes = new Set(savedPaymentMethods.map((method) => method.name).filter(Boolean));
  if (savedPaymentCodes.size === 0) {
    return Response.json({ error: "Add a payment method in Merchant Center before activating an ad." }, { status: 400 });
  }
  if (paymentMethods.some((method) => !savedPaymentCodes.has(method))) {
    return Response.json({ error: "This ad uses a payment method that is not saved in your Merchant Center." }, { status: 400 });
  }

  if (isActive) {
    const guardError = validateP2PAd({
      crypto: ad.crypto,
      pricePerUnit,
      availableAmount: Number(ad.availableAmount),
      totalAmount: Number(ad.totalAmount),
      minLimit,
      maxLimit,
    });
    if (guardError) return Response.json({ error: guardError }, { status: 400 });

    const backing = await assertKesSellBacking({
      merchantId: merchant.id,
      walletBalance: Number(dbUser.walletBalance ?? 0),
      crypto: ad.crypto,
      side: ad.side,
      availableAmount: Number(ad.availableAmount),
      excludeAdId: ad.id,
    });
    if (backing) {
      return Response.json({
        error: `Insufficient backing. Active KES sell inventory requires KSh ${backing.required.toLocaleString("en-KE")}, but your wallet has KSh ${backing.available.toLocaleString("en-KE")}.`,
      }, { status: 400 });
    }
  }

  const updated = await db.p2PAd.update({
    where: { id: ad.id },
    data: {
      pricePerUnit,
      minLimit,
      maxLimit,
      paymentMethods,
      paymentWindow,
      terms: terms || null,
      isActive,
    },
  });

  return Response.json({
    id: updated.id,
    pricePerUnit: Number(updated.pricePerUnit),
    minLimit: Number(updated.minLimit),
    maxLimit: Number(updated.maxLimit),
    paymentMethods: updated.paymentMethods,
    paymentWindow: updated.paymentWindow,
    terms: updated.terms,
    isActive: updated.isActive,
  });
}
