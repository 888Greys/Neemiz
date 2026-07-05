import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/get-or-create-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Returns the caller's current/most-recent auto-trader session plus a short
// run-log (its recent trades) so the UI can show live progress.
export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await getOrCreateUser(user.id, { email: user.email });

  const session = await db.autoTradeSession.findFirst({
    where: { userId: dbUser.id },
    orderBy: { createdAt: "desc" },
  });
  if (!session) return Response.json({ session: null, trades: [] });

  const trades = await db.binaryTrade.findMany({
    where: { autoSessionId: session.id },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { id: true, stake: true, payout: true, side: true, status: true, entryDigit: true, exitDigit: true, createdAt: true },
  });

  return Response.json({
    session: {
      id: session.id,
      status: session.status,
      stopReason: session.stopReason,
      market: session.market,
      side: session.side,
      targetDigit: session.targetDigit,
      durationTicks: session.durationTicks,
      strategy: session.strategy,
      baseStake: Number(session.baseStake),
      currentStake: Number(session.currentStake),
      multiplier: Number(session.multiplier),
      takeProfit: Number(session.takeProfit),
      stopLoss: Number(session.stopLoss),
      maxRuns: session.maxRuns,
      runsDone: session.runsDone,
      wins: session.wins,
      losses: session.losses,
      totalPnl: Number(session.totalPnl),
      createdAt: session.createdAt,
    },
    trades: trades.map((t) => ({
      id: t.id,
      stake: Number(t.stake),
      payout: Number(t.payout),
      side: t.side,
      status: t.status,
      entryDigit: t.entryDigit,
      exitDigit: t.exitDigit,
      createdAt: t.createdAt,
    })),
  });
}
