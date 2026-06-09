import { db } from "@/lib/db";
import { getSettlementFixtures, FINISHED_STATE_IDS, type MatchDetail } from "@/lib/theoddsapi";
import { getKnownResults, persistFinishedDetail } from "@/lib/fixtures-cache";
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

  // ── Step C: resolve fixtures, cheapest source first ──────────────────────
  // 1) Permanent finished results from the cache table → zero API credits.
  // 2) Only fixtures with no recorded result hit the Odds API, and only for the
  //    sports those bets belong to (one or two targeted calls, not a 12-sport
  //    scan per fixture). apiHealthy is false on a genuine outage / quota
  //    exhaustion, which gates the refund-on-stuck step below.
  const numericIds = fixtureIds.map((id) => Number(id));
  const known = await getKnownResults(numericIds);

  const unresolvedIds = numericIds.filter((id) => !known.has(id));
  const unresolvedSet = new Set(unresolvedIds.map(String));
  const sportKeysForUnresolved = Array.from(
    new Set(
      pendingBets
        .flatMap((b) => b.selections)
        .filter((s) => unresolvedSet.has(s.fixtureId) && s.sportKey)
        .map((s) => s.sportKey as string),
    ),
  );
  // If every unresolved fixture has a known sportKey we can target; otherwise
  // (legacy rows with null sportKey) fall back to the full in-season scan.
  const everyUnresolvedHasSport = unresolvedIds.every((id) =>
    pendingBets.some((b) =>
      b.selections.some((s) => s.fixtureId === String(id) && s.sportKey),
    ),
  );

  const { fixtures: fetched, apiHealthy } = unresolvedIds.length === 0
    ? { fixtures: new Map<number, { detail: MatchDetail; stateId: number }>(), apiHealthy: true }
    : await getSettlementFixtures(unresolvedIds, {
        sportKeys: everyUnresolvedHasSport ? sportKeysForUnresolved : undefined,
      });

  const fixtureMap = new Map<string, { detail: MatchDetail; stateId: number }>();
  for (const id of numericIds) {
    const r = known.get(id) ?? fetched.get(id);
    if (r) fixtureMap.set(String(id), { detail: r.detail, stateId: r.stateId });
  }

  // 3) TheSportsDB fallback (free) for fixtures the Odds API couldn't resolve —
  //    its /scores feed misses or fails to mark many finished games. Look the
  //    game up by team name and settle from the real result.
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

  // Persist any newly-finished fixtures (Odds API or TheSportsDB) so the next
  // run reads them from the cache table instead of re-fetching.
  await Promise.all(
    [...Array.from(fetched.entries()).filter(([id]) => !known.has(id)), ...Array.from(sdbResolved.entries())]
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
  const STUCK_MS = 3 * 24 * 60 * 60 * 1000;
  const stuckCutoff = new Date(Date.now() - STUCK_MS);
  const settledIds = new Set(settleableBets.map((b) => b.id));
  const stuckBets = !apiHealthy ? [] : pendingBets.filter(
    (b) =>
      !settledIds.has(b.id) &&
      b.createdAt < stuckCutoff &&
      b.selections.every((s) => !fixtureMap.has(s.fixtureId)),
  );

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
    apiHealthy,
    pendingBetsChecked: pendingBets.length,
    fixturesFetched: fixtureMap.size,
    fixturesFinished: finishedFixtureIds.size,
    resolvedViaSportsdb: sdbResolved.size,
    betsSettled: settledCount,
    betsVoided: voidedCount,
    ...(apiHealthy ? {} : { warning: "Odds API unreachable (out of credits / rate limited) — settlement & auto-void paused this run." }),
  });
}
