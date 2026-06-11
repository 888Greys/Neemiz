import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/get-or-create-user";
import { TransactionType, TransactionStatus, ForexTradeDirection } from "@prisma/client";
import { getServerForexPrice, forexPrecision, isKnownForexSymbol } from "@/lib/forex-price";

// NOTE: entryPrice/stopLoss/takeProfit from the client are NOT trusted for
// settlement. The entry is sourced server-side from the live Deriv feed; the
// client values are only used to derive relative SL/TP offsets.
type OpenBody = {
  symbol: string;
  direction: "buy" | "sell";
  size: number;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  precision: number;
};

// Spread charged on entry (3 pips). This is the platform's house edge.
// BUY: entry is bumped up by 3 pips (user starts 3 pips in the hole).
// SELL: entry is bumped down by 3 pips (same effect).
const SPREAD_PIPS = 3;

function pipSize(precision: number) {
  return precision === 3 ? 0.01 : 0.0001;
}

function applySpread(price: number, direction: "buy" | "sell", precision: number): number {
  const pip = pipSize(precision);
  const spread = SPREAD_PIPS * pip;
  const raw = direction === "buy" ? price + spread : price - spread;
  return parseFloat(raw.toFixed(precision));
}

// Margin = size / 100 KES (e.g. 10K units → 100 KES reserved)
function calcMargin(size: number) {
  return Math.max(10, Math.round(size / 100));
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let body: OpenBody;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { symbol, direction, size, entryPrice, stopLoss, takeProfit } = body;

  if (!symbol || !direction || !size) {
    return Response.json({ error: "Missing required fields" }, { status: 400 });
  }
  if (!["buy", "sell"].includes(direction)) {
    return Response.json({ error: "Invalid direction" }, { status: 400 });
  }
  if (!isKnownForexSymbol(symbol)) {
    return Response.json({ error: "Unsupported symbol" }, { status: 400 });
  }
  if (size < 1000 || size > 50000) {
    return Response.json({ error: "Size must be between 1000 and 50000" }, { status: 400 });
  }

  // Server-authoritative entry price — the client value is ignored for settlement.
  const precision = forexPrecision(symbol);
  let livePrice: number;
  try {
    livePrice = await getServerForexPrice(symbol);
  } catch (err) {
    console.error("forex/open price fetch:", err instanceof Error ? err.message : err);
    return Response.json({ error: "Live price unavailable, try again" }, { status: 503 });
  }

  const margin = calcMargin(size);
  const effectiveEntry = applySpread(livePrice, direction, precision);

  // SL/TP are kept only as the client's relative offsets re-anchored to the
  // real entry; settlement no longer depends on them, but storing sane values
  // keeps the UI auto-close behaviour correct.
  const slOffset = Number.isFinite(entryPrice) && Number.isFinite(stopLoss) ? stopLoss - entryPrice : 0;
  const tpOffset = Number.isFinite(entryPrice) && Number.isFinite(takeProfit) ? takeProfit - entryPrice : 0;
  const effectiveStopLoss = parseFloat((effectiveEntry + slOffset).toFixed(precision));
  const effectiveTakeProfit = parseFloat((effectiveEntry + tpOffset).toFixed(precision));

  const dbUser = await getOrCreateUser(user.id, { email: user.email });

  try {
    const result = await db.$transaction(async (tx) => {
      const debited = await tx.user.updateMany({
        where: { id: dbUser.id, walletBalance: { gte: margin } },
        data: { walletBalance: { decrement: margin } },
      });
      if (debited.count === 0) throw new Error("INSUFFICIENT_BALANCE");

      const updated = await tx.user.findUniqueOrThrow({
        where: { id: dbUser.id },
        select: { walletBalance: true },
      });

      await tx.transaction.create({
        data: {
          userId: dbUser.id,
          type: TransactionType.BET_STAKE,
          amount: margin,
          currency: "KES",
          status: TransactionStatus.COMPLETED,
          provider: "forex",
          metadata: { game: "forex", symbol, direction, size },
        },
      });

      const trade = await tx.forexTrade.create({
        data: {
          userId: dbUser.id,
          symbol,
          direction: direction === "buy" ? ForexTradeDirection.BUY : ForexTradeDirection.SELL,
          size,
          entryPrice: effectiveEntry, // spread already baked in
          stopLoss: effectiveStopLoss,
          takeProfit: effectiveTakeProfit,
          precision,
          margin,
        },
      });

      return { trade, newBalance: Number(updated.walletBalance) };
    });

    return Response.json({
      id: result.trade.id,
      symbol: result.trade.symbol,
      direction: result.trade.direction.toLowerCase(),
      size: result.trade.size,
      entry: Number(result.trade.entryPrice), // spread-adjusted entry
      stopLoss: Number(result.trade.stopLoss),
      takeProfit: Number(result.trade.takeProfit),
      precision: result.trade.precision,
      margin: Number(result.trade.margin),
      openedAt: result.trade.openedAt.getTime(),
      newBalance: result.newBalance,
    });
  } catch (err) {
    if ((err as Error).message === "INSUFFICIENT_BALANCE") {
      return Response.json({ error: "Insufficient balance" }, { status: 400 });
    }
    console.error("POST /api/forex/open:", err instanceof Error ? err.message : err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
