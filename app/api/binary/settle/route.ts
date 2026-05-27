import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/get-or-create-user";
import { TransactionStatus, TransactionType } from "@prisma/client";

function evaluateTrade(side: string, exitDigit: number, targetDigit: number): boolean {
  if (side === "Even")    return exitDigit % 2 === 0;
  if (side === "Odd")     return exitDigit % 2 === 1;
  if (side === "Matches") return exitDigit === targetDigit;
  if (side === "Differs") return exitDigit !== targetDigit;
  if (side === "Over")    return exitDigit > targetDigit;
  return exitDigit < targetDigit; // Under
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let body: { tradeId?: string; exitDigit?: number };
  try { body = await req.json(); } catch { return Response.json({ error: "Invalid body" }, { status: 400 }); }

  const { tradeId, exitDigit } = body;
  if (!tradeId) return Response.json({ error: "Missing tradeId" }, { status: 400 });
  if (exitDigit === undefined || exitDigit < 0 || exitDigit > 9)
    return Response.json({ error: "Invalid exit digit" }, { status: 400 });

  const dbUser = await getOrCreateUser(user.id, { email: user.email });

  const trade = await db.binaryTrade.findUnique({ where: { id: tradeId } });
  if (!trade)                        return Response.json({ error: "Trade not found" }, { status: 404 });
  if (trade.userId !== dbUser.id)    return Response.json({ error: "Forbidden" }, { status: 403 });
  if (trade.status !== "PENDING")    return Response.json({ error: "Trade already settled" }, { status: 409 });

  const now = new Date();
  const earliestSettle = new Date(trade.createdAt.getTime() + trade.durationTicks * 1000);
  if (now < earliestSettle)
    return Response.json({ error: "Trade cannot be settled yet" }, { status: 409 });
  if (now > trade.settleBefore)
    return Response.json({ error: "Settlement window expired" }, { status: 409 });

  const won = evaluateTrade(trade.side, exitDigit, trade.targetDigit);
  const winAmount = won ? Number(trade.payout) : 0;

  try {
    const updated = await db.$transaction(async (tx) => {
      const result = await tx.binaryTrade.update({
        where: { id: tradeId },
        data:  { status: won ? "WON" : "LOST", exitDigit, settledAt: now },
      });

      if (won) {
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
            reference: `binary-win-${dbUser.id}-${tradeId}`,
            provider:  "binary",
            metadata:  { game: "binary", tradeId, market: trade.market, side: trade.side, exitDigit, multiplier: Number(trade.payout) / Number(trade.stake) },
          },
        });
      }

      return result;
    });

    return Response.json({ won, winAmount, status: updated.status });
  } catch (err) {
    console.error("binary/settle error:", err);
    return Response.json({ error: "Settlement failed" }, { status: 500 });
  }
}
