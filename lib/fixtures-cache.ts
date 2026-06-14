/**
 * Server-side fixture cache.
 *
 * The Odds API charges credits per market × region per request, and a 20k/month
 * plan only affords ~666 credits/day. Hitting the API on every user page load
 * (getLivescores + getUpcomingFixtures + getFixtureDetail each looped every
 * in-season sport) exhausted the plan within hours, which silently broke
 * settlement.
 *
 * This module decouples credit spend from user traffic:
 *   • refreshFixtureCache()  — ONE pass over the in-season sports (run by cron),
 *     upserts normalized matches into `fixtures_cache` and finished games into
 *     `fixture_results` (permanent — a finished result never changes).
 *   • read*()                — page/detail reads served entirely from the DB,
 *     zero API credits regardless of how many users are browsing.
 *
 * The Odds API is therefore called at a fixed cost per refresh interval, not
 * per request. See [[neemiz-settlement-bug]].
 */
import { db } from "@/lib/db";
import {
  getFetchSports,
  fetchOddsStatus,
  fetchScoresStatus,
  normalizeOddsEvent,
  buildMarketsFromEvent,
  toNumericId,
  enrichBadges,
  BLANK_DETAIL,
  type Match,
  type MatchDetail,
  type BettingMarket,
} from "@/lib/theoddsapi";

type CachedFixture = { match: Match; markets: BettingMarket[] };

// Prisma's Json input rejects nested `undefined` (optional logo/flag fields on
// Match are often undefined). Round-trip through JSON to drop them safely.
function toJson<T>(value: T): object {
  return JSON.parse(JSON.stringify(value));
}

// ── Refresh (cron-driven) ───────────────────────────────────────────────────

export interface RefreshResult {
  ok: boolean;
  apiHealthy: boolean;
  sportsFetched: number;
  fixturesUpserted: number;
  resultsRecorded: number;
}

/**
 * Fetch every in-season sport's odds + scores exactly once and upsert into the
 * cache. Intended to be called by the refresh-fixtures cron, NOT by user
 * requests. Badges are enriched here (free TheSportsDB lookups) so reads are
 * pure DB.
 */
export async function refreshFixtureCache(): Promise<RefreshResult> {
  const sports = await getFetchSports();
  let apiHealthy = true;
  let fixturesUpserted = 0;
  let resultsRecorded = 0;

  for (const sport of sports) {
    const [odds, scores] = await Promise.all([
      fetchOddsStatus(sport),
      fetchScoresStatus(sport, 3), // daysFrom=3 catches recently-finished games for settlement
    ]);
    if (odds.failed || scores.failed) {
      apiHealthy = false;
      continue; // skip this sport rather than wipe its cache on an outage
    }

    const scoreById = new Map(scores.data.map((s) => [s.id, s]));
    const now = Date.now();

    // Enrich badges for the whole sport's matches in one bounded batch.
    const baseMatches = odds.data.map((e) => normalizeOddsEvent(e, scoreById.get(e.id)));
    const enriched = await enrichBadges(baseMatches, baseMatches.length);
    const matchByEvent = new Map(odds.data.map((e, i) => [e.id, enriched[i]]));

    for (const event of odds.data) {
      const score = scoreById.get(event.id);
      const match = matchByEvent.get(event.id)!;
      const markets = buildMarketsFromEvent(event);
      const numericId = toNumericId(event.id);
      const completed = !!score?.completed;
      const isLive = !!score && !score.completed && new Date(event.commence_time).getTime() <= now;
      const category = isLive ? "live" : "upcoming";
      const data = toJson({ match, markets });

      await db.fixtureCache.upsert({
        where: { numericId: BigInt(numericId) },
        create: {
          numericId: BigInt(numericId),
          eventId: event.id,
          sportKey: event.sport_key,
          commenceTime: new Date(event.commence_time),
          category,
          completed,
          data,
        },
        update: {
          sportKey: event.sport_key,
          commenceTime: new Date(event.commence_time),
          category,
          completed,
          data,
        },
      });
      fixturesUpserted++;

      if (completed) {
        await recordFinished(numericId, event.id, event.sport_key, match, 5);
        resultsRecorded++;
      }
    }

    // Path 2: finished games that already dropped out of the odds feed but are
    // still in the scores feed — capture their result before they age out.
    for (const score of scores.data) {
      if (!score.completed) continue;
      const numericId = toNumericId(score.id);
      const existing = await db.fixtureResult.findUnique({ where: { numericId: BigInt(numericId) }, select: { numericId: true } });
      if (existing) continue;
      const match = scoreToMatch(numericId, score);
      await recordFinished(numericId, score.id, score.sport_key, match, 5);
      resultsRecorded++;
    }
  }

  // Prune stale upcoming/live rows whose games are well in the past and which
  // have a recorded result (keeps the cache lean; results live in their own table).
  await db.fixtureCache.deleteMany({
    where: { commenceTime: { lt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) } },
  });

  return { ok: true, apiHealthy, sportsFetched: sports.length, fixturesUpserted, resultsRecorded };
}

async function recordFinished(
  numericId: number,
  eventId: string,
  sportKey: string,
  match: Match,
  stateId: number,
) {
  await db.fixtureResult.upsert({
    where: { numericId: BigInt(numericId) },
    create: {
      numericId: BigInt(numericId),
      eventId,
      sportKey,
      homeTeam: match.home.name,
      awayTeam: match.away.name,
      homeScore: match.home.score,
      awayScore: match.away.score,
      stateId,
      data: toJson(match),
    },
    update: {
      homeScore: match.home.score,
      awayScore: match.away.score,
      stateId,
      data: toJson(match),
    },
  });
}

/**
 * Persist a settled/finished fixture discovered during settlement so future
 * runs read it from `fixture_results` instead of re-hitting the Odds API.
 * stateId 5 = finished, 13/17 = void.
 */
export async function persistFinishedDetail(
  numericId: number,
  detail: MatchDetail,
  stateId: number,
): Promise<void> {
  await recordFinished(numericId, detail.match.eventId, detail.match.sportKey, detail.match, stateId);
}

// Build a Match from a scores-feed event (no odds available).
function scoreToMatch(numericId: number, score: {
  id: string; sport_key: string; sport_title: string; commence_time: string;
  home_team: string; away_team: string; scores: { name: string; score: string }[] | null;
}): Match {
  const homeRaw = score.scores?.find((s) => s.name === score.home_team)?.score ?? null;
  const awayRaw = score.scores?.find((s) => s.name === score.away_team)?.score ?? null;
  return {
    id: numericId,
    eventId: score.id,
    sportKey: score.sport_key,
    league: score.sport_title,
    country: "",
    home: { name: score.home_team, score: homeRaw !== null ? Number(homeRaw) : null },
    away: { name: score.away_team, score: awayRaw !== null ? Number(awayRaw) : null },
    period: "FT",
    isLive: false,
    startingAt: score.commence_time,
    odds: [],
    extraMarkets: 0,
  };
}

// ── Reads (served from DB — zero API credits) ───────────────────────────────

export async function readLivescores(limit = 200): Promise<Match[]> {
  const rows = await db.fixtureCache.findMany({
    where: {
      category: "live",
      commenceTime: { gt: new Date(Date.now() - 8 * 60 * 60 * 1000) },
    },
    orderBy: { commenceTime: "asc" },
    take: limit,
  });
  return rows.map((r) => (r.data as unknown as CachedFixture).match);
}

export async function readUpcoming(limit = 200): Promise<Match[]> {
  const rows = await db.fixtureCache.findMany({
    where: { category: "upcoming", commenceTime: { gt: new Date() } },
    orderBy: { commenceTime: "asc" },
    take: limit,
  });
  return rows.map((r) => (r.data as unknown as CachedFixture).match);
}

export async function readFixtureDetail(numericId: number): Promise<MatchDetail | null> {
  // Finished game → permanent result (0 credits, never changes).
  const result = await db.fixtureResult.findUnique({ where: { numericId: BigInt(numericId) } });
  if (result) {
    const match = result.data as unknown as Match;
    return { match, stateId: result.stateId, ...BLANK_DETAIL, markets: [] };
  }
  // Live / upcoming → cached match + markets.
  const cached = await db.fixtureCache.findUnique({ where: { numericId: BigInt(numericId) } });
  if (cached) {
    const { match, markets } = cached.data as unknown as CachedFixture;
    const stateId = cached.completed ? 5 : cached.category === "live" ? 2 : 1;
    return { match, stateId, ...BLANK_DETAIL, markets };
  }
  return null;
}

/** Known finished results for a set of numeric fixture ids (0 credits). */
export async function getKnownResults(
  ids: number[],
): Promise<Map<number, { detail: MatchDetail; stateId: number }>> {
  const out = new Map<number, { detail: MatchDetail; stateId: number }>();
  if (ids.length === 0) return out;
  const rows = await db.fixtureResult.findMany({ where: { numericId: { in: ids.map((n) => BigInt(n)) } } });
  for (const r of rows) {
    const match = r.data as unknown as Match;
    out.set(Number(r.numericId), { detail: { match, stateId: r.stateId, ...BLANK_DETAIL, markets: [] }, stateId: r.stateId });
  }
  return out;
}

/** Cached live/upcoming fixtures plus permanent results for settlement. */
export async function getCachedFixtures(
  ids: number[],
): Promise<Map<number, { detail: MatchDetail; stateId: number }>> {
  const out = await getKnownResults(ids);
  const unresolved = ids.filter((id) => !out.has(id));
  if (unresolved.length === 0) return out;

  const rows = await db.fixtureCache.findMany({
    where: { numericId: { in: unresolved.map((id) => BigInt(id)) } },
  });
  for (const row of rows) {
    const { match, markets } = row.data as unknown as CachedFixture;
    const stateId = row.completed ? 5 : row.category === "live" ? 2 : 1;
    out.set(Number(row.numericId), {
      detail: { match, stateId, ...BLANK_DETAIL, markets },
      stateId,
    });
  }
  return out;
}
