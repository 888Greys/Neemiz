import { db } from "@/lib/db";
import { fetchResolutionDetail } from "@/lib/polymarket";
import { TransactionType, TransactionStatus } from "@prisma/client";

export const runtime = "nodejs";

const STALE_MARKET_MS = 24 * 60 * 60 * 1000;

function isAuthorized(req: Request) {
  const secrets = [process.env.SETTLE_SECRET, process.env.CRON_SECRET].filter(Boolean);
  if (secrets.length === 0) return false;

  const header = req.headers.get("authorization") ?? "";
  return secrets.some((secret) => header === `Bearer ${secret}`);
}

async function voidStalePolymarketBets(
  marketId: string,
  question: string,
  reason: "market_not_found" | "market_question_mismatch",
) {
  const cutoff = new Date(Date.now() - STALE_MARKET_MS);
  const bets = await db.polymarketBet.findMany({
    where: {
      marketId,
      question,
      status: "PENDING",
      createdAt: { lt: cutoff },
    },
  });

  let voided = 0;
  for (const bet of bets) {
    let didVoid = false;
    await db.$transaction(async (tx) => {
      const updated = await tx.polymarketBet.updateMany({
        where: { id: bet.id, status: "PENDING" },
        data: {
          status: "VOID",
          settledAt: new Date(),
          winAmount: null,
        },
      });
      if (updated.count === 0) return;
      didVoid = true;

      await tx.user.update({
        where: { id: bet.userId },
        data: { walletBalance: { increment: bet.stake } },
      });

      await tx.transaction.create({
        data: {
          userId: bet.userId,
          type: TransactionType.REFUND,
          amount: bet.stake,
          currency: "KES",
          status: TransactionStatus.COMPLETED,
          reference: `poly-void-${bet.id}`,
          metadata: { game: "polymarket", marketId, reason },
        },
      });
    });
    if (didVoid) voided++;
  }

  return voided;
}

async function settlePolymarket(req: Request) {
  if (!process.env.SETTLE_SECRET && !process.env.CRON_SECRET) {
    return Response.json({ error: "Settlement secret not configured" }, { status: 503 });
  }

  if (!isAuthorized(req)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Find all pending bets, grouped by market
  const pending = await db.polymarketBet.findMany({
    where: { status: "PENDING" },
    select: { marketId: true, question: true },
    distinct: ["marketId", "question"],
  });

  let settled = 0;
  let voided  = 0;
  let checkedMarkets = 0;
  let unresolvedMarkets = 0;
  let mismatchedMarkets = 0;
  let notFoundMarkets = 0;

  for (const { marketId, question } of pending) {
    checkedMarkets++;
    const resolution = await fetchResolutionDetail(marketId, { expectedQuestion: question });
    if (resolution.status === "unresolved") {
      unresolvedMarkets++;
      continue;
    }
    if (resolution.status === "mismatch") {
      mismatchedMarkets++;
      voided += await voidStalePolymarketBets(marketId, question, "market_question_mismatch");
      continue;
    }
    if (resolution.status === "not_found") {
      notFoundMarkets++;
      voided += await voidStalePolymarketBets(marketId, question, "market_not_found");
      continue;
    }

    const winningOutcome = resolution.winningOutcome;

    const bets = await db.polymarketBet.findMany({
      where: { marketId, question, status: "PENDING" },
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

  return Response.json({
    ok: true,
    checkedMarkets,
    unresolvedMarkets,
    mismatchedMarkets,
    notFoundMarkets,
    settled,
    voided,
  });
}

export async function GET(req: Request) {
  return settlePolymarket(req);
}

export async function POST(req: Request) {
  return settlePolymarket(req);
}
