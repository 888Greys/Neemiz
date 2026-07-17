import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/get-or-create-user";
import { validateP2PAd } from "@/lib/p2p/ad-guards";
import { ALL_PAYMENT_CODES } from "@/lib/p2p/payment-methods";
import { OrderStatus } from "@prisma/client";

const OPEN_ORDER_STATUSES: OrderStatus[] = ["PENDING", "PAID", "DISPUTED"];

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
      profitMarginPct: ad.profitMarginPct == null ? null : Number(ad.profitMarginPct),
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
  const rawPaymentMethods = body.paymentMethods == null ? ad.paymentMethods : body.paymentMethods;
  // Payment methods are OPTIONAL (same as ad creation) — a merchant may keep an
  // ad with none and settle the rail in chat. Normalize to a clean string list.
  const paymentMethods = Array.from(new Set(
    (Array.isArray(rawPaymentMethods) ? rawPaymentMethods : []).filter((m): m is string => typeof m === "string"),
  ));
  const terms = body.terms == null ? ad.terms : String(body.terms || "");
  const isActive = typeof body.isActive === "boolean" ? body.isActive : ad.isActive;

  let profitMarginPct: number | null =
    ad.profitMarginPct == null ? null : Number(ad.profitMarginPct);
  if (body.profitMarginPct !== undefined) {
    if (body.profitMarginPct == null || body.profitMarginPct === "") {
      profitMarginPct = null;
    } else {
      const n = Number(body.profitMarginPct);
      if (!Number.isFinite(n) || n <= -100 || n > 500) {
        return Response.json({ error: "Margin must be greater than -100% and at most 500%" }, { status: 400 });
      }
      profitMarginPct = Math.round(n * 10000) / 10000;
    }
  }

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
  // If the ad DOES list methods, each must be a known catalogue code (same as
  // browse). Saved Merchant Center accounts are optional extras for checkout.
  if (paymentMethods.length > 0) {
    if (paymentMethods.some((method) => !ALL_PAYMENT_CODES.has(method))) {
      return Response.json({ error: "Unknown payment method on this ad." }, { status: 400 });
    }
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

  }

  const adUpdate = {
    pricePerUnit,
    profitMarginPct,
    minLimit,
    maxLimit,
    paymentMethods,
    paymentWindow,
    terms: terms || null,
    isActive,
  };

  let updated;
  try {
    if (!isActive && ad.isActive) {
      // Pausing: ensure no open orders
      const openOrders = await db.p2POrder.count({
        where: { adId: ad.id, status: { in: OPEN_ORDER_STATUSES } },
      });
      if (openOrders > 0) throw new Error("OPEN_ORDERS");
    }
    updated = await db.p2PAd.update({ where: { id: ad.id }, data: adUpdate });
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (message === "OPEN_ORDERS") {
      return Response.json({ error: "This ad has open orders. Resolve them before pausing it." }, { status: 409 });
    }
    throw err;
  }

  return Response.json({
    id: updated.id,
    pricePerUnit: Number(updated.pricePerUnit),
    profitMarginPct: updated.profitMarginPct == null ? null : Number(updated.profitMarginPct),
    minLimit: Number(updated.minLimit),
    maxLimit: Number(updated.maxLimit),
    paymentMethods: updated.paymentMethods,
    paymentWindow: updated.paymentWindow,
    terms: updated.terms,
    isActive: updated.isActive,
  });
}

// DELETE /api/p2p/ads/mine?id=... — permanently remove an unused ad
export async function DELETE(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await getOrCreateUser(user.id, { email: user.email });
  const merchant = await db.merchantProfile.findUnique({ where: { userId: dbUser.id } });
  if (!merchant?.isVerified) return Response.json({ error: "Merchant account required" }, { status: 403 });

  const adId = new URL(req.url).searchParams.get("id");
  if (!adId) return Response.json({ error: "Ad id is required" }, { status: 400 });

  const ad = await db.p2PAd.findFirst({
    where: { id: adId, merchantId: merchant.id },
    select: {
      id: true,
      isActive: true,
      _count: { select: { orders: true } },
    },
  });
  if (!ad) return Response.json({ error: "Ad not found" }, { status: 404 });
  if (ad._count.orders > 0) {
    return Response.json({
      error: "This ad has order history and cannot be deleted. Pause it instead.",
    }, { status: 409 });
  }

  try {
    await db.$transaction(async (tx) => {
      // Lock/deactivate the ad before checking its history. This makes a
      // concurrent order creation fail its `isActive: true` reservation.
      await tx.p2PAd.update({ where: { id: ad.id }, data: { isActive: false } });

      const orderCount = await tx.p2POrder.count({ where: { adId: ad.id } });
      if (orderCount > 0) throw new Error("AD_HAS_ORDERS");


      await tx.p2PAd.delete({ where: { id: ad.id } });
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (message === "AD_HAS_ORDERS") {
      return Response.json({ error: "This ad has order history and cannot be deleted. Pause it instead." }, { status: 409 });
    }

    throw err;
  }
  return Response.json({ ok: true });
}
