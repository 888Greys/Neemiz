import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

function isFeedbackSchemaMissing(error: unknown) {
  return typeof error === "object"
    && error !== null
    && "code" in error
    && (error.code === "P2021" || error.code === "P2022");
}

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
    let feedbackCount = 0;
    let feedbackAverage = 0;
    let positiveFeedbackRate = 0;
    let feedback: Array<{
      id: string;
      rating: number;
      comment: string | null;
      createdAt: string;
      fromUser: { displayName: string; imageUrl: string | null };
    }> = [];

    try {
      const [feedbackSummary, feedbackRows, positiveCount] = await Promise.all([
        db.p2PFeedback.aggregate({
          where: { toUserId: merchant.userId },
          _count: { _all: true },
          _avg: { rating: true },
        }),
        db.p2PFeedback.findMany({
          where: { toUserId: merchant.userId },
          orderBy: { createdAt: "desc" },
          take: 20,
          select: {
            id: true,
            rating: true,
            comment: true,
            createdAt: true,
            fromUser: {
              select: {
                firstName: true,
                lastName: true,
                username: true,
                imageUrl: true,
              },
            },
          },
        }),
        db.p2PFeedback.count({
          where: { toUserId: merchant.userId, rating: { gte: 4 } },
        }),
      ]);
      feedbackCount = feedbackSummary._count._all;
      feedbackAverage = Number(feedbackSummary._avg.rating ?? 0);
      positiveFeedbackRate = feedbackCount > 0 ? (positiveCount / feedbackCount) * 100 : 0;
      feedback = feedbackRows.map((item) => ({
        id: item.id,
        rating: item.rating,
        comment: item.comment,
        createdAt: item.createdAt.toISOString(),
        fromUser: {
          displayName: item.fromUser.firstName
            ? `${item.fromUser.firstName} ${item.fromUser.lastName ?? ""}`.trim()
            : item.fromUser.username ?? "Trader",
          imageUrl: item.fromUser.imageUrl,
        },
      }));
    } catch (error) {
      if (!isFeedbackSchemaMissing(error)) throw error;
    }

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
      feedbackCount,
      feedbackAverage,
      positiveFeedbackRate,
      feedback,
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
