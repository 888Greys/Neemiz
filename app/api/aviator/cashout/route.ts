import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/get-or-create-user";
import { getMultiplier } from "@/lib/aviator/fair";
import { TransactionType, TransactionStatus } from "@prisma/client";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";

const supabaseAdmin = createSupabaseAdmin(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

/**
 * POST /api/aviator/cashout
 * Body: { panelIndex: 0 | 1 }
 *
 * Cashes out the player's active bet at the current multiplier.
 * Idempotent: if already cashed out, returns 409.
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let body: { panelIndex: 0 | 1 };
  try   { body = await req.json(); }
  catch { return Response.json({ error: "Invalid request body" }, { status: 400 }); }

  const { panelIndex } = body;
  if (panelIndex !== 0 && panelIndex !== 1) {
    return Response.json({ error: "panelIndex must be 0 or 1" }, { status: 400 });
  }

  const dbUser = await getOrCreateUser(user.id, { email: user.email });

  // ── Find current FLYING round ─────────────────────────────────────────────
  const round = await db.aviatorRound.findFirst({
    where:   { state: "FLYING" },
    orderBy: { createdAt: "desc" },
  });

  if (!round || !round.flyingStartedAt) {
    return Response.json({ error: "No active round to cash out" }, { status: 409 });
  }

  // Capture multiplier immediately (before any DB round-trips)
  const cashoutMult = getMultiplier(round.flyingStartedAt);
  const crashPoint  = Number(round.crashPoint);

  // If we're already past crash, don't allow cashout
  if (cashoutMult >= crashPoint) {
    return Response.json({ error: "Too late — plane already crashed" }, { status: 409 });
  }

  // Find the active bet
  const bet = await db.aviatorBet.findUnique({
    where: { roundId_userId_panelIndex: { roundId: round.id, userId: dbUser.id, panelIndex } },
  });

  if (!bet) {
    return Response.json({ error: "No active bet on this panel" }, { status: 404 });
  }
  if (bet.status !== "ACTIVE") {
    return Response.json({ error: "Bet already settled" }, { status: 409 });
  }

  const betAmount = Number(bet.betAmount);
  const winAmount = parseFloat((betAmount * cashoutMult).toFixed(2));

  // ── Atomic: cashout bet + credit winnings ─────────────────────────────────
  try {
    await db.$transaction(async (tx) => {
      const result = await tx.aviatorBet.updateMany({
        where: { id: bet.id, status: "ACTIVE" }, // guard: only if still ACTIVE
        data:  { status: "CASHEDOUT", cashoutAt: cashoutMult, winAmount },
      });

      if (result.count === 0) throw new Error("ALREADY_SETTLED");

      await tx.user.update({
        where: { id: dbUser.id },
        data:  { walletBalance: { increment: winAmount } },
      });

      await tx.transaction.create({
        data: {
          userId:    dbUser.id,
          type:      TransactionType.BET_WIN,
          amount:    winAmount,
          currency:  "KES",
          status:    TransactionStatus.COMPLETED,
          reference: `aviator-win-${bet.id}`,
          metadata:  { game: "aviator", roundId: round.id, multiplier: cashoutMult },
        },
      });
    });
  } catch (err: unknown) {
    if ((err as Error).message === "ALREADY_SETTLED") {
      return Response.json({ error: "Bet already settled" }, { status: 409 });
    }
    console.error("Aviator cashout error:", err);
    return Response.json({ error: "Failed to cash out" }, { status: 500 });
  }

  // ── Broadcast cashout ─────────────────────────────────────────────────────
  try {
    await supabaseAdmin.channel("aviator").send({
      type:    "broadcast",
      event:   "bet:cashedout",
      payload: {
        betId:      bet.id,
        userId:     dbUser.id,
        username:   dbUser.username,
        panelIndex,
        cashoutAt:  cashoutMult,
        winAmount,
        auto:       false,
      },
    });
  } catch { /* non-critical */ }

  return Response.json({
    ok:         true,
    cashoutAt:  cashoutMult,
    winAmount,
    betAmount,
    profit:     parseFloat((winAmount - betAmount).toFixed(2)),
  });
}
