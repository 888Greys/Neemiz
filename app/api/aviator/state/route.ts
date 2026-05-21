import { db } from "@/lib/db";
import { serializeRound, createNewRound } from "@/lib/aviator/round";

/**
 * GET /api/aviator/state
 *
 * Returns the current round state + all bets for the live panel.
 * If no round exists (first load), creates the first WAITING round.
 * Safe to poll — no auth required.
 */
export async function GET() {
  let round = await db.aviatorRound.findFirst({
    where:   { state: { not: "CRASHED" } },
    orderBy: { createdAt: "desc" },
    include: {
      bets: {
        include: { user: { select: { id: true, username: true } } },
        orderBy: { placedAt: "asc" },
      },
    },
  });

  if (!round) {
    const lastCrashed = await db.aviatorRound.findFirst({
      orderBy: { createdAt: "desc" },
      include: {
        bets: {
          include: { user: { select: { id: true, username: true } } },
          orderBy: { placedAt: "asc" },
        },
      },
    });

    if (!lastCrashed) {
      round = await createNewRound();
    } else {
      round = lastCrashed as unknown as typeof round;
    }
  }

  return Response.json(serializeRound(round!));
}
