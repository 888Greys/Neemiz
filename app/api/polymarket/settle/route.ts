import { db } from "@/lib/db";
import { fetchResolutionDetail } from "@/lib/polymarket";
import { TransactionType, TransactionStatus } from "@prisma/client";
import { sendGameResultEmail } from "@/lib/brevo";

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
    include: { user: { select: { email: true, firstName: true, username: true } } },
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
      await tx.notification.create({
        data: {
          userId: bet.userId,
          type: "POLYMARKET_VOID",
          title: "Prediction refunded",
          body: `Your KSh ${Number(bet.stake).toLocaleString("en-KE")} stake was refunded.`,
          link: "/polymarket",
        },
      });
    });
    if (didVoid) {
      voided++;
      if (bet.user.email) sendGameResultEmail(bet.user.email, bet.user.firstName || bet.user.username || "Trader", {
        game: "Polymarket",
        outcome: "VOID",
        stake: Number(bet.stake),
        payout: Number(bet.stake),
        reference: bet.id,
        summary: "The market could not be resolved safely, so your stake was returned.",
        href: `${process.env.NEXT_PUBLIC_APP_URL ?? "https://nezeem.com"}/polymarket`,
      }).catch((err) => console.error(`Polymarket void email failed for ${bet.id}:`, err));
    }
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
      include: { user: { select: { email: true, firstName: true, username: true } } },
    });

    for (const bet of bets) {
      const won = bet.outcome.toLowerCase() === winningOutcome.toLowerCase();

      const didSettle = await db.$transaction(async (tx) => {
        const updated = await tx.polymarketBet.updateMany({
          where: { id: bet.id, status: "PENDING" },
          data: {
            status:    won ? "WON" : "LOST",
            settledAt: new Date(),
            winAmount: won ? bet.potentialWin : null,
          },
        });
        if (updated.count === 0) return false;

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
        await tx.notification.create({
          data: {
            userId: bet.userId,
            type: won ? "POLYMARKET_WON" : "POLYMARKET_LOST",
            title: won ? "Prediction won" : "Prediction settled",
            body: won
              ? `KSh ${Number(bet.potentialWin).toLocaleString("en-KE")} was credited to your wallet.`
              : "Your market prediction did not win.",
            link: "/polymarket",
          },
        });
        return true;
      });

      if (didSettle) {
        settled++;
        if (bet.user.email) sendGameResultEmail(bet.user.email, bet.user.firstName || bet.user.username || "Trader", {
          game: "Polymarket",
          outcome: won ? "WON" : "LOST",
          stake: Number(bet.stake),
          payout: won ? Number(bet.potentialWin) : undefined,
          reference: bet.id,
          summary: `${question} - your prediction was ${bet.outcome}.`,
          href: `${process.env.NEXT_PUBLIC_APP_URL ?? "https://nezeem.com"}/polymarket`,
        }).catch((err) => console.error(`Polymarket result email failed for ${bet.id}:`, err));
      }
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
