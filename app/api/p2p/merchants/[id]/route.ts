import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const merchant = await db.merchantProfile.findUnique({
      where: { id },
      include: {
        ads: {
          where: { isActive: true, availableAmount: { gt: 0 } },
          select: {
            id: true,
            side: true,
            crypto: true,
            fiat: true,
            pricePerUnit: true,
            availableAmount: true,
            minLimit: true,
            maxLimit: true,
            paymentMethods: true,
          },
          orderBy: { createdAt: "desc" },
          take: 8,
        },
      },
    });

    if (!merchant || !merchant.isVerified) {
      return Response.json({ error: "Merchant not found" }, { status: 404 });
    }

    const paymentRails = Array.from(new Set(merchant.ads.flatMap((ad) => ad.paymentMethods)));

    return Response.json({
      id: merchant.id,
      displayName: merchant.displayName,
      avatarUrl: merchant.avatarUrl,
      isVerified: merchant.isVerified,
      kycStatus: merchant.kycStatus,
      isOnline: !!merchant.lastSeenAt && (Date.now() - new Date(merchant.lastSeenAt).getTime() < 3 * 60 * 1000),
      completedTrades: merchant.completedTrades,
      totalTrades: merchant.totalTrades,
      completionRate: Number(merchant.completionRate),
      avgReleaseTime: merchant.avgReleaseTime,
      joinedAt: merchant.createdAt.toISOString(),
      activeAds: merchant.ads.length,
      paymentRails,
      offers: merchant.ads.map((ad) => ({
        id: ad.id,
        side: ad.side,
        crypto: ad.crypto,
        fiat: ad.fiat,
        pricePerUnit: Number(ad.pricePerUnit),
        availableAmount: Number(ad.availableAmount),
        minLimit: Number(ad.minLimit),
        maxLimit: Number(ad.maxLimit),
        paymentMethods: ad.paymentMethods,
      })),
    });
  } catch (err) {
    console.error("GET /api/p2p/merchants/[id]:", err instanceof Error ? err.message : "Unknown error");
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
