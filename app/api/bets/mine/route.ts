import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/get-or-create-user";

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get("limit") ?? "20"), 50);

  const user = await getOrCreateUser(userId);

  const bets = await db.bet.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      selections: true,
    },
  });

  return Response.json(
    bets.map((b) => ({
      id: b.id,
      type: b.betType,
      stake: Number(b.stake),
      totalOdds: Number(b.totalOdds),
      potentialWin: Number(b.potentialWin),
      winAmount: b.winAmount ? Number(b.winAmount) : null,
      status: b.status,
      createdAt: b.createdAt,
      selections: b.selections.map((s) => ({
        matchName: s.matchName,
        market: s.market,
        label: s.label,
        odds: Number(s.odds),
        result: s.result,
      })),
    }))
  );
}
