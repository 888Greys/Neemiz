import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/get-or-create-user";
import { TransactionType, TransactionStatus } from "@prisma/client";
import { applyForexProfitRetention } from "@/lib/house-retention";
import { getServerForexPrice } from "@/lib/forex-price";
import { CURRENCY_SYMBOL, MONEY_LOCALE } from "@/lib/currency";

// NOTE: closePrice from the client is ignored for settlement. The close price
// is fetched server-side from the live Deriv feed.
type CloseBody = {
  tradeId: string;
};

function pipSize(precision: number) {
  return precision === 3 ? 0.01 : 0.0001;
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let body: CloseBody;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { tradeId } = body;
  if (!tradeId) {
    return Response.json({ error: "Missing required fields" }, { status: 400 });
  }

  const dbUser = await getOrCreateUser(user.id, { email: user.email });

  const trade = await db.forexTrade.findUnique({ where: { id: tradeId } });
  if (!trade) return Response.json({ error: "Trade not found" }, { status: 404 });
  if (trade.userId !== dbUser.id) return Response.json({ error: "Forbidden" }, { status: 403 });
  if (trade.status !== "OPEN") return Response.json({ error: "Trade already closed" }, { status: 409 });

  // Server-authoritative close price — the client value is ignored.
  let closePrice: number;
  try {
    closePrice = await getServerForexPrice(trade.symbol);
  } catch (err) {
    console.error("forex/close price fetch:", err instanceof Error ? err.message : err);
    return Response.json({ error: "Live price unavailable, try again" }, { status: 503 });
  }

  const pip = pipSize(trade.precision);
  const entry = Number(trade.entryPrice);
  const margin = Number(trade.margin);

  // pips gained: positive = profit for BUY, negative = loss
  const rawPips = (closePrice - entry) / pip;
  const pips = trade.direction === "BUY" ? rawPips : -rawPips;

  // P/L in KES: 1 pip on size units = (size / 10000) KES
  const profitLoss = parseFloat((pips * (trade.size / 10000)).toFixed(2));

  // Return is margin + P/L, floored at 0 (max loss = full margin)
  const grossReturnAmount = Math.max(0, margin + profitLoss);
  const returnAmount = applyForexProfitRetention(margin, profitLoss);
  const retainedAmount = Number((grossReturnAmount - returnAmount).toFixed(2));

  try {
    await db.$transaction(async (tx) => {
      await tx.forexTrade.update({
        where: { id: tradeId },
        data: {
          status: "CLOSED",
          closePrice,
          profitLoss,
          closedAt: new Date(),
        },
      });

      if (returnAmount > 0) {
        await tx.user.update({
          where: { id: dbUser.id },
          data: { walletBalance: { increment: returnAmount } },
        });
        await tx.transaction.create({
          data: {
            userId: dbUser.id,
            type: profitLoss >= 0 ? TransactionType.BET_WIN : TransactionType.REFUND,
            amount: returnAmount,
            currency: "KES",
            status: TransactionStatus.COMPLETED,
            provider: "forex",
            reference: `forex-close-${tradeId}`,
            metadata: {
              game: "forex",
              tradeId,
              symbol: trade.symbol,
              direction: trade.direction,
              pips: parseFloat(pips.toFixed(1)),
              profitLoss,
              grossReturnAmount,
              retainedAmount,
            },
          },
        });
      }
      await tx.notification.create({
        data: {
          userId: dbUser.id,
          type: profitLoss >= 0 ? "FOREX_WON" : "FOREX_LOST",
          title: profitLoss >= 0 ? "Forex trade closed in profit" : "Forex trade closed",
          body: `${trade.symbol} ${trade.direction}: ${profitLoss >= 0 ? "+" : ""}${CURRENCY_SYMBOL} ${profitLoss.toLocaleString(MONEY_LOCALE)}.`,
          link: "/forex",
        },
      });
    });

    const updatedUser = await db.user.findUnique({
      where: { id: dbUser.id },
      select: { walletBalance: true },
    });

    return Response.json({
      tradeId,
      pips: parseFloat(pips.toFixed(1)),
      profitLoss,
      returnAmount,
      grossReturnAmount,
      retainedAmount,
      newBalance: Number(updatedUser?.walletBalance ?? 0),
    });
  } catch (err) {
    console.error("POST /api/forex/close:", err instanceof Error ? err.message : err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
