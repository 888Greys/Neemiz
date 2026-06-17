import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/get-or-create-user";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await getOrCreateUser(user.id, { email: user.email });

  const trades = await db.leveragedTrade.findMany({
    where:   { userId: dbUser.id },
    orderBy: { createdAt: "desc" },
    take:    30,
    select: {
      id: true, market: true, kind: true, direction: true,
      stake: true, payout: true, multiplier: true, barrier: true, payoutPerPoint: true,
      takeProfit: true, stopLoss: true, maxPayout: true,
      entrySpot: true, exitSpot: true, status: true, settledAt: true, createdAt: true,
    },
  });

  return Response.json(trades.map((t) => ({
    ...t,
    stake:          Number(t.stake),
    payout:         t.payout == null ? null : Number(t.payout),
    barrier:        t.barrier == null ? null : Number(t.barrier),
    payoutPerPoint: t.payoutPerPoint == null ? null : Number(t.payoutPerPoint),
    takeProfit:     t.takeProfit == null ? null : Number(t.takeProfit),
    stopLoss:       t.stopLoss == null ? null : Number(t.stopLoss),
    maxPayout:      Number(t.maxPayout),
    entrySpot:      Number(t.entrySpot),
    exitSpot:       t.exitSpot == null ? null : Number(t.exitSpot),
  })));
}
