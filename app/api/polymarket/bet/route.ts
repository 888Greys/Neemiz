import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { spendForPlay } from "@/lib/balance";
import { getOrCreateUser } from "@/lib/get-or-create-user";
import { fetchMarket } from "@/lib/polymarket";
import { isClobTradingEnabled, placePolymarketBuyOrder } from "@/lib/polymarket-clob";
import { Prisma, TransactionType, TransactionStatus } from "@prisma/client";
import { CURRENCY_SYMBOL } from "@/lib/currency";

const MIN_BET = 10;
const MAX_BET = 100_000;

function normalizeOutcome(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function findOutcomeIndex(outcomes: string[], requested: string) {
  const normalized = normalizeOutcome(requested);
  const exact = outcomes.findIndex((o) => normalizeOutcome(o) === normalized);
  if (exact >= 0) return exact;

  if (normalized === "yes" || normalized.startsWith("yes ")) {
    return outcomes.findIndex((o) => normalizeOutcome(o) === "yes");
  }
  if (normalized === "no" || normalized.startsWith("no ")) {
    return outcomes.findIndex((o) => normalizeOutcome(o) === "no");
  }

  return -1;
}

function polymarketBetError(err: unknown) {
  const message = err instanceof Error ? err.message : String(err);

  if (message === "INSUFFICIENT_BALANCE") {
    return { status: 400, error: "Insufficient balance" };
  }

  if (
    err instanceof Prisma.PrismaClientKnownRequestError ||
    err instanceof Prisma.PrismaClientUnknownRequestError ||
    err instanceof Prisma.PrismaClientValidationError
  ) {
    return { status: 500, error: "Database error. Please try again." };
  }

  return { status: 500, error: "Failed to place bet. Please try again." };
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let body: { conditionId: string; outcome: string; outcomeIndex?: number; stake: number };
  try   { body = await req.json(); }
  catch { return Response.json({ error: "Invalid body" }, { status: 400 }); }

  const { conditionId, outcome, outcomeIndex, stake } = body;

  if (!conditionId || !outcome || !stake) {
    return Response.json({ error: "conditionId, outcome and stake are required" }, { status: 400 });
  }
  if (stake < MIN_BET) return Response.json({ error: `Minimum bet is ${CURRENCY_SYMBOL} ${MIN_BET}` }, { status: 400 });
  if (stake > MAX_BET) return Response.json({ error: `Maximum bet is ${CURRENCY_SYMBOL} ${MAX_BET.toLocaleString()}` }, { status: 400 });

  // Fetch live market to get current price
  const market = await fetchMarket(conditionId, { cache: "no-store" });
  if (!market) return Response.json({ error: "Market not found" }, { status: 404 });
  if (!market.active || market.closed) {
    return Response.json({ error: "Market is not open for betting" }, { status: 409 });
  }

  const requestedIndex = Number.isInteger(outcomeIndex) ? Number(outcomeIndex) : -1;
  const labelMatchIdx = findOutcomeIndex(market.outcomes, outcome);
  const outcomeIdx = labelMatchIdx >= 0
    ? labelMatchIdx
    : requestedIndex >= 0 && requestedIndex < market.outcomes.length
      ? requestedIndex
      : -1;
  if (outcomeIdx === -1) {
    return Response.json({
      error: `Selected outcome "${outcome}" is not available on the live market. Available outcomes: ${market.outcomes.join(", ") || "none"}`,
    }, { status: 400 });
  }

  const price       = market.outcomePrices[outcomeIdx];
  const potentialWin = parseFloat((stake / price).toFixed(2));
  const tokenId = market.clobTokenIds[outcomeIdx];
  const useClob = isClobTradingEnabled();

  if (useClob && !tokenId) {
    return Response.json({ error: "This outcome is missing a Polymarket CLOB token id" }, { status: 400 });
  }

  let dbUser: Awaited<ReturnType<typeof getOrCreateUser>>;
  try {
    dbUser = await getOrCreateUser(user.id, { email: user.email });
  } catch (err) {
    console.error("Polymarket user lookup error:", err);
    const response = polymarketBetError(err);
    return Response.json({ error: response.error }, { status: response.status });
  }

  let clobOrder: Awaited<ReturnType<typeof placePolymarketBuyOrder>> | null = null;
  try {
    clobOrder = useClob
      ? await placePolymarketBuyOrder({ tokenId: tokenId!, usdcAmount: stake, price })
      : null;
  } catch (err) {
    console.error("Polymarket CLOB order error:", err);
    return Response.json({ error: (err as Error).message || "Failed to place Polymarket order" }, { status: 502 });
  }

  // Atomic: deduct balance + create bet + log transaction
  try {
    await db.$transaction(async (tx) => {
      const current = await tx.user.findUnique({ where: { id: dbUser.id } });
      if (!current || Number(current.walletBalance) < stake) {
        throw new Error("INSUFFICIENT_BALANCE");
      }

      // Bonus-first stake (falls back to real balance; identical to prior
      // behaviour for users with no bonus).
      await spendForPlay(tx, dbUser.id, stake);

      await tx.transaction.create({
        data: {
          userId:    dbUser.id,
          type:      TransactionType.BET_STAKE,
          amount:    stake,
          currency:  "KES",
          status:    TransactionStatus.COMPLETED,
          reference: `poly-stake-${dbUser.id}-${conditionId}-${Date.now()}`,
          metadata:  {
            game: "polymarket",
            conditionId,
            outcome,
            price,
            executionMode: useClob ? "clob" : "internal",
            ...(useClob ? {
              clobOrderId: clobOrder?.orderId,
              clobStatus: clobOrder?.status,
            } : {}),
          },
        },
      });

      const clobBetFields = useClob ? {
        executionMode: "clob",
        clobOrderId: clobOrder?.orderId,
        clobStatus: clobOrder?.status,
        clobTokenId: tokenId,
        clobTradeIds: clobOrder?.tradeIds ?? [],
        clobTxHashes: clobOrder?.transactionHashes ?? [],
        clobRaw: clobOrder?.raw as Prisma.InputJsonValue | undefined,
      } : {};

      await tx.polymarketBet.create({
        data: {
          userId:      dbUser.id,
          marketId:    conditionId,
          question:    market.question,
          outcome:     market.outcomes[outcomeIdx],
          price,
          stake,
          potentialWin,
          ...clobBetFields,
        },
      });
    });
  } catch (err: unknown) {
    console.error("Polymarket bet error:", err, clobOrder ? { clobOrder } : undefined);
    const response = polymarketBetError(err);
    return Response.json({ error: response.error }, { status: response.status });
  }

  return Response.json({
    ok:          true,
    question:    market.question,
    outcome:     market.outcomes[outcomeIdx],
    price,
    stake,
    potentialWin,
    executionMode: useClob ? "clob" : "internal",
    clobOrderId: clobOrder?.orderId ?? null,
    clobStatus: clobOrder?.status ?? null,
  }, { status: 201 });
}
