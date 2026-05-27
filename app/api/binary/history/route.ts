import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/get-or-create-user";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await getOrCreateUser(user.id, { email: user.email });

  const trades = await db.binaryTrade.findMany({
    where:   { userId: dbUser.id },
    orderBy: { createdAt: "desc" },
    take:    30,
    select: {
      id: true, market: true, side: true,
      stake: true, payout: true,
      targetDigit: true, entryDigit: true, exitDigit: true,
      durationTicks: true, status: true,
      settledAt: true, createdAt: true,
    },
  });

  return Response.json(trades.map((t) => ({
    ...t,
    stake:  Number(t.stake),
    payout: Number(t.payout),
  })));
}
