import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/get-or-create-user";
import { getServerBinaryDigit } from "@/lib/binary-price";
import { settleTradeWithDigit } from "@/lib/binary-settle";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  // NOTE: any exitDigit in the body is ignored. The settlement digit is fetched
  // server-side from the live Deriv feed — trusting the client's digit let
  // players mint guaranteed wins.
  let body: { tradeId?: string };
  try { body = await req.json(); } catch { return Response.json({ error: "Invalid body" }, { status: 400 }); }

  const { tradeId } = body;
  if (!tradeId) return Response.json({ error: "Missing tradeId" }, { status: 400 });

  const dbUser = await getOrCreateUser(user.id, { email: user.email });

  const trade = await db.binaryTrade.findUnique({ where: { id: tradeId } });
  if (!trade)                        return Response.json({ error: "Trade not found" }, { status: 404 });
  if (trade.userId !== dbUser.id)    return Response.json({ error: "Forbidden" }, { status: 403 });
  if (trade.status !== "PENDING")    return Response.json({ error: "Trade already settled" }, { status: 409 });

  const now = new Date();
  const earliestSettle = new Date(trade.createdAt.getTime() + trade.durationTicks * 1000);
  if (now < earliestSettle)
    return Response.json({ error: "Trade cannot be settled yet" }, { status: 409 });
  if (now > trade.settleBefore)
    return Response.json({ error: "Settlement window expired" }, { status: 409 });

  // Server-authoritative exit digit — the client value is never trusted. If the
  // live feed is unavailable, refuse to settle so the client can retry; the
  // trade stays PENDING within its settleBefore window.
  let exitDigit: number;
  try {
    ({ digit: exitDigit } = await getServerBinaryDigit(trade.market));
  } catch (err) {
    console.error("binary/settle digit fetch:", err instanceof Error ? err.message : err);
    return Response.json({ error: "Live feed unavailable, try again" }, { status: 503 });
  }

  try {
    const result = await settleTradeWithDigit(trade, exitDigit);
    // Another worker (a second tab, or the cron sweep) settled it first.
    if (result.outcome === "already")
      return Response.json({ error: "Trade already settled" }, { status: 409 });

    const won = result.outcome === "won";
    return Response.json({ won, winAmount: result.winAmount, exitDigit, status: won ? "WON" : "LOST" });
  } catch (err) {
    console.error("binary/settle error:", err);
    return Response.json({ error: "Settlement failed" }, { status: 500 });
  }
}
