import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/get-or-create-user";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await getOrCreateUser(user.id, { email: user.email });

  const trades = await db.forexTrade.findMany({
    where: { userId: dbUser.id, status: "CLOSED" },
    orderBy: { closedAt: "desc" },
    take: 30,
    select: {
      id: true, symbol: true, direction: true,
      size: true, entryPrice: true, closePrice: true,
      precision: true, margin: true, profitLoss: true,
      openedAt: true, closedAt: true,
    },
  });

  return Response.json(
    trades.map((t) => ({
      id: t.id,
      symbol: t.symbol,
      direction: t.direction.toLowerCase(),
      size: t.size,
      entry: Number(t.entryPrice),
      closePrice: t.closePrice ? Number(t.closePrice) : null,
      precision: t.precision,
      margin: Number(t.margin),
      profitLoss: t.profitLoss ? Number(t.profitLoss) : null,
      openedAt: t.openedAt.getTime(),
      closedAt: t.closedAt ? t.closedAt.getTime() : null,
    })),
    { headers: { "Cache-Control": "private, no-store" } }
  );
}
