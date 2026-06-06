import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/get-or-create-user";
import { TransactionStatus, TransactionType } from "@prisma/client";
import { callAviatorService, type GoCashoutResponse } from "@/lib/aviator/service";
import { applyProfitRetention, retainedProfit } from "@/lib/house-retention";
import { sendGameResultEmail } from "@/lib/brevo";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let body: { betId?: string; panelIndex?: 0 | 1 };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!body.betId) {
    return Response.json({ error: "Missing Aviator bet id" }, { status: 400 });
  }

  const dbUser = await getOrCreateUser(user.id, { email: user.email });

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
  const stakeTxn = await db.transaction.findFirst({
    where: {
      userId: dbUser.id,
      type: TransactionType.BET_STAKE,
      provider: "aviator-service",
      metadata: { path: ["betId"], equals: body.betId },
    },
    orderBy: { createdAt: "desc" },
  });
  const stakeAmount = stakeTxn ? Number(stakeTxn.amount) : Number((grossPayout / cashoutAt).toFixed(2));
  const winAmount = applyProfitRetention(stakeAmount, grossPayout);
  const retainedAmount = retainedProfit(stakeAmount, grossPayout);

  try {
    await db.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: dbUser.id },
        data: { walletBalance: { increment: winAmount } },
      });

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
      await tx.notification.create({
        data: {
          userId: dbUser.id,
          type: "AVIATOR_WON",
          title: `Aviator cashout at ${cashoutAt.toFixed(2)}x`,
          body: `KSh ${winAmount.toLocaleString("en-KE")} was credited to your wallet.`,
          link: "/aviator",
        },
      });
    });
  } catch (err) {
    console.error("Aviator wallet credit failed after service cashout:", err);
    return Response.json({ error: "Cashout succeeded but wallet credit failed; contact support" }, { status: 500 });
  }

  if (dbUser.email) sendGameResultEmail(dbUser.email, dbUser.firstName || dbUser.username || "Trader", {
    game: "Aviator",
    outcome: "WON",
    stake: stakeAmount,
    payout: winAmount,
    reference: body.betId,
    summary: `You cashed out at ${cashoutAt.toFixed(2)}x. Your winnings are now in your wallet.`,
    href: `${process.env.NEXT_PUBLIC_APP_URL ?? "https://nezeem.com"}/aviator`,
  }).catch((err) => console.error(`Aviator result email failed for ${body.betId}:`, err));

  return Response.json({
    ok: true,
    cashoutAt,
    winAmount,
    grossPayout,
    retainedAmount,
    betId: body.betId,
  });
}
