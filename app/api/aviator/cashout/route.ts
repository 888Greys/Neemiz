import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { TransactionStatus, TransactionType } from "@prisma/client";
import { callAviatorService, type GoCashoutResponse } from "@/lib/aviator/service";
import { applyProfitRetention, retainedProfit } from "@/lib/house-retention";
import { CURRENCY_SYMBOL, MONEY_LOCALE } from "@/lib/currency";
import { creditWinnings } from "@/lib/balance";

/**
 * Cashout must hit the Aviator game service as fast as possible — every ms
 * before that call is a window where the plane can crash and the user loses.
 * Keep auth + user lookup minimal, skip stake ledger lookup, defer notification.
 */
export async function POST(req: Request) {
  let body: { betId?: string; panelIndex?: 0 | 1 };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!body.betId) {
    return Response.json({ error: "Missing Aviator bet id" }, { status: 400 });
  }

  // Auth + slim user id lookup — then Go immediately.
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await db.user.findUnique({
    where: { supabaseId: user.id },
    select: { id: true, isActive: true },
  });
  if (!dbUser) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!dbUser.isActive) return Response.json({ error: "Account suspended" }, { status: 403 });

  // Critical path: game-service cashout (authoritative multiplier / payout).
  let cashed: GoCashoutResponse;
  try {
    cashed = await callAviatorService<GoCashoutResponse>("/api/v1/game/cashout", {
      method: "POST",
      body: JSON.stringify({
        user_id: dbUser.id,
        bet_id: body.betId,
      }),
    });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "Cashout failed" }, { status: 409 });
  }

  if (!cashed.success || !cashed.payout || !cashed.multiplier) {
    return Response.json({ error: cashed.message || "Cashout failed" }, { status: 409 });
  }

  const grossPayout = Number(cashed.payout.toFixed(2));
  const cashoutAt = Number(cashed.multiplier.toFixed(2));
  // Derive stake from payout/multiplier — avoids an extra DB round-trip on the
  // hot path (previously we looked up BET_STAKE by metadata).
  const stakeAmount = Number((grossPayout / cashoutAt).toFixed(2));
  const winAmount = applyProfitRetention(stakeAmount, grossPayout);
  const retainedAmount = retainedProfit(stakeAmount, grossPayout);

  try {
    await db.$transaction(async (tx) => {
      await creditWinnings(tx, dbUser.id, winAmount);
      await tx.transaction.create({
        data: {
          userId: dbUser.id,
          type: TransactionType.BET_WIN,
          amount: winAmount,
          currency: "KES",
          status: TransactionStatus.COMPLETED,
          reference: `aviator-win-${body.betId}`,
          provider: "aviator-service",
          metadata: {
            game: "aviator",
            betId: body.betId,
            panelIndex: body.panelIndex ?? null,
            multiplier: cashoutAt,
            stakeAmount,
            grossPayout,
            retainedAmount,
          },
        },
      });
    });
  } catch (err) {
    console.error("Aviator wallet credit failed after service cashout:", err);
    return Response.json({ error: "Cashout succeeded but wallet credit failed; contact support" }, { status: 500 });
  }

  // Notification is not on the cashout critical path.
  void db.notification.create({
    data: {
      userId: dbUser.id,
      type: "AVIATOR_WON",
      title: `Aviator cashout at ${cashoutAt.toFixed(2)}x`,
      body: `${CURRENCY_SYMBOL} ${winAmount.toLocaleString(MONEY_LOCALE)} was credited to your wallet.`,
      link: "/aviator",
    },
  }).catch((err) => console.error("Aviator cashout notification failed:", err));

  return Response.json({
    ok: true,
    cashoutAt,
    winAmount,
    grossPayout,
    retainedAmount,
    betId: body.betId,
  });
}
