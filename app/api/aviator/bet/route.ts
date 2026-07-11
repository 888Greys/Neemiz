import { createClient } from "@/lib/supabase/server";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { db } from "@/lib/db";
import { spendForPlay, creditForPlay, type PlaySource } from "@/lib/balance";
import { getOrCreateUser } from "@/lib/get-or-create-user";
import { TransactionStatus, TransactionType } from "@prisma/client";
import { CURRENCY_SYMBOL } from "@/lib/currency";
import {
  callAviatorService,
  type GoAviatorState,
  type GoBetResponse,
} from "@/lib/aviator/service";

const MIN_BET = 10;
const MAX_BET = 10_000;

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const rl = await rateLimit(`aviator-bet:${user.id}`, 30, 60_000);
  if (!rl.ok) return tooManyRequests(rl.retryAfterSec);

  let body: { betAmount: number; panelIndex: 0 | 1; autoCashout?: number };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { betAmount, panelIndex, autoCashout } = body;
  if (!Number.isFinite(betAmount) || betAmount < MIN_BET) {
    return Response.json({ error: `Minimum bet is ${CURRENCY_SYMBOL} ${MIN_BET}` }, { status: 400 });
  }
  if (betAmount > MAX_BET) {
    return Response.json({ error: `Maximum bet is ${CURRENCY_SYMBOL} ${MAX_BET.toLocaleString()}` }, { status: 400 });
  }
  if (panelIndex !== 0 && panelIndex !== 1) {
    return Response.json({ error: "panelIndex must be 0 or 1" }, { status: 400 });
  }
  if (autoCashout !== undefined && autoCashout !== null) {
    return Response.json({ error: "Auto-cashout is temporarily disabled while Aviator uses the new engine" }, { status: 400 });
  }

  const state = await callAviatorService<GoAviatorState>("/api/v1/game/state");
  if (state.status !== "BETTING") {
    return Response.json({ error: "Betting is not open right now" }, { status: 409 });
  }

  const dbUser = await getOrCreateUser(user.id, { email: user.email });
  const stakeReference = `aviator-stake-${dbUser.id}-${state.round_id}-${panelIndex}-${Date.now()}`;

  let stakeSource: PlaySource = "real";
  try {
    await db.$transaction(async (tx) => {
      // Bonus-first stake (falls back to real balance; identical to prior
      // behaviour for users with no bonus).
      ({ source: stakeSource } = await spendForPlay(tx, dbUser.id, betAmount));

      await tx.transaction.create({
        data: {
          userId: dbUser.id,
          type: TransactionType.BET_STAKE,
          amount: betAmount,
          currency: "KES",
          status: TransactionStatus.COMPLETED,
          reference: stakeReference,
          provider: "aviator-service",
          metadata: { game: "aviator", roundId: state.round_id, panelIndex },
        },
      });
    });
  } catch (err) {
    if (err instanceof Error && err.message === "INSUFFICIENT_BALANCE") {
      return Response.json({ error: "Insufficient balance" }, { status: 400 });
    }
    console.error("Aviator wallet debit failed:", err);
    return Response.json({ error: "Failed to place bet" }, { status: 500 });
  }

  try {
    await callAviatorService(`/api/v1/user/${encodeURIComponent(dbUser.id)}/balance`, {
      method: "POST",
      body: JSON.stringify({ balance: betAmount }),
    });

    const placed = await callAviatorService<GoBetResponse>("/api/v1/game/bet", {
      method: "POST",
      body: JSON.stringify({
        user_id: dbUser.id,
        amount: betAmount,
        round_id: state.round_id,
      }),
    });

    if (!placed.success || !placed.bet_id) {
      throw new Error(placed.message || "Aviator service rejected bet");
    }

    await db.transaction.update({
      where: { reference: stakeReference },
      data: {
        metadata: { game: "aviator", roundId: state.round_id, panelIndex, betId: placed.bet_id },
      },
    });

    return Response.json({
      ok: true,
      betId: placed.bet_id,
      roundId: state.round_id,
      betAmount,
      panelIndex,
      autoCashout: null,
    }, { status: 201 });
  } catch (err) {
    await db.$transaction(async (tx) => {
      // Service rejected the bet: put the stake back where it came from.
      await creditForPlay(tx, dbUser.id, betAmount, stakeSource);
      await tx.transaction.create({
        data: {
          userId: dbUser.id,
          type: TransactionType.REFUND,
          amount: betAmount,
          currency: "KES",
          status: TransactionStatus.COMPLETED,
          reference: `aviator-refund-${dbUser.id}-${state.round_id}-${panelIndex}-${Date.now()}`,
          provider: "aviator-service",
          metadata: { game: "aviator", roundId: state.round_id, panelIndex, reason: "service_rejected_bet" },
        },
      });
    });

    console.error("Aviator service bet failed:", err);
    return Response.json({ error: err instanceof Error ? err.message : "Aviator service rejected bet" }, { status: 502 });
  }
}
