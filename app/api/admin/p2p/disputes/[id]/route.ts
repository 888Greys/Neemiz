import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/get-or-create-user";
import {
  creditUserCrypto,
  defaultNetwork,
  isKesCoin,
  kesLockAmount,
  kesPayoutAmount,
  recordKesWalletMovement,
  releaseKesCoinBalance,
  unlockKesCoinBalance,
  unlockUserCrypto,
} from "@/lib/p2p/crypto-balance";
import { sendP2POrderStatusEmail, waitForEmailDelivery } from "@/lib/brevo";

// GET /api/admin/p2p/disputes/[id] — full dispute incl. message history.
// Kept separate from the list endpoint so the list stays lightweight.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await getOrCreateUser(user.id, { email: user.email });
  if (!dbUser.isAdmin) return Response.json({ error: "Forbidden" }, { status: 403 });

  const dispute = await db.p2PDispute.findUnique({
    where: { id },
    select: {
      id: true,
      reason: true,
      status: true,
      createdAt: true,
      evidence: true,
      order: {
        select: {
          id: true,
          crypto: true,
          cryptoAmount: true,
          fiatAmount: true,
          paymentRef: true,
          paymentProofUrl: true,
          ad: { select: { side: true, fiat: true } },
          buyer: { select: { id: true, firstName: true, lastName: true, username: true } },
          seller: { select: { displayName: true, userId: true } },
          messages: {
            orderBy: { createdAt: "asc" },
            take: 200,
            select: {
              id: true,
              content: true,
              imageUrl: true,
              createdAt: true,
              senderId: true,
              sender: { select: { firstName: true, lastName: true, username: true } },
            },
          },
        },
      },
    },
  });
  if (!dispute) return Response.json({ error: "Dispute not found" }, { status: 404 });
  return Response.json(dispute);
}

const DEFAULT_PROOF_REQUEST =
  "🛡️ Support: Please upload clear proof of payment for this order (M-Pesa confirmation message or bank transfer slip showing the reference, amount and time). We need this from both sides to resolve the dispute fairly.";

// PATCH /api/admin/p2p/disputes/[id] — post an admin message into the order
// chat (e.g. requesting payment proof from both parties). Visible to buyer and
// seller in their normal order chat, and pings both with a notification.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await getOrCreateUser(user.id, { email: user.email });
  if (!dbUser.isAdmin) return Response.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const message = typeof body.message === "string" && body.message.trim()
    ? body.message.trim()
    : DEFAULT_PROOF_REQUEST;
  if (message.length > 2000) {
    return Response.json({ error: "Message is too long" }, { status: 400 });
  }

  const dispute = await db.p2PDispute.findUnique({
    where: { id },
    select: {
      order: { select: { id: true, buyerId: true, seller: { select: { userId: true } } } },
    },
  });
  if (!dispute) return Response.json({ error: "Dispute not found" }, { status: 404 });

  const { order } = dispute;
  const orderRef = `#${order.id.slice(0, 8).toUpperCase()}`;

  const created = await db.p2PMessage.create({
    data: { orderId: order.id, senderId: dbUser.id, content: message },
    select: {
      id: true,
      content: true,
      imageUrl: true,
      createdAt: true,
      senderId: true,
      sender: { select: { firstName: true, lastName: true, username: true } },
    },
  });

  await db.notification.createMany({
    data: [order.buyerId, order.seller.userId].map((userId) => ({
      userId,
      type: "p2p_dispute",
      title: `Action needed on dispute ${orderRef}`,
      body: message.slice(0, 160),
      link: `/p2p/order/${order.id}`,
    })),
  });

  return Response.json({ ok: true, message: created });
}

// POST /api/admin/p2p/disputes/[id] — resolve a dispute
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await getOrCreateUser(user.id, { email: user.email });
  if (!dbUser.isAdmin) return Response.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { resolution, note } = body as { resolution: "CRYPTO_BUYER_WINS" | "CRYPTO_SELLER_WINS"; note: string };

  if (!["CRYPTO_BUYER_WINS", "CRYPTO_SELLER_WINS"].includes(resolution)) {
    return Response.json({ error: "Invalid dispute resolution." }, { status: 400 });
  }
  if (typeof note !== "string" || !note.trim()) {
    return Response.json({ error: "A resolution note is required." }, { status: 400 });
  }

  const dispute = await db.p2PDispute.findUnique({
    where: { id },
    include: {
      order: {
        select: {
          id: true,
          adId: true,
          buyerId: true,
          crypto: true,
          cryptoAmount: true,
          fiatAmount: true,
          createdAt: true,
          ad: { select: { side: true } },
          buyer: { select: { email: true, firstName: true, username: true } },
          seller: {
            select: {
              id: true,
              userId: true,
              displayName: true,
              totalTrades: true,
              completedTrades: true,
              avgReleaseTime: true,
              user: { select: { email: true, firstName: true, username: true } },
            },
          },
        },
      },
    },
  });
  if (!dispute) return Response.json({ error: "Dispute not found" }, { status: 404 });
  if (dispute.status !== "OPEN") return Response.json({ error: "Dispute is not open" }, { status: 400 });

  const { order } = dispute;
  const buyerId = order.buyerId;
  const sellerUserId = order.seller.userId;
  const orderRef = `#${order.id.slice(0, 8).toUpperCase()}`;
  const cryptoAmt = Number(order.cryptoAmount);
  const kesGiverUserId = order.ad.side === "SELL" ? sellerUserId : buyerId;
  const kesReceiverUserId = order.ad.side === "SELL" ? buyerId : sellerUserId;
  const cryptoBuyerUserId = kesReceiverUserId;
  const cryptoSellerUserId = kesGiverUserId;
  const cryptoBuyerWins = resolution === "CRYPTO_BUYER_WINS";
  const network = defaultNetwork(order.crypto);
  const netCryptoAmt = parseFloat((cryptoAmt * 0.98).toFixed(8));
  const releaseTime = Math.round((Date.now() - new Date(order.createdAt).getTime()) / 60000);

  await db.$transaction(async (tx) => {
    const claimed = await tx.p2PDispute.updateMany({
      where: { id, status: "OPEN", order: { status: "DISPUTED" } },
      data: {
        status: "RESOLVED",
        resolution: `${resolution}: ${note.trim()}`,
        resolvedAt: new Date(),
      },
    });
    if (claimed.count === 0) throw new Error("DISPUTE_ALREADY_RESOLVED");

    if (!cryptoBuyerWins) {
      // Cancel the order
      await tx.p2POrder.update({
        where: { id: order.id },
        data: { status: "CANCELLED" },
      });
      await tx.p2PAd.update({
        where: { id: order.adId },
        data:  { availableAmount: { increment: cryptoAmt } },
      });

      if (isKesCoin(order.crypto)) {
        const refundAmount = kesLockAmount(cryptoAmt);
        await unlockKesCoinBalance(tx, kesGiverUserId, refundAmount);
        await recordKesWalletMovement(tx, {
          userId: kesGiverUserId,
          amount: refundAmount,
          action: "refund",
          orderId: order.id,
          role: "giver",
        });
      } else if (order.ad.side === "BUY") {
        await unlockUserCrypto(tx, buyerId, order.crypto, defaultNetwork(order.crypto), cryptoAmt);
      }

    } else {
      // Release the locked crypto to the economic crypto buyer.
      await tx.p2POrder.update({
        where: { id: order.id },
        data: { status: "RELEASED", escrowReleased: true, releasedAt: new Date() },
      });

      if (isKesCoin(order.crypto)) {
        const payoutAmount = kesPayoutAmount(cryptoAmt);
        await releaseKesCoinBalance(tx, kesGiverUserId, kesReceiverUserId, kesLockAmount(cryptoAmt), payoutAmount);
        await recordKesWalletMovement(tx, {
          userId: kesReceiverUserId,
          amount: payoutAmount,
          action: "release",
          orderId: order.id,
          role: "receiver",
        });
      } else {
        if (order.ad.side === "SELL") {
          const debited = await tx.p2PCryptoBalance.updateMany({
            where: { merchantId: order.seller.id, crypto: order.crypto, locked: { gte: cryptoAmt }, total: { gte: cryptoAmt } },
            data: { locked: { decrement: cryptoAmt }, total: { decrement: cryptoAmt } },
          });
          if (debited.count === 0) throw new Error("INSUFFICIENT_LOCKED_CRYPTO");
          await creditUserCrypto(tx, buyerId, order.crypto, network, netCryptoAmt);
        } else {
          const unlocked = await tx.userCryptoBalance.updateMany({
            where: { userId: buyerId, crypto: order.crypto, network, locked: { gte: cryptoAmt } },
            data: { locked: { decrement: cryptoAmt } },
          });
          if (unlocked.count === 0) throw new Error("INSUFFICIENT_LOCKED_CRYPTO");
          await tx.p2PCryptoBalance.upsert({
            where: { merchantId_crypto: { merchantId: order.seller.id, crypto: order.crypto } },
            create: { merchantId: order.seller.id, crypto: order.crypto, total: netCryptoAmt, available: netCryptoAmt, locked: 0 },
            update: { total: { increment: netCryptoAmt }, available: { increment: netCryptoAmt } },
          });
        }
      }
      const newTotal = order.seller.totalTrades + 1;
      const newCompleted = order.seller.completedTrades + 1;
      await tx.merchantProfile.update({
        where: { id: order.seller.id },
        data: {
          totalTrades: newTotal,
          completedTrades: newCompleted,
          completionRate: (newCompleted / newTotal) * 100,
          avgReleaseTime: Math.round((order.seller.avgReleaseTime * order.seller.completedTrades + releaseTime) / newCompleted),
        },
      });
    }

    await tx.notification.createMany({
      data: [buyerId, sellerUserId].map((userId) => ({
        userId,
        type: "p2p_dispute",
        title: cryptoBuyerWins ? "Dispute resolved — crypto released" : "Dispute resolved — order cancelled",
        body: `${cryptoBuyerWins ? "The crypto buyer" : "The crypto seller"} won dispute ${orderRef}. Admin note: ${note.trim()}`,
        link: `/p2p/order/${order.id}`,
      })),
    });
  });

  const winnerName = cryptoBuyerWins ? "crypto buyer" : "crypto seller";
  await waitForEmailDelivery("P2P dispute resolution", [
    order.buyer.email
      ? sendP2POrderStatusEmail(order.buyer.email, order.buyer.firstName ?? order.buyer.username ?? "Trader", {
          orderId: order.id,
          subject: `P2P dispute resolved ${orderRef}`,
          title: "Dispute resolved",
          message: `The ${winnerName} won this dispute. Admin note: ${note.trim()}`,
          crypto: order.crypto,
          cryptoAmount: cryptoAmt,
          fiat: "KES",
          fiatAmount: Number(order.fiatAmount),
          accent: cryptoBuyerWins ? "#22c55e" : "#f59e0b",
          actionLabel: "View Order →",
        })
      : null,
    order.seller.user.email
      ? sendP2POrderStatusEmail(order.seller.user.email, order.seller.user.firstName ?? order.seller.user.username ?? order.seller.displayName, {
          orderId: order.id,
          subject: `P2P dispute resolved ${orderRef}`,
          title: "Dispute resolved",
          message: `The ${winnerName} won this dispute. Admin note: ${note.trim()}`,
          crypto: order.crypto,
          cryptoAmount: cryptoAmt,
          fiat: "KES",
          fiatAmount: Number(order.fiatAmount),
          accent: cryptoBuyerWins ? "#22c55e" : "#f59e0b",
          actionLabel: "View Order →",
        })
      : null,
  ]);

  return Response.json({ ok: true, resolution });
}
