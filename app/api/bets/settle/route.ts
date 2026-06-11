import { db } from "@/lib/db";
import { FINISHED_STATE_IDS, type MatchDetail } from "@/lib/theoddsapi";
import { getCachedFixtures, persistFinishedDetail } from "@/lib/fixtures-cache";
import { getThesportsdbResult, parseMatchName } from "@/lib/thesportsdb";
import { resolveSelection, determineBetOutcome, calculateWinAmount } from "@/lib/settle-bet";
import { TransactionType, TransactionStatus } from "@prisma/client";
import { applyProfitRetention, retainedProfit } from "@/lib/house-retention";
import { sendGameResultEmail } from "@/lib/brevo";

// Vercel Cron invokes endpoints with GET (and an Authorization: Bearer
// <CRON_SECRET> header when CRON_SECRET is set). Reuse the same handler.
export async function GET(req: Request) {
  return POST(req);
}

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
    include: {
      selections: true,
      user: { select: { email: true, firstName: true, username: true } },
    },
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

  // ── Step C: resolve fixtures from the database cache ─────────────────────
  // The scheduled refresh-fixtures job is the only paid Odds API caller.
  // Settlement reads live/upcoming cache rows and permanent finished results,
  // so increasing settlement frequency does not consume provider credits.
  const numericIds = fixtureIds.map((id) => Number(id));
  const cached = await getCachedFixtures(numericIds);

  const fixtureMap = new Map<string, { detail: MatchDetail; stateId: number }>();
  for (const id of numericIds) {
    const r = cached.get(id);
    if (r) fixtureMap.set(String(id), { detail: r.detail, stateId: r.stateId });
  }

  // Free fallback for fixtures the scheduled refresh has not resolved.
  const sdbResolved = new Map<number, { detail: MatchDetail; stateId: number }>();
  // fixtureId → { matchName, latest bet date } (the game is on/after the bet,
  // so the bet date anchors which game in a series to settle).
  const metaById = new Map<string, { name: string; date: Date }>();
  for (const b of pendingBets) for (const s of b.selections) {
    const prev = metaById.get(s.fixtureId);
    if (!prev || b.createdAt > prev.date) metaById.set(s.fixtureId, { name: s.matchName, date: b.createdAt });
  }
  const stillUnresolved = numericIds.filter((id) => !fixtureMap.has(String(id))).slice(0, 25);
  for (const id of stillUnresolved) {
    const meta = metaById.get(String(id));
    const teams = parseMatchName(meta?.name ?? "");
    if (!teams) continue;
    try {
      const res = await getThesportsdbResult(teams.home, teams.away, meta?.date);
      if (res) {
        sdbResolved.set(id, res);
        fixtureMap.set(String(id), res);
      }
    } catch (err) {
      console.error(`TheSportsDB lookup failed for fixture ${id}:`, err);
    }
  }

  // Persist finished fixtures found by TheSportsDB.
  await Promise.all(
    Array.from(sdbResolved.entries())
      .filter(([, v]) => FINISHED_STATE_IDS.has(v.stateId) || v.stateId === 13 || v.stateId === 17)
      .map(([id, v]) => persistFinishedDetail(id, v.detail, v.stateId).catch(() => {})),
  );

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
    const grossWinAmount =
      betOutcome === "WON"
        ? calculateWinAmount(
            Number(bet.stake),
            bet.selections.map((s) => Number(s.odds)),
            selectionOutcomes,
            bet.betType as "SINGLE" | "MULTI",
          )
        : 0;
    const winAmount = grossWinAmount > 0 ? applyProfitRetention(Number(bet.stake), grossWinAmount) : 0;
    const retainedAmount = grossWinAmount > 0 ? retainedProfit(Number(bet.stake), grossWinAmount) : 0;

    try {
      const didSettle = await db.$transaction(async (tx) => {
        // Idempotency: bail if already settled
        const fresh = await tx.bet.findUnique({
          where: { id: bet.id },
          select: { status: true },
        });
        if (!fresh || fresh.status !== "PENDING") return false;

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
              metadata: { betId: bet.id, grossWinAmount, retainedAmount },
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
        await tx.notification.create({
          data: {
            userId: bet.userId,
            type: `BET_${betOutcome}`,
            title: betOutcome === "WON" ? "Bet won" : betOutcome === "VOID" ? "Bet refunded" : "Bet settled",
            body: betOutcome === "WON"
              ? `KSh ${winAmount.toLocaleString("en-KE")} was credited to your wallet.`
              : betOutcome === "VOID"
                ? `Your KSh ${Number(bet.stake).toLocaleString("en-KE")} stake was refunded.`
                : "Your sports bet did not win.",
            link: "/my-bets",
          },
        });
        return true;
      });

      if (didSettle) {
        settledCount++;
        if (bet.user.email) sendGameResultEmail(bet.user.email, bet.user.firstName || bet.user.username || "Trader", {
          game: "Sports bet",
          outcome: betOutcome,
          stake: Number(bet.stake),
          payout: betOutcome === "WON" ? winAmount : betOutcome === "VOID" ? Number(bet.stake) : undefined,
          reference: bet.id,
          href: `${process.env.NEXT_PUBLIC_APP_URL ?? "https://nezeem.com"}/my-bets`,
        }).catch((err) => console.error(`Sports result email failed for ${bet.id}:`, err));
      }
    } catch (err) {
      console.error(`Settlement failed for bet ${bet.id}:`, err);
    }
  }

  // ── Step G: auto-void bets stuck beyond the data window ───────────────────
  // The odds API only exposes scores for ~3 days. A bet still PENDING after
  // that whose fixtures are no longer in the feed (game long over, result
  // unavailable) can never be settled — void it and refund the stake so it
  // doesn't sit PENDING forever. Fixtures that ARE still in the feed (future
  // or live games) are left alone, so long-dated bets aren't wrongly voided.
  // CRITICAL: only auto-void when the feed is healthy. During an outage / quota
  // exhaustion every fetch returns empty, so EVERY fixture looks "missing" — and
  // we'd wrongly refund bets that actually lost. Skip the void pass entirely
  // until the API is reachable again.
  // Cache-only settlement cannot safely distinguish an expired fixture from a
  // delayed refresh or missing cache row. Never auto-void from missing data.
  const stuckBets: typeof pendingBets = [];

  let voidedCount = 0;
  for (const bet of stuckBets) {
    try {
      const didVoid = await db.$transaction(async (tx) => {
        const fresh = await tx.bet.findUnique({ where: { id: bet.id }, select: { status: true } });
        if (!fresh || fresh.status !== "PENDING") return false;

        await tx.betSelection.updateMany({ where: { betId: bet.id }, data: { result: "VOID" } });
        await tx.bet.update({
          where: { id: bet.id },
          data: { status: "VOID", settledAt: new Date() },
        });
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
            reference: `betvoid_${bet.id}`,
            metadata: { betId: bet.id, reason: "unsettleable_stuck" },
          },
        });
        await tx.notification.create({
          data: {
            userId: bet.userId,
            type: "BET_VOID",
            title: "Bet refunded",
            body: `Your KSh ${Number(bet.stake).toLocaleString("en-KE")} stake was refunded.`,
            link: "/my-bets",
          },
        });
        return true;
      });
      if (didVoid) {
        voidedCount++;
        if (bet.user.email) sendGameResultEmail(bet.user.email, bet.user.firstName || bet.user.username || "Trader", {
          game: "Sports bet",
          outcome: "VOID",
          stake: Number(bet.stake),
          payout: Number(bet.stake),
          reference: bet.id,
          href: `${process.env.NEXT_PUBLIC_APP_URL ?? "https://nezeem.com"}/my-bets`,
        }).catch((err) => console.error(`Sports void email failed for ${bet.id}:`, err));
      }
    } catch (err) {
      console.error(`Void failed for bet ${bet.id}:`, err);
    }
  }

  return Response.json({
    ok: true,
    source: "fixture-cache",
    pendingBetsChecked: pendingBets.length,
    fixturesFetched: fixtureMap.size,
    fixturesFinished: finishedFixtureIds.size,
    resolvedViaSportsdb: sdbResolved.size,
    betsSettled: settledCount,
    betsVoided: voidedCount,
    warning: "Automatic stuck-bet voiding is disabled in cache-only settlement mode.",
  });
}
