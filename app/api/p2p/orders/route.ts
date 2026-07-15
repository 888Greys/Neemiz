import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/get-or-create-user";
import { p2pBlockedResponse } from "@/lib/p2p/user-guard";
import { withdrawalsDisabledResponse } from "@/lib/withdrawal-guard";
import { validateP2PAd } from "@/lib/p2p/ad-guards";
import { defaultNetwork, lockUserCrypto, unlockUserCrypto, kesLockAmount, isWalletBackedCoin, isKesCoin, lockWalletCoin, unlockWalletCoin, recordWalletCoinMovement } from "@/lib/p2p/crypto-balance";
import { sendNewP2POrderEmail, waitForEmailDelivery } from "@/lib/brevo";
import { assertCanCreateP2POrder } from "@/lib/p2p/cancellation-policy";
import { deactivateUnbackedKesSellAds } from "@/lib/p2p/ad-backing";
import { createP2POrderEventMessage, orderExpiredSystemText } from "@/lib/p2p/order-events";
import { reservedKesForMerchant } from "@/lib/p2p/local-coin-convert";

// GET /api/p2p/orders — list all orders where the user is buyer or seller
export async function GET(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const dbUser = await getOrCreateUser(user.id, { email: user.email });
    const url = new URL(req.url);
    const requestedLimit = Number(url.searchParams.get("limit") ?? 50);
    const take = Number.isFinite(requestedLimit)
      ? Math.min(Math.max(Math.floor(requestedLimit), 1), 50)
      : 50;

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
      select: { id: true, adId: true, buyerId: true, sellerId: true, crypto: true, cryptoAmount: true, ad: { select: { side: true } } },
    });
    if (expiredOrders.length > 0) {
      await db.$transaction(async (tx) => {
        for (const order of expiredOrders) {
          const expired = await tx.p2POrder.updateMany({
            where: { id: order.id, status: "PENDING" },
            data:  { status: "EXPIRED" },
          });
          if (expired.count === 0) continue;
          const amt = Number(order.cryptoAmount);
          await tx.p2PAd.update({
            where: { id: order.adId },
            data:  { availableAmount: { increment: amt } },
          });
          if (isWalletBackedCoin(order.crypto)) {
            const giverUserId = order.ad.side === "SELL"
              ? (await tx.merchantProfile.findUnique({ where: { id: order.sellerId }, select: { userId: true } }))?.userId
              : order.buyerId;
            if (giverUserId) {
              const refundAmount = kesLockAmount(amt);
              await unlockWalletCoin(tx, giverUserId, order.crypto, refundAmount);
              await recordWalletCoinMovement(tx, {
                userId: giverUserId,
                crypto: order.crypto,
                amount: refundAmount,
                action: "refund",
                orderId: order.id,
                role: "giver",
              });
            }
          } else if (order.ad.side === "BUY") {
            await unlockUserCrypto(tx, order.buyerId, order.crypto, defaultNetwork(order.crypto), amt);
          }
          await createP2POrderEventMessage(tx, {
            orderId: order.id,
            senderId: order.buyerId,
            content: orderExpiredSystemText(order.crypto),
          });
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
      take,
      select: {
        id: true,
        status: true,
        crypto: true,
        cryptoAmount: true,
        fiatAmount: true,
        pricePerUnit: true,
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
          select: { side: true, fiat: true },
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
      fiat:     o.ad.fiat,
      isBuyer:  o.buyerId === dbUser.id,
      isSeller: merchant ? o.sellerId === merchant.id : false,
      counterparty: o.buyerId === dbUser.id
        ? o.seller.displayName
        : o.buyer.firstName
        ? `${o.buyer.firstName} ${o.buyer.lastName ?? ""}`.trim()
        : o.buyer.username ?? "Trader",
    }));

    return Response.json(result, { headers: { "Cache-Control": "private, max-age=15, stale-while-revalidate=30" } });
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

    const killed = await withdrawalsDisabledResponse();
    if (killed) return killed;

    const dbUser = await getOrCreateUser(user.id, { email: user.email });
    const p2pDenied = await p2pBlockedResponse(dbUser.email);
    if (p2pDenied) return p2pDenied;
    const restriction = await assertCanCreateP2POrder(dbUser.id);
    if (restriction) return restriction;
    await deactivateUnbackedKesSellAds();

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "Invalid request body" }, { status: 400 });
    }

    const { adId, cryptoAmount, paymentMethod } = body;

    // paymentMethod is optional — an ad may carry no methods and settle the rail
    // in chat (validated against the ad below).
    if (!adId || cryptoAmount == null) {
      return Response.json({ error: "Missing required fields" }, { status: 400 });
    }

    const ad = await db.p2PAd.findUnique({
      where: { id: adId as string },
      include: { merchant: { include: { user: { select: { email: true, firstName: true, username: true } } } } },
    });

    if (!ad || !ad.isActive) return Response.json({ error: "Ad not found or inactive" }, { status: 404 });
    if (ad.merchant.userId === dbUser.id) return Response.json({ error: "Cannot trade with yourself" }, { status: 400 });

    const adGuardError = validateP2PAd({
      crypto: ad.crypto,
      pricePerUnit: Number(ad.pricePerUnit),
      availableAmount: Number(ad.availableAmount),
      totalAmount: Number(ad.totalAmount),
      minLimit: Number(ad.minLimit),
      maxLimit: Number(ad.maxLimit),
    });
    if (adGuardError) return Response.json({ error: "This ad is no longer tradable. Ask the merchant to update it." }, { status: 409 });

    const cryptoAmountNum = Number(cryptoAmount);
    if (!Number.isFinite(cryptoAmountNum) || cryptoAmountNum <= 0) {
      return Response.json({ error: "Invalid crypto amount" }, { status: 400 });
    }
    if (Number(ad.availableAmount) < cryptoAmountNum) {
      return Response.json({ error: "Insufficient ad liquidity" }, { status: 400 });
    }

    const fiatAmount = cryptoAmountNum * Number(ad.pricePerUnit);
    // Both sides now support partial fills within the ad's order limits.
    if (fiatAmount < Number(ad.minLimit) || fiatAmount > Number(ad.maxLimit)) {
      return Response.json({
        error: `Order must be between ${ad.fiat} ${Number(ad.minLimit).toLocaleString()} and ${ad.fiat} ${Number(ad.maxLimit).toLocaleString()}`,
      }, { status: 400 });
    }

    // If the ad lists methods, the buyer must pick one of them. If it lists
    // none, payment is arranged in chat — accept the buyer's choice or fall back
    // to a CHAT sentinel so the order still carries a value.
    let orderPaymentMethod: string;
    if (ad.paymentMethods.length > 0) {
      if (!paymentMethod || !ad.paymentMethods.includes(paymentMethod as string)) {
        return Response.json({ error: "Payment method not supported by this ad" }, { status: 400 });
      }
      orderPaymentMethod = paymentMethod as string;
    } else {
      orderPaymentMethod = typeof paymentMethod === "string" && paymentMethod ? paymentMethod : "CHAT";
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

      if (isWalletBackedCoin(ad.crypto)) {
        // Wallet-backed coin (KES or in-app local coin): escrow comes per-order
        // from whoever is giving it — the merchant on a SELL ad, the taker on a
        // BUY ad — straight from their own balance (no ad-creation escrow).
        // Non-KES local coins may top up from free KES at FX inside lockWalletCoin.
        const giverUserId = ad.side === "SELL" ? ad.merchant.userId : dbUser.id;
        const lockedAmount = kesLockAmount(cryptoAmountNum);
        let reservedKes = 0;
        if (!isKesCoin(ad.crypto)) {
          const giverMerchantId = ad.side === "SELL"
            ? ad.merchantId
            : (await tx.merchantProfile.findUnique({ where: { userId: giverUserId }, select: { id: true } }))?.id;
          if (giverMerchantId) reservedKes = await reservedKesForMerchant(giverMerchantId);
        }
        await lockWalletCoin(tx, giverUserId, ad.crypto, lockedAmount, { reservedKes });
        const createdOrder = await tx.p2POrder.create({
          data: {
            adId:         adId as string,
            buyerId:      dbUser.id,
            sellerId:     ad.merchantId,
            crypto:       ad.crypto,
            cryptoAmount: cryptoAmountNum,
            fiatAmount,
            pricePerUnit: Number(ad.pricePerUnit),
            paymentMethod: orderPaymentMethod,
            expiresAt:    new Date(Date.now() + ad.paymentWindow * 60 * 1000),
          },
        });
        await recordWalletCoinMovement(tx, {
          userId: giverUserId,
          crypto: ad.crypto,
          amount: lockedAmount,
          action: "lock",
          orderId: createdOrder.id,
          role: "giver",
        });
        await tx.merchantProfile.update({
          where: { id: ad.merchantId },
          data: { totalTrades: { increment: 1 } },
        });
        return createdOrder;
      } else if (ad.side === "BUY") {
        await lockUserCrypto(tx, dbUser.id, ad.crypto, defaultNetwork(ad.crypto), cryptoAmountNum);
      }

      const createdOrder = await tx.p2POrder.create({
        data: {
          adId:         adId as string,
          buyerId:      dbUser.id,
          sellerId:     ad.merchantId,
          crypto:       ad.crypto,
          cryptoAmount: cryptoAmountNum,
          fiatAmount,
          pricePerUnit: Number(ad.pricePerUnit),
          paymentMethod: orderPaymentMethod,
          expiresAt:    new Date(Date.now() + ad.paymentWindow * 60 * 1000),
        },
      });
      await tx.merchantProfile.update({
        where: { id: ad.merchantId },
        data: { totalTrades: { increment: 1 } },
      });
      return createdOrder;
    }).catch((err: unknown) => {
      const msg = (err as Error).message;
      if (msg === "INSUFFICIENT_AD_LIQUIDITY") return null;
      if (msg === "INSUFFICIENT_CRYPTO_BALANCE") return "INSUFFICIENT_CRYPTO_BALANCE" as const;
      if (msg === "INSUFFICIENT_FIAT_BALANCE") return "INSUFFICIENT_FIAT_BALANCE" as const;
      if (msg === "PROMO_LOCKED") return "PROMO_LOCKED" as const;
      if (msg === "NO_DEPOSIT_GATE") return "NO_DEPOSIT_GATE" as const;
      if (msg === "NO_FX_RATE") return "NO_FX_RATE" as const;
      throw err;
    });

    if (order === "PROMO_LOCKED") {
      return Response.json({
        error: "Welcome/promo credit is play-only. Make a deposit with your own funds to unlock cash-outs, transfers and P2P sells.",
        code: "PROMO_LOCKED",
      }, { status: 400 });
    }
    if (order === "NO_DEPOSIT_GATE") {
      return Response.json({
        error: "Make a deposit with your own funds before selling on P2P. Credit received from others is play-only until your account is funded.",
        code: "NO_DEPOSIT_GATE",
      }, { status: 400 });
    }
    if (order === "NO_FX_RATE") {
      return Response.json({ error: `No FX rate available for ${ad.crypto}. Try again shortly.` }, { status: 503 });
    }
    if (order === "INSUFFICIENT_CRYPTO_BALANCE") {
      return Response.json({ error: `Insufficient ${ad.crypto} balance to sell.` }, { status: 400 });
    }
    if (order === "INSUFFICIENT_FIAT_BALANCE") {
      return Response.json({
        error: ad.side === "SELL"
          ? `The merchant doesn't have enough ${ad.crypto === "KES" ? "fiat wallet" : `${ad.crypto} / KES`} balance to back this order right now.`
          : `Insufficient balance to sell ${ad.crypto}. Top up KES or hold ${ad.crypto}.`,
      }, { status: 400 });
    }
    if (!order) return Response.json({ error: "Insufficient ad liquidity" }, { status: 400 });

    // Notify the merchant and wait for external delivery before the serverless
    // invocation ends. Notification failures never roll back the order.
    const buyerName = dbUser.firstName
      ? `${dbUser.firstName}${dbUser.lastName ? ` ${dbUser.lastName}` : ""}`.trim()
      : dbUser.username ?? "A trader";
    const takerAction = ad.side === "SELL" ? "buy" : "sell";
    const merchantNextStep = ad.side === "SELL" ? "Awaiting their payment." : "Send payment to receive crypto.";

    // In-app notification (bell)
    const notificationTask = db.notification.create({
      data: {
        userId: ad.merchant.userId,
        type:   "p2p_new_order",
        title:  "New P2P order",
        body:   `${buyerName} wants to ${takerAction} ${cryptoAmountNum} ${ad.crypto} (KSh ${fiatAmount.toLocaleString()}). ${merchantNextStep}`,
        link:   `/p2p/order/${order.id}`,
      },
    }).catch((e) => console.error("P2P order notification failed:", e));

    // Email
    const merchantEmail = ad.merchant.user.email;
    await Promise.all([
      notificationTask,
      waitForEmailDelivery("P2P new order", [merchantEmail
        ? sendNewP2POrderEmail(merchantEmail, ad.merchant.displayName, {
        orderId: order.id,
        buyerName,
        crypto: ad.crypto,
        cryptoAmount: cryptoAmountNum,
        fiatAmount,
        fiat: ad.fiat,
        paymentMethod: orderPaymentMethod,
        side: ad.side,
        })
        : null]),
    ]);

    return Response.json({ orderId: order.id }, { status: 201 });
  } catch (err) {
    console.error("POST /api/p2p/orders:", err instanceof Error ? err.message : "Unknown error");
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
