import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/get-or-create-user";

export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get("limit") ?? "20"), 50);

  const dbUser = await getOrCreateUser(user.id, { email: user.email });

  const bets = await db.bet.findMany({
    where: { userId: dbUser.id },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      selections: true,
    },
  });

  // Look up each fixture's kickoff time from the cache so the UI can show
  // when a match is played (selections don't store the time themselves).
  const fixtureIds = Array.from(
    new Set(bets.flatMap((b) => b.selections.map((s) => s.fixtureId)).filter((id) => /^\d+$/.test(id))),
  );
  const kickoffMap = new Map<string, Date>();
  if (fixtureIds.length) {
    const fixtures = await db.fixtureCache.findMany({
      where: { numericId: { in: fixtureIds.map((id) => BigInt(id)) } },
      select: { numericId: true, commenceTime: true },
    });
    for (const fx of fixtures) kickoffMap.set(fx.numericId.toString(), fx.commenceTime);
  }

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
        kickoff: kickoffMap.get(s.fixtureId) ?? null,
      })),
    })),
    { headers: { "Cache-Control": "private, max-age=15, stale-while-revalidate=30" } }
  );
}
