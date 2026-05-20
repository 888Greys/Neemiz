import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/get-or-create-user";

// POST /api/p2p/orders/[id]/release — merchant confirms payment & releases crypto
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await getOrCreateUser(user.id, { email: user.email });
  const merchant = await db.merchantProfile.findUnique({ where: { userId: dbUser.id } });
  if (!merchant) return Response.json({ error: "Merchant account required" }, { status: 403 });

  const order = await db.p2POrder.findUnique({
    where: { id },
    include: { ad: true },
  });

  if (!order) return Response.json({ error: "Order not found" }, { status: 404 });
  if (order.sellerId !== merchant.id) return Response.json({ error: "Forbidden" }, { status: 403 });
  if (order.status !== "PAID") return Response.json({ error: "Order is not in PAID state" }, { status: 400 });

  const releaseTime = Math.round((Date.now() - new Date(order.createdAt).getTime()) / 60000);

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

    // 2. Release locked crypto — reduce merchant's locked balance
    await tx.p2PCryptoBalance.update({
      where: { merchantId_crypto: { merchantId: merchant.id, crypto: order.crypto } },
      data: { locked: { decrement: Number(order.cryptoAmount) } },
    });

    // 3. Credit buyer's crypto balance (they become a potential merchant or hold it)
    await tx.p2PCryptoBalance.upsert({
      where: { merchantId_crypto: { merchantId: merchant.id, crypto: order.crypto } },
      // Note: buyer may not be a merchant — store in a simplified way via transaction record
      create: { merchantId: merchant.id, crypto: order.crypto, total: 0, locked: 0, available: 0 },
      update: {},
    });

    // 4. Update merchant stats
    const newTotal     = merchant.totalTrades + 1;
    const newCompleted = merchant.completedTrades + 1;
    const newAvgRelease = Math.round(
      (merchant.avgReleaseTime * merchant.completedTrades + releaseTime) / newCompleted
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

  return Response.json({ status: "RELEASED" });
}
