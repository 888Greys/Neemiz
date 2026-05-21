import { db } from "@/lib/db";
import { getMultiplier, generateServerSeed, hashServerSeed, generateCrashPoint } from "@/lib/aviator/fair";
import { AviatorRoundState, TransactionType, TransactionStatus } from "@prisma/client";
import { createNewRound } from "@/app/api/aviator/state/route";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";

/**
 * POST /api/aviator/tick
 *
 * Called by every connected client every 500ms.
 * Idempotent state machine — advances round state when transitions are due.
 * Also processes auto-cashouts atomically.
 * Returns the current serialized round state.
 */

const supabaseAdmin = createSupabaseAdmin(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function broadcast(event: string, payload: unknown) {
  try {
    await supabaseAdmin.channel("aviator").send({
      type:    "broadcast",
      event,
      payload: payload as Record<string, unknown>,
    });
  } catch {
    // Non-critical — clients also poll state directly
  }
}

export async function POST() {
  const now = new Date();

  // Find the most recent non-completed round
  const round = await db.aviatorRound.findFirst({
    where:   { state: { not: AviatorRoundState.CRASHED } },
    orderBy: { createdAt: "desc" },
    include: {
      bets: {
        where:   { status: "ACTIVE" },
        include: { user: { select: { id: true, username: true } } },
      },
    },
  });

  // No active round — create the next one
  if (!round) {
    const newRound = await createNewRound();
    await broadcast("round:state", { state: "WAITING", roundId: newRound.id });
    return Response.json({ ok: true, state: "WAITING" });
  }

  // ── WAITING → BETTING ──────────────────────────────────────────────────────
  if (round.state === AviatorRoundState.WAITING) {
    const waitingEndsAt = new Date(round.createdAt.getTime() + 5_000);
    if (now < waitingEndsAt) {
      return Response.json({ ok: true, state: "WAITING", waitingEndsAt: waitingEndsAt.toISOString() });
    }

    // Transition to BETTING (idempotent: only if still WAITING)
    const updated = await db.aviatorRound.updateMany({
      where: { id: round.id, state: AviatorRoundState.WAITING },
      data:  { state: AviatorRoundState.BETTING },
    });
    if (updated.count > 0) {
      await broadcast("round:state", { state: "BETTING", roundId: round.id, bettingEndsAt: round.bettingEndsAt?.toISOString() });
    }
    return Response.json({ ok: true, state: "BETTING" });
  }

  // ── BETTING → FLYING ───────────────────────────────────────────────────────
  if (round.state === AviatorRoundState.BETTING) {
    if (!round.bettingEndsAt || now < round.bettingEndsAt) {
      return Response.json({ ok: true, state: "BETTING", bettingEndsAt: round.bettingEndsAt?.toISOString() });
    }

    const flyingStartedAt = new Date();
    const updated = await db.aviatorRound.updateMany({
      where: { id: round.id, state: AviatorRoundState.BETTING },
      data:  { state: AviatorRoundState.FLYING, flyingStartedAt },
    });
    if (updated.count > 0) {
      await broadcast("round:state", { state: "FLYING", roundId: round.id, flyingStartedAt: flyingStartedAt.toISOString() });
    }
    return Response.json({ ok: true, state: "FLYING", flyingStartedAt: flyingStartedAt.toISOString() });
  }

  // ── FLYING — process auto-cashouts + check crash ───────────────────────────
  if (round.state === AviatorRoundState.FLYING) {
    const flyingStartedAt = round.flyingStartedAt!;
    const currentMult     = getMultiplier(flyingStartedAt);
    const crashPoint      = Number(round.crashPoint);

    // Process auto-cashouts for bets where autoCashout ≤ currentMult
    const autoCashoutBets = round.bets.filter(
      (b) => b.autoCashout !== null && Number(b.autoCashout) <= currentMult,
    );

    for (const bet of autoCashoutBets) {
      const cashoutMult = Number(bet.autoCashout!);
      const winAmount   = parseFloat((Number(bet.betAmount) * cashoutMult).toFixed(2));

      await db.$transaction(async (tx) => {
        const result = await tx.aviatorBet.updateMany({
          where: { id: bet.id, status: "ACTIVE" }, // guard against double-cashout
          data:  { status: "CASHEDOUT", cashoutAt: cashoutMult, winAmount },
        });
        if (result.count === 0) return; // already processed

        await tx.user.update({
          where: { id: bet.userId },
          data:  { walletBalance: { increment: winAmount } },
        });

        await tx.transaction.create({
          data: {
            userId:    bet.userId,
            type:      TransactionType.BET_WIN,
            amount:    winAmount,
            currency:  "KES",
            status:    TransactionStatus.COMPLETED,
            reference: `aviator-win-${bet.id}`,
            metadata:  { game: "aviator", roundId: round.id, multiplier: cashoutMult, auto: true },
          },
        });
      });

      await broadcast("bet:cashedout", {
        betId:      bet.id,
        userId:     bet.userId,
        username:   bet.user.username,
        cashoutAt:  cashoutMult,
        winAmount,
        panelIndex: bet.panelIndex,
        auto:       true,
      });
    }

    // Check if crash is due
    if (currentMult >= crashPoint) {
      const crashedAt = new Date();
      const updated   = await db.aviatorRound.updateMany({
        where: { id: round.id, state: AviatorRoundState.FLYING },
        data:  { state: AviatorRoundState.CRASHED, crashedAt },
      });

      if (updated.count > 0) {
        // Mark all remaining ACTIVE bets as LOST
        await db.aviatorBet.updateMany({
          where: { roundId: round.id, status: "ACTIVE" },
          data:  { status: "LOST" },
        });

        await broadcast("round:crashed", {
          roundId:    round.id,
          crashPoint,
          serverSeed: round.serverSeed,
          crashedAt:  crashedAt.toISOString(),
        });
      }

      return Response.json({ ok: true, state: "CRASHED", crashPoint, multiplier: currentMult });
    }

    return Response.json({ ok: true, state: "FLYING", multiplier: currentMult });
  }

  // ── CRASHED → next WAITING ─────────────────────────────────────────────────
  if (round.state === AviatorRoundState.CRASHED) {
    const crashedAt     = round.crashedAt!;
    const nextRoundAt   = new Date(crashedAt.getTime() + 3_000); // 3s pause
    if (now < nextRoundAt) {
      return Response.json({ ok: true, state: "CRASHED" });
    }

    const newRound = await createNewRound();
    await broadcast("round:state", { state: "WAITING", roundId: newRound.id, roundNumber: newRound.roundNumber });
    return Response.json({ ok: true, state: "WAITING", newRoundId: newRound.id });
  }

  return Response.json({ ok: true, state: round.state });
}
