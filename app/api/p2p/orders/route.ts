import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/get-or-create-user";
import { defaultNetwork, lockUserCrypto, unlockUserCrypto } from "@/lib/p2p/crypto-balance";

// GET /api/p2p/orders — list all orders where the user is buyer or seller
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const dbUser = await getOrCreateUser(user.id, { email: user.email });

    const merchant = await db.merchantProfile.findUnique({
      where: { userId: dbUser.id },
      select: { id: true },
    });

    // Expire any stale PENDING orders for this user before returning the list
    const expiredOrders = await db.p2POrder.findMany({
      where: {
        status: "PENDING",
        expiresAt: { lt: new Date() },
        OR: [
          { buyerId: dbUser.id },
          ...(merchant ? [{ sellerId: merchant.id }] : []),
        ],
      },
      select: { id: true, adId: true, buyerId: true, crypto: true, cryptoAmount: true, ad: { select: { side: true } } },
    });
    if (expiredOrders.length > 0) {
      await db.$transaction(async (tx) => {
        for (const order of expiredOrders) {
          const expired = await tx.p2POrder.updateMany({
            where: { id: order.id, status: "PENDING" },
            data:  { status: "EXPIRED" },
          });
          if (expired.count === 0) continue;
          await tx.p2PAd.update({
            where: { id: order.adId },
            data:  { availableAmount: { increment: Number(order.cryptoAmount) } },
          });
          if (order.ad.side === "BUY") {
            await unlockUserCrypto(tx, order.buyerId, order.crypto, defaultNetwork(order.crypto), Number(order.cryptoAmount));
          }
        }
      });
    }

    const orders = await db.p2POrder.findMany({
      where: {
        OR: [
          { buyerId: dbUser.id },
          ...(merchant ? [{ sellerId: merchant.id }] : []),
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        status: true,
        crypto: true,
        cryptoAmount: true,
        fiatAmount: true,
        paymentMethod: true,
        createdAt: true,
        expiresAt: true,
        buyerId: true,
        sellerId: true,
        seller: {
          select: {
            id: true,
            displayName: true,
          },
        },
        ad: {
          select: { side: true },
        },
        buyer: {
          select: {
            firstName: true,
            lastName: true,
            username: true,
          },
        },
      },
    });

    const result = orders.map((o) => ({
      ...o,
      side:     o.ad.side,
      isBuyer:  o.buyerId === dbUser.id,
      isSeller: merchant ? o.sellerId === merchant.id : false,
    }));

    return Response.json(result);
  } catch (err) {
    console.error("GET /api/p2p/orders:", err instanceof Error ? err.message : "Unknown error");
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/p2p/orders — buyer takes an ad and creates an order
export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const dbUser = await getOrCreateUser(user.id, { email: user.email });

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "Invalid request body" }, { status: 400 });
    }

    const { adId, cryptoAmount, paymentMethod } = body;

    if (!adId || cryptoAmount == null || !paymentMethod) {
      return Response.json({ error: "Missing required fields" }, { status: 400 });
    }

    const ad = await db.p2PAd.findUnique({
      where: { id: adId as string },
      include: { merchant: true },
    });

    if (!ad || !ad.isActive) return Response.json({ error: "Ad not found or inactive" }, { status: 404 });
    if (ad.merchant.userId === dbUser.id) return Response.json({ error: "Cannot trade with yourself" }, { status: 400 });

    const cryptoAmountNum = Number(cryptoAmount);
    if (!Number.isFinite(cryptoAmountNum) || cryptoAmountNum <= 0) {
      return Response.json({ error: "Invalid crypto amount" }, { status: 400 });
    }
    if (Number(ad.availableAmount) < cryptoAmountNum) {
      return Response.json({ error: "Insufficient ad liquidity" }, { status: 400 });
    }

    const fiatAmount = cryptoAmountNum * Number(ad.pricePerUnit);
    if (fiatAmount < Number(ad.minLimit) || fiatAmount > Number(ad.maxLimit)) {
      return Response.json({
        error: `Order must be between KSh ${ad.minLimit} and KSh ${ad.maxLimit}`,
      }, { status: 400 });
    }

    if (!ad.paymentMethods.includes(paymentMethod as string)) {
      return Response.json({ error: "Payment method not supported by this ad" }, { status: 400 });
    }

    // Create order + reserve liquidity atomically.
    // SELL ad: merchant crypto is already locked when the ad is created.
    // BUY ad: taker is selling crypto to the merchant, so lock taker's crypto now.
    const order = await db.$transaction(async (tx) => {
      const reserved = await tx.p2PAd.updateMany({
        where: { id: adId as string, isActive: true, availableAmount: { gte: cryptoAmountNum } },
        data: { availableAmount: { decrement: cryptoAmountNum } },
      });
      if (reserved.count === 0) throw new Error("INSUFFICIENT_AD_LIQUIDITY");

      if (ad.side === "BUY") {
        await lockUserCrypto(tx, dbUser.id, ad.crypto, defaultNetwork(ad.crypto), cryptoAmountNum);
      }

      return tx.p2POrder.create({
        data: {
          adId:         adId as string,
          buyerId:      dbUser.id,
          sellerId:     ad.merchantId,
          crypto:       ad.crypto,
          cryptoAmount: cryptoAmountNum,
          fiatAmount,
          pricePerUnit: Number(ad.pricePerUnit),
          paymentMethod: paymentMethod as string,
          expiresAt:    new Date(Date.now() + ad.paymentWindow * 60 * 1000),
        },
      });
    }).catch((err: unknown) => {
      if ((err as Error).message === "INSUFFICIENT_AD_LIQUIDITY") return null;
      if ((err as Error).message === "INSUFFICIENT_CRYPTO_BALANCE") return "INSUFFICIENT_CRYPTO_BALANCE" as const;
      throw err;
    });

    if (order === "INSUFFICIENT_CRYPTO_BALANCE") {
      return Response.json({ error: `Insufficient ${ad.crypto} balance to sell.` }, { status: 400 });
    }
    if (!order) return Response.json({ error: "Insufficient ad liquidity" }, { status: 400 });

    return Response.json({ orderId: order.id }, { status: 201 });
  } catch (err) {
    console.error("POST /api/p2p/orders:", err instanceof Error ? err.message : "Unknown error");
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
