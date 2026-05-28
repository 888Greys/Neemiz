import { db } from "@/lib/db";
import { getFixtureDetail, FINISHED_STATE_IDS } from "@/lib/theoddsapi";
import { resolveSelection, determineBetOutcome, calculateWinAmount } from "@/lib/settle-bet";
import { TransactionType, TransactionStatus } from "@prisma/client";

export async function POST(req: Request) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const authHeader = req.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const provided =
    bearerToken ??
    req.headers.get("x-cron-secret") ??
    new URL(req.url).searchParams.get("secret");

  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || provided !== cronSecret) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  // ── Step A: find all PENDING bets ────────────────────────────────────────
  const pendingBets = await db.bet.findMany({
    where: { status: "PENDING" },
    include: { selections: true },
    orderBy: { createdAt: "asc" },
    take: 200,
  });

  if (pendingBets.length === 0) {
    return Response.json({ ok: true, settled: 0, message: "No pending bets" });
  }

  // ── Step B: collect distinct fixture IDs ─────────────────────────────────
  const fixtureIds = Array.from(
    new Set(pendingBets.flatMap((b) => b.selections.map((s) => s.fixtureId))),
  );

  // ── Step C: fetch fixture details in parallel ─────────────────────────────
  const fetchResults = await Promise.allSettled(
    fixtureIds.map((id) => getFixtureDetail(Number(id))),
  );

  const fixtureMap = new Map<
    string,
    { detail: NonNullable<Awaited<ReturnType<typeof getFixtureDetail>>>; stateId: number }
  >();
  fixtureIds.forEach((id, i) => {
    const r = fetchResults[i];
    if (r.status === "fulfilled" && r.value) {
      fixtureMap.set(id, { detail: r.value, stateId: r.value.stateId });
    }
  });

  // ── Step D: which fixtures are finished ──────────────────────────────────
  const finishedFixtureIds = new Set(
    Array.from(fixtureMap.entries())
      .filter(([, v]) => FINISHED_STATE_IDS.has(v.stateId))
      .map(([id]) => id),
  );

  // ── Step E: bets where every fixture is done ─────────────────────────────
  const settleableBets = pendingBets.filter((bet) =>
    bet.selections.every((s) => finishedFixtureIds.has(s.fixtureId)),
  );

  // ── Step F: settle each bet atomically ───────────────────────────────────
  let settledCount = 0;

  for (const bet of settleableBets) {
    const selectionOutcomes = bet.selections.map((sel) => {
      const fx = fixtureMap.get(sel.fixtureId)!;
      return resolveSelection(
        { market: sel.market, label: sel.label },
        fx.detail,
        fx.stateId,
      );
    });

    const betOutcome = determineBetOutcome(selectionOutcomes);
    const winAmount =
      betOutcome === "WON"
        ? calculateWinAmount(
            Number(bet.stake),
            bet.selections.map((s) => Number(s.odds)),
            selectionOutcomes,
            bet.betType as "SINGLE" | "MULTI",
          )
        : 0;

    try {
      await db.$transaction(async (tx) => {
        // Idempotency: bail if already settled
        const fresh = await tx.bet.findUnique({
          where: { id: bet.id },
          select: { status: true },
        });
        if (!fresh || fresh.status !== "PENDING") return;

        // Update each selection result
        await Promise.all(
          bet.selections.map((sel, i) =>
            tx.betSelection.update({
              where: { id: sel.id },
              data: { result: selectionOutcomes[i] },
            }),
          ),
        );

        // Update the bet
        await tx.bet.update({
          where: { id: bet.id },
          data: {
            status: betOutcome,
            settledAt: new Date(),
            winAmount: winAmount > 0 ? winAmount : null,
          },
        });

        // Credit wallet on WON
        if (betOutcome === "WON" && winAmount > 0) {
          await tx.user.update({
            where: { id: bet.userId },
            data: { walletBalance: { increment: winAmount } },
          });
          await tx.transaction.create({
            data: {
              userId: bet.userId,
              type: TransactionType.BET_WIN,
              amount: winAmount,
              currency: "KES",
              status: TransactionStatus.COMPLETED,
              reference: `betwin_${bet.id}`,
              metadata: { betId: bet.id },
            },
          });
        }

        // Refund stake on VOID
        if (betOutcome === "VOID") {
          await tx.user.update({
            where: { id: bet.userId },
            data: { walletBalance: { increment: Number(bet.stake) } },
          });
          await tx.transaction.create({
            data: {
              userId: bet.userId,
              type: TransactionType.REFUND,
              amount: Number(bet.stake),
              currency: "KES",
              status: TransactionStatus.COMPLETED,
              reference: `betrefund_${bet.id}`,
              metadata: { betId: bet.id, reason: "void" },
            },
          });
        }
      });

      settledCount++;
    } catch (err) {
      console.error(`Settlement failed for bet ${bet.id}:`, err);
    }
  }

  return Response.json({
    ok: true,
    pendingBetsChecked: pendingBets.length,
    fixturesFetched: fixtureIds.length,
    fixturesFinished: finishedFixtureIds.size,
    betsSettled: settledCount,
  });
}
