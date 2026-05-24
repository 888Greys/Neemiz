import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/get-or-create-user";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await getOrCreateUser(user.id, { email: user.email });

  const bets = await db.polymarketBet.findMany({
    where:   { userId: dbUser.id },
    orderBy: { createdAt: "desc" },
    take:    50,
  });

  return Response.json(bets.map((b) => ({
    id:          b.id,
    marketId:    b.marketId,
    question:    b.question,
    outcome:     b.outcome,
    price:       Number(b.price),
    stake:       Number(b.stake),
    potentialWin:Number(b.potentialWin),
    status:      b.status,
    winAmount:   b.winAmount ? Number(b.winAmount) : null,
    executionMode: b.executionMode,
    clobOrderId: b.clobOrderId,
    clobStatus:  b.clobStatus,
    settledAt:   b.settledAt?.toISOString() ?? null,
    createdAt:   b.createdAt.toISOString(),
  })));
}
