import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/get-or-create-user";
import { BetType, TransactionType, TransactionStatus } from "@prisma/client";
import { getFixtureDetail } from "@/lib/theoddsapi";
import { applyProfitRetention } from "@/lib/house-retention";

const MIN_STAKE = 10;

type BetSelectionInput = {
  fixtureId: string;
  matchName: string;
  market: string;
  label: string;
  odds: number;
};

type PlaceBetBody = {
  type: "SINGLE" | "MULTI";
  stake: number;
  selections: BetSelectionInput[];
};

async function resolveLiveSelections(selections: BetSelectionInput[]) {
  return Promise.all(
    selections.map(async (selection) => {
      const detail = await getFixtureDetail(Number(selection.fixtureId));
      if (!detail) {
        throw new Error("MARKET_UNAVAILABLE");
      }

      const requestedMarket = selection.market.trim().toLowerCase();
      const requestedLabel = selection.label.trim().toLowerCase();
      const market = detail.markets.find((m) => m.name.trim().toLowerCase() === requestedMarket);
      if (!market) {
        throw new Error("MARKET_UNAVAILABLE");
      }

      const odd = market.odds.find((o) => {
        const base = o.label.trim().toLowerCase();
        const withExtra = `${o.label} ${o.extra ?? ""}`.trim().toLowerCase();
        return base === requestedLabel || withExtra === requestedLabel;
      });
      if (!odd) {
        throw new Error("ODDS_CHANGED");
      }

      const odds = Number(odd.value);
      if (!Number.isFinite(odds) || odds <= 1) {
        throw new Error("ODDS_CHANGED");
      }

      return {
        ...selection,
        matchName: `${detail.match.home.name} vs ${detail.match.away.name}`,
        market: market.name,
        label: odd.extra ? `${odd.label} ${odd.extra}` : odd.label,
        odds,
      };
    }),
  );
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let body: PlaceBetBody;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { type, stake, selections } = body;

  if (!Number.isFinite(stake) || stake < MIN_STAKE) return Response.json({ error: `Minimum bet is KSh ${MIN_STAKE}` }, { status: 400 });
  if (!selections?.length) return Response.json({ error: "No selections" }, { status: 400 });
  if (type === "SINGLE" && selections.length !== 1) return Response.json({ error: "Single bets require one selection" }, { status: 400 });
  if (selections.length > 20) return Response.json({ error: "Too many selections" }, { status: 400 });

  let verifiedSelections: BetSelectionInput[];
  try {
    verifiedSelections = await resolveLiveSelections(selections);
  } catch (err) {
    const message = (err as Error).message === "ODDS_CHANGED"
      ? "Odds changed. Refresh the market and try again."
      : "Market is no longer available.";
    return Response.json({ error: message }, { status: 409 });
  }

  const totalOdds = verifiedSelections.reduce((acc, s) => acc * s.odds, 1);
  const grossPotentialWin = stake * totalOdds;
  const potentialWin = applyProfitRetention(stake, grossPotentialWin);
  const dbUser = await getOrCreateUser(user.id, { email: user.email });

  let result: { bet: unknown; newBalance: number };
  try {
    result = await db.$transaction(async (tx) => {
      // Deduct stake
      const debited = await tx.user.updateMany({
        where: { id: dbUser.id, walletBalance: { gte: stake } },
        data: { walletBalance: { decrement: stake } },
      });
      if (debited.count === 0) throw new Error("INSUFFICIENT_BALANCE");

      const updated = await tx.user.findUniqueOrThrow({
        where: { id: dbUser.id },
        select: { walletBalance: true },
      });

      // Record transaction
      await tx.transaction.create({
        data: {
          userId: dbUser.id,
          type: TransactionType.BET_STAKE,
          amount: stake,
          currency: "KES",
          status: TransactionStatus.COMPLETED,
        },
      });

      // Create the bet
      const bet = await tx.bet.create({
        data: {
          userId: dbUser.id,
          betType: type === "MULTI" ? BetType.MULTI : BetType.SINGLE,
          stake,
          totalOdds,
          potentialWin,
          selections: {
            create: verifiedSelections.map((s) => ({
              fixtureId: s.fixtureId,
              matchName: s.matchName,
              market: s.market,
              label: s.label,
              odds: s.odds,
            })),
          },
        },
        include: { selections: true },
      });

      return { bet, newBalance: Number(updated.walletBalance) };
    });
  } catch (err) {
    if ((err as Error).message === "INSUFFICIENT_BALANCE") {
      return Response.json({ error: "Insufficient balance" }, { status: 400 });
    }
    console.error("POST /api/bets:", err instanceof Error ? err.message : "Unknown error");
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }

  return Response.json(result);
}
