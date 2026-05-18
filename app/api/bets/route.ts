import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/get-or-create-user";
import { BetType, TransactionType, TransactionStatus } from "@prisma/client";

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

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let body: PlaceBetBody;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { type, stake, selections } = body;

  if (!stake || stake <= 0) return Response.json({ error: "Invalid stake" }, { status: 400 });
  if (!selections?.length) return Response.json({ error: "No selections" }, { status: 400 });

  const totalOdds = selections.reduce((acc, s) => acc * s.odds, 1);
  const potentialWin = stake * totalOdds;

  const result = await db.$transaction(async (tx) => {
    const user = await getOrCreateUser(userId);

    const balance = Number(user.walletBalance);
    if (balance < stake) throw new Error("INSUFFICIENT_BALANCE");

    // Deduct stake
    const updated = await tx.user.update({
      where: { id: user.id },
      data: { walletBalance: { decrement: stake } },
      select: { walletBalance: true },
    });

    // Record transaction
    await tx.transaction.create({
      data: {
        userId: user.id,
        type: TransactionType.BET_STAKE,
        amount: stake,
        currency: "KES",
        status: TransactionStatus.COMPLETED,
      },
    });

    // Create the bet
    const bet = await tx.bet.create({
      data: {
        userId: user.id,
        betType: type === "MULTI" ? BetType.MULTI : BetType.SINGLE,
        stake,
        totalOdds,
        potentialWin,
        selections: {
          create: selections.map((s) => ({
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

  return Response.json(result);
}
