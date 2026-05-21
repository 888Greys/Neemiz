import { db } from "@/lib/db";
import { generateServerSeed, hashServerSeed, generateCrashPoint } from "@/lib/aviator/fair";
import { AviatorRoundState } from "@prisma/client";

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

  // If no active round, grab the most recent CRASHED round (for history display)
  // or create the very first round
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
      // First ever round — create it now
      round = await createNewRound();
    } else {
      // A CRASHED round with no successor yet — the tick will create the next one
      round = lastCrashed as unknown as typeof round;
    }
  }

  return Response.json(serializeRound(round!));
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

type RoundWithBets = NonNullable<Awaited<ReturnType<typeof db.aviatorRound.findFirst<{
  include: { bets: { include: { user: { select: { id: true; username: true } } } } }
}>>>>;

export function serializeRound(round: RoundWithBets) {
  const isCrashed = round.state === AviatorRoundState.CRASHED;
  return {
    roundId:        round.id,
    roundNumber:    round.roundNumber,
    serverSeedHash: round.serverSeedHash,
    serverSeed:     isCrashed ? round.serverSeed : undefined, // reveal only after crash
    crashPoint:     isCrashed ? Number(round.crashPoint)     : undefined,
    state:          round.state,
    bettingEndsAt:  round.bettingEndsAt?.toISOString()  ?? null,
    flyingStartedAt:round.flyingStartedAt?.toISOString() ?? null,
    crashedAt:      round.crashedAt?.toISOString()       ?? null,
    createdAt:      round.createdAt.toISOString(),
    bets: round.bets.map((b) => ({
      id:          b.id,
      roundId:     b.roundId,
      userId:      b.userId,
      username:    b.user.username,
      panelIndex:  b.panelIndex,
      betAmount:   Number(b.betAmount),
      autoCashout: b.autoCashout ? Number(b.autoCashout) : null,
      cashoutAt:   b.cashoutAt  ? Number(b.cashoutAt)   : null,
      winAmount:   b.winAmount  ? Number(b.winAmount)   : null,
      status:      b.status,
      placedAt:    b.placedAt.toISOString(),
    })),
  };
}

export async function createNewRound() {
  const serverSeed = generateServerSeed();
  const serverSeedHash = hashServerSeed(serverSeed);
  const waitingEndsAt  = new Date(Date.now() + 5_000); // 5s WAITING

  // Create with WAITING state; crash point is generated but hidden
  const round = await db.aviatorRound.create({
    data: {
      serverSeed,
      serverSeedHash,
      crashPoint:   0, // placeholder — set once we know roundId
      state:        "WAITING",
      bettingEndsAt: new Date(waitingEndsAt.getTime() + 10_000), // after waiting + 10s betting
    },
    include: {
      bets: {
        include: { user: { select: { id: true, username: true } } },
      },
    },
  });

  // Now we know the roundId — generate the true crash point
  const crashPoint = generateCrashPoint(serverSeed, round.id);
  const updated = await db.aviatorRound.update({
    where: { id: round.id },
    data:  { crashPoint },
    include: {
      bets: {
        include: { user: { select: { id: true, username: true } } },
      },
    },
  });

  return updated;
}
