import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/get-or-create-user";
import { defaultNetwork, isKesCoin, releaseKesCoinBalance, kesLockAmount, kesPayoutAmount, recordKesWalletMovement, settleCryptoEscrowRelease } from "@/lib/p2p/crypto-balance";
import { convertToKES, getFxRatesToKES } from "@/lib/p2p/fx";
import { sendTradeCompletedEmail, waitForEmailDelivery } from "@/lib/brevo";
import { createP2POrderEventMessage } from "@/lib/p2p/order-events";
import { withdrawalsDisabledResponse } from "@/lib/withdrawal-guard";

// POST /api/p2p/orders/[id]/release — merchant confirms fiat received & releases crypto
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    // P2P escrow release moves value between wallets — it's a cash-out path, so
    // it must honor the global money-out kill switch (it previously bypassed it,
    // which is how exploit balances were laundered into real cash).
    const killed = await withdrawalsDisabledResponse();
    if (killed) return killed;

    const dbUser   = await getOrCreateUser(user.id, { email: user.email });

    const order = await db.p2POrder.findUnique({
      where: { id },
      include: {
        ad: true,
        buyer: { select: { email: true, firstName: true, username: true } },
        seller: {
          select: {
            id: true,
            userId: true,
            displayName: true,
            totalTrades: true,
            completedTrades: true,
            avgReleaseTime: true,
          },
        },
      },
    });

    if (!order)                         return Response.json({ error: "Order not found" }, { status: 404 });
    const merchant = order.seller;
    const isMerchantSell = order.ad.side === "SELL";
    const canRelease = isMerchantSell
      ? merchant?.userId === dbUser.id && order.sellerId === merchant.id
      : order.buyerId === dbUser.id;
    if (!canRelease) return Response.json({ error: "Forbidden" }, { status: 403 });
    if (order.status !== "PAID")        return Response.json({ error: "Order is not in PAID state" }, { status: 400 });

    const cryptoAmt   = Number(order.cryptoAmount);
    const network     = defaultNetwork(order.crypto);
    const releaseTime = Math.round((Date.now() - new Date(order.createdAt).getTime()) / 60000);
    // The executed ad price is immutable on the order. Convert it once while
    // booking the fee so admin P&L is stable even when crypto prices move later.
    const feeKesPerCrypto = isKesCoin(order.crypto)
      ? 0
      : convertToKES(Number(order.pricePerUnit), order.ad.fiat, (await getFxRatesToKES()).toKES);

    // Maker-pays fee (Binance-style): the merchant who posted the ad bears the
    // platform fee; the taker is always made whole. SELL reserves the fee in the
    // merchant's escrow at ad creation (order.ad.feeRate); BUY takes it from what
    // the merchant receives. `creditedAmount` is what the receiver actually gets,
    // used only for messaging below.
    let creditedAmount = cryptoAmt;

    await db.$transaction(async (tx) => {
      const released = await tx.p2POrder.updateMany({
        where: { id, status: "PAID", escrowReleased: false },
        data: {
          status:         "RELEASED",
          escrowReleased: true,
          releasedAt:     new Date(),
        },
      });
      if (released.count === 0) throw new Error("ORDER_ALREADY_PROCESSED");

      if (!merchant) throw new Error("MERCHANT_NOT_FOUND");

      if (isKesCoin(order.crypto)) {
        // KES coin keeps its own 1%/1% split. The giver was escrowed amount+1% at
        // order creation; pay the receiver amount-1% (platform keeps the 2%).
        const receiverUserId = isMerchantSell ? order.buyerId : merchant.userId;
        const payoutAmount = kesPayoutAmount(cryptoAmt);
        await releaseKesCoinBalance(
          tx,
          isMerchantSell ? merchant.userId : order.buyerId,
          receiverUserId,
          kesLockAmount(cryptoAmt),
          payoutAmount,
        );
        await recordKesWalletMovement(tx, {
          userId: receiverUserId,
          amount: payoutAmount,
          action: "release",
          orderId: order.id,
          role: "receiver",
        });
        creditedAmount = payoutAmount;
      } else {
        // Real crypto — maker-pays. SELL: merchant escrow funds amount + fee,
        // buyer gets the full amount. BUY: taker delivers full, merchant gets
        // amount − fee. Fee is booked to a p2p_fee ledger row (+ house escrow).
        const { receiverGets } = await settleCryptoEscrowRelease(tx, {
          crypto:         order.crypto,
          network,
          amount:         cryptoAmt,
          isMerchantSell,
          sellFeeRate:    Number(order.ad.feeRate),
          merchantId:     merchant.id,
          merchantUserId: merchant.userId,
          buyerId:        order.buyerId,
          orderId:        order.id,
          feeKesPerCrypto,
        });
        creditedAmount = receiverGets;
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
      await createP2POrderEventMessage(tx, {
        orderId: order.id,
        senderId: dbUser.id,
        content: `${creditedAmount.toFixed(6)} ${order.crypto} released. Trade completed.`,
      });
    });

    // Fetch both recipients and wait for Resend before the invocation ends.
    const emailOpts = {
      crypto:      order.crypto,
      cryptoAmount: cryptoAmt,
      netCryptoAmount: creditedAmount,
      fiatAmount:  Number(order.fiatAmount),
      fiat:        order.ad.fiat,
      orderId:     order.id,
    };
    const buyerName = order.buyer.firstName ?? order.buyer.username ?? "Trader";
    const merchantUser = merchant
      ? await db.user.findUnique({
          where: { id: merchant.userId },
          select: { email: true, firstName: true, username: true },
        })
      : null;
    await waitForEmailDelivery("P2P trade completed", [
      order.buyer.email
        ? sendTradeCompletedEmail(order.buyer.email, buyerName, {
            ...emailOpts,
            role: isMerchantSell ? "cryptoReceiver" : "cryptoSender",
          })
        : null,
      merchantUser?.email
        ? sendTradeCompletedEmail(
            merchantUser.email,
            merchantUser.firstName ?? merchantUser.username ?? merchant!.displayName,
            {
              ...emailOpts,
              role: isMerchantSell ? "cryptoSender" : "cryptoReceiver",
            },
          )
        : null,
    ]);

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
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message === "INSUFFICIENT_CRYPTO_BALANCE") {
      return Response.json({
        error: "This legacy order has no funded escrow. Add enough crypto to your wallet, then release again.",
      }, { status: 409 });
    }
    if (message === "INSUFFICIENT_LOCKED_CRYPTO") {
      return Response.json({ error: "The seller's locked crypto is no longer available." }, { status: 409 });
    }
    if (message === "ORDER_ALREADY_PROCESSED") {
      return Response.json({ error: "This order has already been processed. Refreshing the order." }, { status: 409 });
    }
    console.error("POST /api/p2p/orders/[id]/release:", message);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
