import { db } from "@/lib/db";

// GET /api/p2p/stats — public platform stats for the P2P browse page
export async function GET() {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      volumeToday,
      onlineMerchants,
      releaseStats,
    ] = await Promise.all([
      // Total fiat traded today (RELEASED orders only)
      db.p2POrder.aggregate({
        _sum: { fiatAmount: true },
        where: {
          status:    "RELEASED",
          releasedAt: { gte: today },
        },
      }),

      // Merchants currently online (verified + online)
      db.merchantProfile.count({
        where: { isVerified: true, isOnline: true },
      }),

      // Average release time across all completed trades
      db.merchantProfile.aggregate({
        _avg: { avgReleaseTime: true },
        where: { isVerified: true, completedTrades: { gt: 0 } },
      }),
    ]);

    const volumeKes    = Number(volumeToday._sum.fiatAmount ?? 0);
    const avgRelease   = Math.round(releaseStats._avg.avgReleaseTime ?? 0);

    return Response.json({
      volumeToday:    volumeKes,
      onlineMerchants,
      avgReleaseMin:  avgRelease,
      feePct:         0,
    });
  } catch (err) {
    console.error("GET /api/p2p/stats:", err instanceof Error ? err.message : "Unknown error");
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
