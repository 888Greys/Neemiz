import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/get-or-create-user";

// POST /api/p2p/orders/[id]/release — merchant confirms payment & releases crypto to buyer
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

  if (!order)                          return Response.json({ error: "Order not found" }, { status: 404 });
  if (order.sellerId !== merchant.id)  return Response.json({ error: "Forbidden" }, { status: 403 });
  if (order.status !== "PAID")         return Response.json({ error: "Order is not in PAID state" }, { status: 400 });

  const releaseTime = Math.round((Date.now() - new Date(order.createdAt).getTime()) / 60000);

  // Check if buyer also has a merchant profile (so we can credit their on-platform balance)
  const buyerMerchant = await db.merchantProfile.findUnique({ where: { userId: order.buyerId } });

  await db.$transaction(async (tx) => {
    // 1. Mark order released
    await tx.p2POrder.update({
      where: { id },
      data: {
        status:         "RELEASED",
        escrowReleased: true,
        releasedAt:     new Date(),
      },
    });

    // 2. Deduct crypto from merchant's balance entirely (locked + total)
    //    The crypto has physically left the merchant's custody.
    await tx.p2PCryptoBalance.update({
      where: { merchantId_crypto: { merchantId: merchant.id, crypto: order.crypto } },
      data: {
        locked: { decrement: Number(order.cryptoAmount) },
        total:  { decrement: Number(order.cryptoAmount) },
      },
    });

    // 3. If buyer is also a merchant on the platform, credit their crypto balance
    if (buyerMerchant) {
      await tx.p2PCryptoBalance.upsert({
        where: { merchantId_crypto: { merchantId: buyerMerchant.id, crypto: order.crypto } },
        update: { total:     { increment: Number(order.cryptoAmount) },
                  available: { increment: Number(order.cryptoAmount) } },
        create: { merchantId: buyerMerchant.id,
                  crypto:     order.crypto,
                  total:      Number(order.cryptoAmount),
                  locked:     0,
                  available:  Number(order.cryptoAmount) },
      });
    }
    // If buyer is not a merchant, crypto was delivered externally (off-platform bank/wallet transfer).

    // 4. Update seller's trade stats
    const newTotal     = merchant.totalTrades + 1;
    const newCompleted = merchant.completedTrades + 1;
    const newAvgRelease = Math.round(
      (merchant.avgReleaseTime * merchant.completedTrades + releaseTime) / newCompleted
    );
    await tx.merchantProfile.update({
      where: { id: merchant.id },
      data: {
        totalTrades:    newTotal,
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
      title:  `${order.crypto} released`,
      body:   `${Number(order.cryptoAmount).toFixed(6)} ${order.crypto} from order #${order.id.slice(0, 8).toUpperCase()} has been released to you.`,
      link:   `/p2p/order/${order.id}`,
    },
  });

  return Response.json({ status: "RELEASED" });
}
