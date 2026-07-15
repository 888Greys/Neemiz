import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/get-or-create-user";
import { validateP2PAd } from "@/lib/p2p/ad-guards";
import { assertKesSellBacking, deactivateUnbackedKesSellAds } from "@/lib/p2p/ad-backing";
import { isKesCoin, isWalletBackedCoin, p2pMakerLock, lockUserCrypto, unlockOnChainSellReserve, defaultNetwork } from "@/lib/p2p/crypto-balance";
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
  const rawPaymentMethods = body.paymentMethods == null ? ad.paymentMethods : body.paymentMethods;
  // Payment methods are OPTIONAL (same as ad creation) — a merchant may keep an
  // ad with none and settle the rail in chat. Normalize to a clean string list.
  const paymentMethods = Array.from(new Set(
    (Array.isArray(rawPaymentMethods) ? rawPaymentMethods : []).filter((m): m is string => typeof m === "string"),
  ));
  const terms = body.terms == null ? ad.terms : String(body.terms || "");
  const isActive = typeof body.isActive === "boolean" ? body.isActive : ad.isActive;
  // On-chain SELL ads lock wallet (or legacy escrow) at create — pause/resume must unlock/relock.
  // Wallet-backed local coins lock per-order and have no ad-level reserve.
  const isOnChainSell = ad.side === "SELL" && !isWalletBackedCoin(ad.crypto);
  const isPausing = isOnChainSell && ad.isActive && !isActive;
  const isResuming = isOnChainSell && !ad.isActive && isActive;

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
  // If the ad DOES list methods, each must still be saved in Merchant Center.
  // No methods is fine — payment is arranged in chat (matches ad creation).
  if (paymentMethods.length > 0) {
    const savedPaymentMethods = await db.p2PPaymentMethod.findMany({
      where: { merchantId: merchant.id, isActive: true },
      select: { name: true },
    });
    const savedPaymentCodes = new Set(savedPaymentMethods.map((method) => method.name).filter(Boolean));
    if (paymentMethods.some((method) => !savedPaymentCodes.has(method))) {
      return Response.json({ error: "This ad uses a payment method that is not saved in your Merchant Center." }, { status: 400 });
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

  const adUpdate = {
    pricePerUnit,
    minLimit,
    maxLimit,
    paymentMethods,
    paymentWindow,
    terms: terms || null,
    isActive,
  };

  let updated;
  try {
    updated = isPausing || isResuming
      ? await db.$transaction(async (tx) => {
          // Taking the ad row lock first prevents a concurrent order creation
          // from reserving inventory after the no-open-orders check.
          const stateChanged = await tx.p2PAd.updateMany({
            where: { id: ad.id, isActive: ad.isActive },
            data: { isActive },
          });
          if (stateChanged.count === 0) throw new Error("AD_STATE_CHANGED");

          if (isPausing) {
            const openOrders = await tx.p2POrder.count({
              where: { adId: ad.id, status: { in: OPEN_ORDER_STATUSES } },
            });
            if (openOrders > 0) throw new Error("OPEN_ORDERS");
          }

          const reserve = p2pMakerLock(Number(ad.availableAmount), Number(ad.feeRate));
          if (isPausing) {
            await unlockOnChainSellReserve(tx, {
              userId: dbUser.id,
              merchantId: merchant.id,
              crypto: ad.crypto,
              amount: reserve,
            });
          } else {
            try {
              await lockUserCrypto(tx, dbUser.id, ad.crypto, defaultNetwork(ad.crypto), reserve);
            } catch (err) {
              if ((err as Error).message === "INSUFFICIENT_CRYPTO_BALANCE") {
                throw new Error("INSUFFICIENT_BALANCE");
              }
              throw err;
            }
          }

          return tx.p2PAd.update({ where: { id: ad.id }, data: adUpdate });
        })
      : await db.p2PAd.update({ where: { id: ad.id }, data: adUpdate });
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (message === "OPEN_ORDERS") {
      return Response.json({ error: "This ad has open orders. Resolve them before pausing it." }, { status: 409 });
    }
    if (message === "INSUFFICIENT_BALANCE") {
      return Response.json({ error: `Insufficient ${ad.crypto} in your wallet to resume this ad.` }, { status: 400 });
    }
    if (message === "INSUFFICIENT_LOCKED_CRYPTO") {
      return Response.json({ error: "This ad's locked reserve is unavailable. Contact support." }, { status: 409 });
    }
    if (message === "AD_STATE_CHANGED") {
      return Response.json({ error: "This ad was updated elsewhere. Refresh and try again." }, { status: 409 });
    }
    throw err;
  }

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
      side: true,
      crypto: true,
      availableAmount: true,
      feeRate: true,
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

      if (ad.side === "SELL" && !isWalletBackedCoin(ad.crypto)) {
        const reserve = p2pMakerLock(Number(ad.availableAmount), Number(ad.feeRate));
        await unlockOnChainSellReserve(tx, {
          userId: dbUser.id,
          merchantId: merchant.id,
          crypto: ad.crypto,
          amount: reserve,
        });
      }

      await tx.p2PAd.delete({ where: { id: ad.id } });
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (message === "AD_HAS_ORDERS") {
      return Response.json({ error: "This ad has order history and cannot be deleted. Pause it instead." }, { status: 409 });
    }
    if (message === "INSUFFICIENT_LOCKED_CRYPTO") {
      return Response.json({ error: "This ad's locked reserve is unavailable. Contact support." }, { status: 409 });
    }
    throw err;
  }
  return Response.json({ ok: true });
}
