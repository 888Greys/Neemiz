import { db } from "@/lib/db";

/**
 * GET /api/aviator/history
 *
 * Returns the last 30 crashed rounds for the history strip + my bets tab.
 * Includes optional userId query param to also return that user's bets.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");

  const rounds = await db.aviatorRound.findMany({
    where:   { state: "CRASHED" },
    orderBy: { createdAt: "desc" },
    take:    30,
    select: {
      id:          true,
      roundNumber: true,
      crashPoint:  true,
      crashedAt:   true,
      serverSeed:  true,
      serverSeedHash: true,
      bets: userId
        ? {
            where:   { userId },
            select:  {
              id:         true,
              panelIndex: true,
              betAmount:  true,
              cashoutAt:  true,
              winAmount:  true,
              status:     true,
              placedAt:   true,
            },
          }
        : false,
    },
  });

  return Response.json(
    rounds.map((r) => ({
      roundId:     r.id,
      roundNumber: r.roundNumber,
      crashPoint:  Number(r.crashPoint),
      crashedAt:   r.crashedAt?.toISOString() ?? null,
      serverSeed:  r.serverSeed,
      serverSeedHash: r.serverSeedHash,
      myBets: userId && Array.isArray(r.bets)
        ? (r.bets as Array<{
            id: string; panelIndex: number; betAmount: unknown;
            cashoutAt: unknown; winAmount: unknown; status: string; placedAt: Date;
          }>).map((b) => ({
            id:         b.id,
            panelIndex: b.panelIndex,
            betAmount:  Number(b.betAmount),
            cashoutAt:  b.cashoutAt ? Number(b.cashoutAt) : null,
            winAmount:  b.winAmount ? Number(b.winAmount) : null,
            status:     b.status,
            placedAt:   b.placedAt.toISOString(),
          }))
        : undefined,
    })),
  );
}
