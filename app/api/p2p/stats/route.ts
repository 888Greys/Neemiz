import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET /api/p2p/stats — public platform stats for the P2P browse page
export async function GET() {
  try {
    // Rolling 24h window — used for volume until we switch the trade counter back.
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [
      volume24hAgg,
      onlineMerchants,
      releaseStats,
      tradesAllTime,
      trades24h,
      activeOffers,
    ] = await Promise.all([
      // Total fiat traded in the last 24h (RELEASED orders only)
      db.p2POrder.aggregate({
        _sum: { fiatAmount: true },
        where: { status: "RELEASED", releasedAt: { gte: since } },
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

      // All-time completed trades — shown on the browse page while traffic is low.
      // Flip the UI back to trades24h once daily volume is healthy.
      db.p2POrder.count({
        where: { status: "RELEASED" },
      }),

      // Trades completed in the last 24h (kept for a future switch-back)
      db.p2POrder.count({
        where: { status: "RELEASED", releasedAt: { gte: since } },
      }),

      // Offers currently tradable
      db.p2PAd.count({
        where: { isActive: true, availableAmount: { gt: 0 } },
      }),
    ]);

    const avgRelease = Math.round(releaseStats._avg.avgReleaseTime ?? 0);

    return Response.json({
      volume24h:      Number(volume24hAgg._sum.fiatAmount ?? 0),
      tradesAllTime,
      trades24h,
      // Prefer all-time on the public browse strip for now.
      trades:         tradesAllTime,
      activeOffers,
      onlineMerchants,
      avgReleaseMin:  avgRelease,
      feePct:         0,
    }, { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" } });
  } catch (err) {
    console.error("GET /api/p2p/stats:", err instanceof Error ? err.message : "Unknown error");
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
