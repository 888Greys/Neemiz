import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/get-or-create-user";
import { TransactionStatus, TransactionType } from "@prisma/client";
import { retainedProfit } from "@/lib/house-retention";
import { getServerBinaryDigit } from "@/lib/binary-price";

function evaluateTrade(side: string, exitDigit: number, targetDigit: number): boolean {
  if (side === "Even")    return exitDigit % 2 === 0;
  if (side === "Odd")     return exitDigit % 2 === 1;
  if (side === "Matches") return exitDigit === targetDigit;
  if (side === "Differs") return exitDigit !== targetDigit;
  if (side === "Over")    return exitDigit > targetDigit;
  return exitDigit < targetDigit; // Under
}

function payoutRate(side: string, targetDigit: number): number {
  if (side === "Matches") return 9.15;
  if (side === "Differs") return 1.05;
  if (side === "Even" || side === "Odd") return 1.90;
  if (side === "Over") return Math.floor((9.5 / (9 - targetDigit)) * 100) / 100;
  return Math.floor((9.5 / targetDigit) * 100) / 100;
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  // NOTE: any exitDigit in the body is ignored. The settlement digit is fetched
  // server-side from the live Deriv feed — trusting the client's digit let
  // players mint guaranteed wins.
  let body: { tradeId?: string };
  try { body = await req.json(); } catch { return Response.json({ error: "Invalid body" }, { status: 400 }); }

  const { tradeId } = body;
  if (!tradeId) return Response.json({ error: "Missing tradeId" }, { status: 400 });

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

  // Server-authoritative exit digit — the client value is never trusted. If the
  // live feed is unavailable, refuse to settle so the client can retry; the
  // trade stays PENDING within its settleBefore window.
  let exitDigit: number;
  try {
    ({ digit: exitDigit } = await getServerBinaryDigit(trade.market));
  } catch (err) {
    console.error("binary/settle digit fetch:", err instanceof Error ? err.message : err);
    return Response.json({ error: "Live feed unavailable, try again" }, { status: 503 });
  }

  const won = evaluateTrade(trade.side, exitDigit, trade.targetDigit);
  const winAmount = won ? Number(trade.payout) : 0;
  const grossPayout = Number((Number(trade.stake) * payoutRate(trade.side, trade.targetDigit)).toFixed(2));
  const retainedAmount = won ? retainedProfit(Number(trade.stake), grossPayout) : 0;

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
            metadata:  { game: "binary", tradeId, market: trade.market, side: trade.side, exitDigit, multiplier: Number(trade.payout) / Number(trade.stake), retainedAmount },
          },
        });
      }
      await tx.notification.create({
        data: {
          userId: dbUser.id,
          type: won ? "BINARY_WON" : "BINARY_LOST",
          title: won ? "Binary trade won" : "Binary trade settled",
          body: won
            ? `KSh ${winAmount.toLocaleString("en-KE")} was credited to your wallet.`
            : `Your KSh ${Number(trade.stake).toLocaleString("en-KE")} trade did not win.`,
          link: "/binary",
        },
      });

      return result;
    });

    return Response.json({ won, winAmount, exitDigit, status: updated.status });
  } catch (err) {
    console.error("binary/settle error:", err);
    return Response.json({ error: "Settlement failed" }, { status: 500 });
  }
}
