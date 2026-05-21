import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/get-or-create-user";
import { creditUserCrypto, defaultNetwork } from "@/lib/p2p/crypto-balance";

// POST /api/p2p/orders/[id]/release — merchant confirms fiat received & releases crypto
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser   = await getOrCreateUser(user.id, { email: user.email });
  const merchant = await db.merchantProfile.findUnique({ where: { userId: dbUser.id } });
  if (!merchant) return Response.json({ error: "Merchant account required" }, { status: 403 });

  const order = await db.p2POrder.findUnique({
    where: { id },
    include: { ad: true },
  });

  if (!order)                         return Response.json({ error: "Order not found" }, { status: 404 });
  if (order.sellerId !== merchant.id) return Response.json({ error: "Forbidden" }, { status: 403 });
  if (order.status !== "PAID")        return Response.json({ error: "Order is not in PAID state" }, { status: 400 });

  const cryptoAmt   = Number(order.cryptoAmount);
  const network     = defaultNetwork(order.crypto);
  const releaseTime = Math.round((Date.now() - new Date(order.createdAt).getTime()) / 60000);

  await db.$transaction(async (tx) => {
    // 1. Mark order RELEASED
    await tx.p2POrder.update({
      where: { id },
      data: {
        status:         "RELEASED",
        escrowReleased: true,
        releasedAt:     new Date(),
      },
    });

    // 2. Remove crypto from merchant's balance (locked + total — it leaves the platform custody)
    await tx.p2PCryptoBalance.update({
      where: { merchantId_crypto: { merchantId: merchant.id, crypto: order.crypto } },
      data: {
        locked: { decrement: cryptoAmt },
        total:  { decrement: cryptoAmt },
      },
    });

    // 3. Credit buyer's UserCryptoBalance — works for any user, merchant or not
    await creditUserCrypto(tx, order.buyerId, order.crypto, network, cryptoAmt);

    // 4. Update merchant trade stats
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

  // Notify buyer
  await db.notification.create({
    data: {
      userId: order.buyerId,
      type:   "p2p_released",
      title:  `${order.crypto} credited to your account`,
      body:   `${cryptoAmt.toFixed(6)} ${order.crypto} from order #${order.id.slice(0, 8).toUpperCase()} is now in your Nezeem wallet.`,
      link:   `/p2p/order/${order.id}`,
    },
  });

  return Response.json({ status: "RELEASED" });
}
