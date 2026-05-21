import { db } from "@/lib/db";
import { generateServerSeed, hashServerSeed, generateCrashPoint } from "@/lib/aviator/fair";
import { AviatorRoundState } from "@prisma/client";

export type RoundWithBets = NonNullable<Awaited<ReturnType<typeof db.aviatorRound.findFirst<{
  include: { bets: { include: { user: { select: { id: true; username: true } } } } }
}>>>>;

export function serializeRound(round: RoundWithBets) {
  const isCrashed = round.state === AviatorRoundState.CRASHED;
  const bets = round.bets.map((b) => ({
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
  }));
  return {
    round: {
      id:              round.id,
      roundNumber:     round.roundNumber,
      serverSeedHash:  round.serverSeedHash,
      serverSeed:      isCrashed ? round.serverSeed : undefined,
      crashPoint:      isCrashed ? Number(round.crashPoint) : undefined,
      state:           round.state,
      bettingEndsAt:   round.bettingEndsAt?.toISOString()   ?? null,
      flyingStartedAt: round.flyingStartedAt?.toISOString() ?? null,
      crashedAt:       round.crashedAt?.toISOString()       ?? null,
      createdAt:       round.createdAt.toISOString(),
    },
    bets,
  };
}

export async function createNewRound() {
  const serverSeed = generateServerSeed();
  const serverSeedHash = hashServerSeed(serverSeed);
  const waitingEndsAt = new Date(Date.now() + 5_000);

  const round = await db.aviatorRound.create({
    data: {
      serverSeed,
      serverSeedHash,
      crashPoint:    0,
      state:         "WAITING",
      bettingEndsAt: new Date(waitingEndsAt.getTime() + 10_000),
    },
    include: {
      bets: {
        include: { user: { select: { id: true, username: true } } },
      },
    },
  });

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
