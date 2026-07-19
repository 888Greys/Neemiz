import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/get-or-create-user";
import { validateStart } from "@/lib/auto-trade";
import { stepSession } from "@/lib/auto-trade-engine";
import { isBetTypeDisabled } from "@/lib/game-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try { body = await req.json(); } catch { return Response.json({ error: "Invalid body" }, { status: 400 }); }

  let v;
  try { v = validateStart(body as Record<string, unknown>); }
  catch (e) { return Response.json({ error: e instanceof Error ? e.message : "Invalid input" }, { status: 400 }); }

  // Same guards as the manual bet route — the auto-trader must not bypass the
  // per-type kill switch or the Over/Under microstructure floor.
  if (await isBetTypeDisabled("binary", v.side))
    return Response.json({ error: "This bet type is temporarily unavailable while we complete maintenance." }, { status: 503 });
  // Over/Under stay blocked on auto: short-duration microstructure + quarantine
  // gates are easy to misconfigure in a looping session. Matches/Even/Odd/Differs
  // now share the kernel priceDigitServer path (incl. sticky Matches).
  if (v.side === "Over" || v.side === "Under")
    return Response.json({ error: "Over/Under isn’t available for auto-trading." }, { status: 400 });

  const dbUser = await getOrCreateUser(user.id, { email: user.email });

  // One running session per user keeps the engine simple and the UI honest.
  const existing = await db.autoTradeSession.findFirst({
    where: { userId: dbUser.id, status: "RUNNING" },
    select: { id: true },
  });
  if (existing) return Response.json({ error: "You already have a running auto-trader. Stop it first." }, { status: 409 });

  if (Number(dbUser.walletBalance) < v.baseStake)
    return Response.json({ error: "Insufficient balance for the base stake" }, { status: 400 });

  const session = await db.autoTradeSession.create({
    data: {
      userId:        dbUser.id,
      market:        v.market,
      side:          v.side,
      targetDigit:   v.targetDigit,
      durationTicks: v.durationTicks,
      strategy:      v.strategy,
      baseStake:     v.baseStake,
      currentStake:  v.baseStake,
      multiplier:    v.multiplier,
      takeProfit:    v.takeProfit,
      stopLoss:      v.stopLoss,
      maxRuns:       v.maxRuns,
      status:        "RUNNING",
    },
  });

  // Fire the first trade immediately so the user sees action without waiting
  // for the next cron tick. Safe: the engine no-ops if anything's off.
  await stepSession(session).catch(() => {});

  return Response.json({ sessionId: session.id }, { status: 201 });
}
