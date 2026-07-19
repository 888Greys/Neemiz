import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/get-or-create-user";
import { leaderUsernamesForFollowerTrades } from "@/lib/copy-trading";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await getOrCreateUser(user.id, { email: user.email });

  const trades = await db.directionalTrade.findMany({
    where:   { userId: dbUser.id },
    orderBy: { createdAt: "desc" },
    take:    30,
    select: {
      id: true, market: true, kind: true, side: true,
      stake: true, payout: true,
      entrySpot: true, exitSpot: true, barrier: true,
      entryEpoch: true, payoutPerPoint: true,
      durationTicks: true, status: true, settledAt: true, createdAt: true,
    },
  });

  const leaders = await leaderUsernamesForFollowerTrades(trades.map((t) => t.id));

  return Response.json(trades.map((t) => ({
    ...t,
    stake:     Number(t.stake),
    payout:    Number(t.payout),
    entrySpot: Number(t.entrySpot),
    exitSpot:  t.exitSpot == null ? null : Number(t.exitSpot),
    barrier:   t.barrier == null ? null : Number(t.barrier),
    payoutPerPoint: t.payoutPerPoint == null ? null : Number(t.payoutPerPoint),
    copyLeaderUsername: leaders.get(t.id) ?? null,
  })));
}
