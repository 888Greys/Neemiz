import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/get-or-create-user";
import { creditUserCrypto, defaultNetwork, isKesCoin, creditWalletKes, kesPayoutAmount } from "@/lib/p2p/crypto-balance";
import { sendTradeCompletedEmail } from "@/lib/brevo";

// POST /api/p2p/orders/[id]/release — merchant confirms fiat received & releases crypto
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const dbUser   = await getOrCreateUser(user.id, { email: user.email });
    const merchant = await db.merchantProfile.findFirst({
      where: { OR: [{ userId: dbUser.id }, { sellOrders: { some: { id } } }] },
    });

    const order = await db.p2POrder.findUnique({
      where: { id },
      include: {
        ad: true,
        buyer: { select: { email: true, firstName: true, username: true } },
      },
    });

    if (!order)                         return Response.json({ error: "Order not found" }, { status: 404 });
    const isMerchantSell = order.ad.side === "SELL";
    const canRelease = isMerchantSell
      ? merchant?.userId === dbUser.id && order.sellerId === merchant.id
      : order.buyerId === dbUser.id;
    if (!canRelease) return Response.json({ error: "Forbidden" }, { status: 403 });
    if (order.status !== "PAID")        return Response.json({ error: "Order is not in PAID state" }, { status: 400 });

    const cryptoAmt   = Number(order.cryptoAmount);
    const network     = defaultNetwork(order.crypto);
    const releaseTime = Math.round((Date.now() - new Date(order.createdAt).getTime()) / 60000);

    // Platform escrow fee: 2% total (1% from buyer + 1% from seller).
    // Deducted from the crypto being transferred — receiver gets 98% of trade amount.
    const ESCROW_FEE_RATE = 0.02;
    const netCryptoAmt    = parseFloat((cryptoAmt * (1 - ESCROW_FEE_RATE)).toFixed(8));

    await db.$transaction(async (tx) => {
      await tx.p2POrder.update({
        where: { id },
        data: {
          status:         "RELEASED",
          escrowReleased: true,
          releasedAt:     new Date(),
        },
      });

      if (!merchant) throw new Error("MERCHANT_NOT_FOUND");

      if (isKesCoin(order.crypto)) {
        // KES coin: 1% from each side. The giver was escrowed amount+1% at
        // order creation; pay the receiver amount−1% (platform keeps the 2%).
        await creditWalletKes(tx, isMerchantSell ? order.buyerId : merchant.userId, kesPayoutAmount(cryptoAmt));
      } else if (isMerchantSell) {
        await tx.p2PCryptoBalance.update({
          where: { merchantId_crypto: { merchantId: merchant.id, crypto: order.crypto } },
          data: {
            locked: { decrement: cryptoAmt },
            total:  { decrement: cryptoAmt },
          },
        });

        // Buyer (user) receives 98% — 2% platform fee stays in escrow
        await creditUserCrypto(tx, order.buyerId, order.crypto, network, netCryptoAmt);
      } else {
        const unlocked = await tx.userCryptoBalance.updateMany({
          where: { userId: order.buyerId, crypto: order.crypto, network, locked: { gte: cryptoAmt } },
          data:  { locked: { decrement: cryptoAmt } },
        });
        if (unlocked.count === 0) throw new Error("INSUFFICIENT_LOCKED_CRYPTO");
        // Merchant (buyer) receives 98% — 2% platform fee stays in escrow
        await tx.p2PCryptoBalance.upsert({
          where:  { merchantId_crypto: { merchantId: merchant.id, crypto: order.crypto } },
          create: { merchantId: merchant.id, crypto: order.crypto, total: netCryptoAmt, available: netCryptoAmt, locked: 0 },
          update: { total: { increment: netCryptoAmt }, available: { increment: netCryptoAmt } },
        });
      }

      if (!merchant) throw new Error("MERCHANT_NOT_FOUND");
      const newTotal     = merchant.totalTrades + 1;
      const newCompleted = merchant.completedTrades + 1;
      const newAvgRelease = Math.round(
        (merchant.avgReleaseTime * merchant.completedTrades + releaseTime) / newCompleted,
      );
      await tx.merchantProfile.update({
        where: { id: merchant.id },
        data: {
          totalTrades:     newTotal,
          completedTrades: newCompleted,
          completionRate:  (newCompleted / newTotal) * 100,
          avgReleaseTime:  newAvgRelease,
        },
      });
    });

    // Email both parties — fire-and-forget
    const emailOpts = {
      crypto:      order.crypto,
      cryptoAmount: cryptoAmt,
      fiatAmount:  Number(order.fiatAmount),
      fiat:        order.ad.fiat,
      orderId:     order.id,
    };
    const buyerName = order.buyer.firstName ?? order.buyer.username ?? "Trader";
    if (order.buyer.email) {
      sendTradeCompletedEmail(order.buyer.email, buyerName, { ...emailOpts, role: "buyer" })
        .catch((e) => console.error("Trade completed email (buyer) failed:", e));
    }
    // Fetch merchant user email
    if (merchant) {
      db.user.findUnique({ where: { id: merchant.userId }, select: { email: true, firstName: true, username: true } })
        .then((mu) => {
          if (mu?.email) {
            const mName = mu.firstName ?? mu.username ?? merchant.displayName;
            sendTradeCompletedEmail(mu.email, mName, { ...emailOpts, role: "seller" })
              .catch((e) => console.error("Trade completed email (merchant) failed:", e));
          }
        }).catch(() => {});
    }

    // Notify counterparty (outside transaction — non-critical)
    await db.notification.create({
      data: {
        userId: isMerchantSell ? order.buyerId : merchant!.userId,
        type:   "p2p_released",
        title:  isMerchantSell ? `${order.crypto} credited to your account` : `${order.crypto} received from seller`,
        body:   `${cryptoAmt.toFixed(6)} ${order.crypto} from order #${order.id.slice(0, 8).toUpperCase()} is complete.`,
        link:   `/p2p/order/${order.id}`,
      },
    }).catch(() => {});

    return Response.json({ status: "RELEASED" });
  } catch (err) {
    console.error("POST /api/p2p/orders/[id]/release:", err instanceof Error ? err.message : "Unknown error");
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
