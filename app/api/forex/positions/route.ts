import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/get-or-create-user";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await getOrCreateUser(user.id, { email: user.email });

  const trades = await db.forexTrade.findMany({
    where: { userId: dbUser.id, status: "OPEN" },
    orderBy: { openedAt: "desc" },
  });

  return Response.json(
    trades.map((t) => ({
      id: t.id,
      symbol: t.symbol,
      direction: t.direction.toLowerCase(),
      size: t.size,
      entry: Number(t.entryPrice),
      stopLoss: Number(t.stopLoss),
      takeProfit: Number(t.takeProfit),
      precision: t.precision,
      margin: Number(t.margin),
      openedAt: t.openedAt.getTime(),
    })),
    { headers: { "Cache-Control": "private, no-store" } }
  );
}
