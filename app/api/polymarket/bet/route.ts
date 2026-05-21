import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/get-or-create-user";
import { fetchMarket } from "@/lib/polymarket";
import { TransactionType, TransactionStatus } from "@prisma/client";

const MIN_BET = 10;
const MAX_BET = 100_000;

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let body: { conditionId: string; outcome: string; stake: number };
  try   { body = await req.json(); }
  catch { return Response.json({ error: "Invalid body" }, { status: 400 }); }

  const { conditionId, outcome, stake } = body;

  if (!conditionId || !outcome || !stake) {
    return Response.json({ error: "conditionId, outcome and stake are required" }, { status: 400 });
  }
  if (stake < MIN_BET) return Response.json({ error: `Minimum bet is KSh ${MIN_BET}` }, { status: 400 });
  if (stake > MAX_BET) return Response.json({ error: `Maximum bet is KSh ${MAX_BET.toLocaleString()}` }, { status: 400 });

  // Fetch live market to get current price
  const market = await fetchMarket(conditionId);
  if (!market) return Response.json({ error: "Market not found" }, { status: 404 });
  if (!market.active || market.closed) {
    return Response.json({ error: "Market is not open for betting" }, { status: 409 });
  }

  const outcomeIdx = market.outcomes.findIndex(
    (o) => o.toLowerCase() === outcome.toLowerCase()
  );
  if (outcomeIdx === -1) {
    return Response.json({ error: "Invalid outcome" }, { status: 400 });
  }

  const price       = market.outcomePrices[outcomeIdx];
  const potentialWin = parseFloat((stake / price).toFixed(2));

  const dbUser = await getOrCreateUser(user.id, { email: user.email });

  // Atomic: deduct balance + create bet + log transaction
  try {
    await db.$transaction(async (tx) => {
      const current = await tx.user.findUnique({ where: { id: dbUser.id } });
      if (!current || Number(current.walletBalance) < stake) {
        throw new Error("INSUFFICIENT_BALANCE");
      }

      const debited = await tx.user.updateMany({
        where: { id: dbUser.id, walletBalance: { gte: stake } },
        data:  { walletBalance: { decrement: stake } },
      });
      if (debited.count === 0) throw new Error("INSUFFICIENT_BALANCE");

      await tx.transaction.create({
        data: {
          userId:    dbUser.id,
          type:      TransactionType.BET_STAKE,
          amount:    stake,
          currency:  "KES",
          status:    TransactionStatus.COMPLETED,
          reference: `poly-stake-${dbUser.id}-${conditionId}-${Date.now()}`,
          metadata:  { game: "polymarket", conditionId, outcome, price },
        },
      });

      await tx.polymarketBet.create({
        data: {
          userId:      dbUser.id,
          marketId:    conditionId,
          question:    market.question,
          outcome:     market.outcomes[outcomeIdx],
          price,
          stake,
          potentialWin,
        },
      });
    });
  } catch (err: unknown) {
    if ((err as Error).message === "INSUFFICIENT_BALANCE") {
      return Response.json({ error: "Insufficient balance" }, { status: 400 });
    }
    console.error("Polymarket bet error:", err);
    return Response.json({ error: "Failed to place bet" }, { status: 500 });
  }

  return Response.json({
    ok:          true,
    question:    market.question,
    outcome:     market.outcomes[outcomeIdx],
    price,
    stake,
    potentialWin,
  }, { status: 201 });
}
