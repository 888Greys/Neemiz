import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/get-or-create-user";
import { TransactionType, TransactionStatus } from "@prisma/client";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";

const MIN_BET = 10;  // KES
const MAX_BET = 50_000; // KES

const supabaseAdmin = createSupabaseAdmin(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

/**
 * POST /api/aviator/bet
 * Body: { betAmount, panelIndex, autoCashout? }
 *
 * Places a bet for the current BETTING round.
 * Atomically deducts balance + creates BET_STAKE transaction + creates AviatorBet.
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let body: { betAmount: number; panelIndex: 0 | 1; autoCashout?: number };
  try   { body = await req.json(); }
  catch { return Response.json({ error: "Invalid request body" }, { status: 400 }); }

  const { betAmount, panelIndex, autoCashout } = body;

  // ── Validation ─────────────────────────────────────────────────────────────
  if (!betAmount || betAmount < MIN_BET) {
    return Response.json({ error: `Minimum bet is KSh ${MIN_BET}` }, { status: 400 });
  }
  if (betAmount > MAX_BET) {
    return Response.json({ error: `Maximum bet is KSh ${MAX_BET.toLocaleString()}` }, { status: 400 });
  }
  if (panelIndex !== 0 && panelIndex !== 1) {
    return Response.json({ error: "panelIndex must be 0 or 1" }, { status: 400 });
  }
  if (autoCashout !== undefined && autoCashout < 1.01) {
    return Response.json({ error: "Auto-cashout must be at least 1.01x" }, { status: 400 });
  }

  const dbUser = await getOrCreateUser(user.id, { email: user.email });

  // ── Find current BETTING round ─────────────────────────────────────────────
  const round = await db.aviatorRound.findFirst({
    where:   { state: "BETTING" },
    orderBy: { createdAt: "desc" },
  });

  if (!round) {
    return Response.json({ error: "Betting is not open right now" }, { status: 409 });
  }

  // Check if already bet on this panel for this round
  const existing = await db.aviatorBet.findUnique({
    where: { roundId_userId_panelIndex: { roundId: round.id, userId: dbUser.id, panelIndex } },
  });
  if (existing) {
    return Response.json({ error: "Already placed a bet on this panel" }, { status: 409 });
  }

  // ── Atomic: deduct balance + create bet ───────────────────────────────────
  let bet;
  try {
    bet = await db.$transaction(async (tx) => {
      const currentUser = await tx.user.findUnique({ where: { id: dbUser.id } });
      if (!currentUser || Number(currentUser.walletBalance) < betAmount) {
        throw new Error("INSUFFICIENT_BALANCE");
      }

      await tx.user.update({
        where: { id: dbUser.id },
        data:  { walletBalance: { decrement: betAmount } },
      });

      await tx.transaction.create({
        data: {
          userId:    dbUser.id,
          type:      TransactionType.BET_STAKE,
          amount:    betAmount,
          currency:  "KES",
          status:    TransactionStatus.COMPLETED,
          reference: `aviator-stake-${dbUser.id}-${round.id}-${panelIndex}`,
          metadata:  { game: "aviator", roundId: round.id, panelIndex },
        },
      });

      return tx.aviatorBet.create({
        data: {
          roundId:    round.id,
          userId:     dbUser.id,
          panelIndex,
          betAmount,
          autoCashout: autoCashout ?? null,
        },
      });
    });
  } catch (err: unknown) {
    if ((err as Error).message === "INSUFFICIENT_BALANCE") {
      return Response.json({ error: "Insufficient balance" }, { status: 400 });
    }
    console.error("Aviator bet error:", err);
    return Response.json({ error: "Failed to place bet" }, { status: 500 });
  }

  // ── Broadcast bet to live panel ────────────────────────────────────────────
  try {
    await supabaseAdmin.channel("aviator").send({
      type:    "broadcast",
      event:   "bet:placed",
      payload: {
        betId:       bet.id,
        roundId:     round.id,
        userId:      dbUser.id,
        username:    dbUser.username,
        panelIndex,
        betAmount,
        autoCashout: autoCashout ?? null,
        status:      "ACTIVE",
        placedAt:    bet.placedAt.toISOString(),
      },
    });
  } catch { /* non-critical */ }

  return Response.json({
    ok:         true,
    betId:      bet.id,
    roundId:    round.id,
    betAmount,
    panelIndex,
    autoCashout: autoCashout ?? null,
  }, { status: 201 });
}
