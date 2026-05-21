import { db } from "@/lib/db";
import { fetchResolution } from "@/lib/polymarket";
import { TransactionType, TransactionStatus } from "@prisma/client";

const AUTH = process.env.SETTLE_SECRET;

export async function POST(req: Request) {
  if (!AUTH) {
    return Response.json({ error: "Settlement secret not configured" }, { status: 503 });
  }

  const header = req.headers.get("authorization") ?? "";
  if (header !== `Bearer ${AUTH}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Find all pending bets, grouped by market
  const pending = await db.polymarketBet.findMany({
    where: { status: "PENDING" },
    select: { marketId: true },
    distinct: ["marketId"],
  });

  let settled = 0;
  let voided  = 0;

  for (const { marketId } of pending) {
    const winningOutcome = await fetchResolution(marketId);
    if (winningOutcome === null) continue; // not resolved yet

    const bets = await db.polymarketBet.findMany({
      where: { marketId, status: "PENDING" },
    });

    for (const bet of bets) {
      const won = bet.outcome.toLowerCase() === winningOutcome.toLowerCase();

      await db.$transaction(async (tx) => {
        await tx.polymarketBet.update({
          where: { id: bet.id },
          data: {
            status:    won ? "WON" : "LOST",
            settledAt: new Date(),
            winAmount: won ? bet.potentialWin : null,
          },
        });

        if (won) {
          await tx.user.update({
            where: { id: bet.userId },
            data:  { walletBalance: { increment: bet.potentialWin } },
          });

          await tx.transaction.create({
            data: {
              userId:    bet.userId,
              type:      TransactionType.BET_WIN,
              amount:    bet.potentialWin,
              currency:  "KES",
              status:    TransactionStatus.COMPLETED,
              reference: `poly-win-${bet.id}`,
              metadata:  { game: "polymarket", marketId, outcome: bet.outcome },
            },
          });
        }
      });

      settled++;
    }
  }

  return Response.json({ ok: true, settled, voided });
}
