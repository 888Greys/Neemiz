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
import { unstable_cache } from "next/cache";
import {
  getRefreshPlan,
  fetchOddsStatus,
  fetchScoresStatus,
  normalizeOddsEvent,
  buildMarketsFromEvent,
  toNumericId,
  enrichBadges,
  BLANK_DETAIL,
  extraMarketsFromCached,
  type Match,
  type MatchDetail,
  type BettingMarket,
} from "@/lib/theoddsapi";
import { getTeamLogo } from "@/lib/team-logos";
import { getLeagueLogo } from "@/lib/league-logos";

type CachedFixture = { match: Match; markets: BettingMarket[] };

function withStaticLogos(match: Match): Match {
  return {
    ...match,
    leagueLogo: match.leagueLogo ?? getLeagueLogo(match.league),
    home: { ...match.home, logo: match.home.logo ?? getTeamLogo(match.home.name) },
    away: { ...match.away, logo: match.away.logo ?? getTeamLogo(match.away.name) },
  };
}

/** Refresh listMarkets / +N / logos on cache reads so old rows look complete. */
function hydrateCachedMatch(row: CachedFixture): Match {
  const { match, markets } = row;
  const extra = extraMarketsFromCached(markets, match.listMarkets);
  const base = withStaticLogos(match);
  if (!match.listMarkets && match.odds.length > 0) {
    const threeWay = match.odds.map((o) => ({
      key: o.label,
      label: o.label === "1" ? match.home.name : o.label === "2" ? match.away.name : "DRAW",
      value: o.value,
    }));
    const o1 = parseFloat(match.odds.find((o) => o.label === "1")?.value ?? "");
    const ox = parseFloat(match.odds.find((o) => o.label === "X")?.value ?? "");
    const o2 = parseFloat(match.odds.find((o) => o.label === "2")?.value ?? "");
    let doubleChance: { key: string; label: string; value: string }[] = [];
    if (o1 > 1 && ox > 1 && o2 > 1) {
      const p1 = 1 / o1;
      const px = 1 / ox;
      const p2 = 1 / o2;
      const sum = p1 + px + p2;
      const n1 = p1 / sum;
      const nx = px / sum;
      const n2 = p2 / sum;
      const f = (p: number) => Math.max(1.01, 1 / p).toFixed(2);
      doubleChance = [
        { key: "1X", label: "1 OR X", value: f(n1 + nx) },
        { key: "X2", label: "X OR 2", value: f(nx + n2) },
        { key: "12", label: "1 OR 2", value: f(n1 + n2) },
      ];
    }
    const totals = markets.find((m) => m.id === 3);
    let overUnder: { key: string; label: string; value: string }[] = [];
    if (totals?.odds.length) {
      const over = totals.odds.find((o) => /over/i.test(o.label));
      const under = totals.odds.find((o) => /under/i.test(o.label));
      if (over && under) {
        const line = over.extra ?? under.extra ?? "2.5";
        overUnder = [
          { key: `O${line}`, label: `OVER ${Number(line).toFixed(2)}`, value: over.value },
          { key: `U${line}`, label: `UNDER ${Number(line).toFixed(2)}`, value: under.value },
        ];
      }
    }
    return {
      ...base,
      listMarkets: { threeWay, doubleChance, overUnder, btts: [] },
      extraMarkets: extra,
    };
  }
  return { ...base, extraMarkets: extra };
}

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
  estimatedCredits?: number;
  creditsUsed?: number;
  activeLeagues?: number;
  remaining?: number | null;
}

/**
 * Refresh ALL active Odds API leagues on a credit budget.
 * Hot leagues: full markets every run. Others rotate (warm/cold) so every
 * league is covered without blowing the 100K/mo plan. User traffic never
 * calls this — only the refresh-fixtures cron.
 */
export async function refreshFixtureCache(): Promise<RefreshResult> {
  const { plan, estimatedCredits, activeCount } = await getRefreshPlan();
  let apiHealthy = true;
  let fixturesUpserted = 0;
  let resultsRecorded = 0;
  let creditsUsed = 0;
  let remaining: number | null = null;

  for (const item of plan) {
    const oddsPromise = fetchOddsStatus(item.key, item.markets);
    const scoresPromise =
      item.scoresDaysFrom == null
        ? Promise.resolve({
            data: [] as Awaited<ReturnType<typeof fetchScoresStatus>>["data"],
            failed: false,
            credits: 0,
            remaining: null as number | null,
          })
        : fetchScoresStatus(item.key, item.scoresDaysFrom);

    const [odds, scores] = await Promise.all([oddsPromise, scoresPromise]);
    creditsUsed += (odds.credits ?? 0) + (scores.credits ?? 0);
    remaining = scores.remaining ?? odds.remaining ?? remaining;

    if (odds.failed || scores.failed) {
      apiHealthy = false;
      continue;
    }

    const scoreById = new Map(scores.data.map((s) => [s.id, s]));
    const now = Date.now();

    const baseMatches = odds.data.map((e) => normalizeOddsEvent(e, scoreById.get(e.id)));
    // Bound badge enrichment — TheSportsDB is free but rate-limited.
    const enrichCap = item.tier === "hot" ? baseMatches.length : Math.min(40, baseMatches.length);
    const enriched = await enrichBadges(baseMatches, enrichCap);
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

    for (const score of scores.data) {
      if (!score.completed) continue;
      const numericId = toNumericId(score.id);
      const existing = await db.fixtureResult.findUnique({
        where: { numericId: BigInt(numericId) },
        select: { numericId: true },
      });
      if (existing) continue;
      const match = scoreToMatch(numericId, score);
      await recordFinished(numericId, score.id, score.sport_key, match, 5);
      resultsRecorded++;
    }
  }

  await db.fixtureCache.deleteMany({
    where: { commenceTime: { lt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) } },
  });

  console.info(
    `[refresh-fixtures] active=${activeCount} planned=${plan.length} upserted=${fixturesUpserted} ` +
      `estCredits=${estimatedCredits} used≈${creditsUsed} remaining=${remaining ?? "?"}`,
  );

  return {
    ok: true,
    apiHealthy,
    sportsFetched: plan.length,
    fixturesUpserted,
    resultsRecorded,
    estimatedCredits,
    creditsUsed,
    activeLeagues: activeCount,
    remaining,
  };
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

const readLivescoresCached = unstable_cache(async (limit: number): Promise<Match[]> => {
  const rows = await db.fixtureCache.findMany({
    where: {
      category: "live",
      commenceTime: { gt: new Date(Date.now() - 8 * 60 * 60 * 1000) },
    },
    orderBy: { commenceTime: "asc" },
    take: limit,
  });
  return rows.map((r) => hydrateCachedMatch(r.data as unknown as CachedFixture));
}, ["fixture-cache-live"], { revalidate: 15 });

export async function readLivescores(limit = 200): Promise<Match[]> {
  return readLivescoresCached(limit);
}

const readUpcomingCached = unstable_cache(async (limit: number): Promise<Match[]> => {
  const rows = await db.fixtureCache.findMany({
    where: { category: "upcoming", commenceTime: { gt: new Date() } },
    orderBy: { commenceTime: "asc" },
    take: limit,
  });
  return rows.map((r) => hydrateCachedMatch(r.data as unknown as CachedFixture));
}, ["fixture-cache-upcoming"], { revalidate: 15 });

export async function readUpcoming(limit = 200): Promise<Match[]> {
  return readUpcomingCached(limit);
}

function ensureDoubleChanceMarket(markets: BettingMarket[]): BettingMarket[] {
  if (markets.some((m) => m.id === 101 || /double chance/i.test(m.name))) return markets;
  const ftr = markets.find((m) => m.id === 1);
  if (!ftr) return markets;
  const o1 = parseFloat(ftr.odds.find((o) => o.label === "1")?.value ?? "");
  const ox = parseFloat(ftr.odds.find((o) => o.label === "X")?.value ?? "");
  const o2 = parseFloat(ftr.odds.find((o) => o.label === "2")?.value ?? "");
  if (!(o1 > 1 && ox > 1 && o2 > 1)) return markets;
  const p1 = 1 / o1;
  const px = 1 / ox;
  const p2 = 1 / o2;
  const sum = p1 + px + p2;
  const n1 = p1 / sum;
  const nx = px / sum;
  const n2 = p2 / sum;
  const price = (p: number) => Math.max(1.01, 1 / p).toFixed(2);
  const dc: BettingMarket = {
    id: 101,
    name: "Double Chance",
    odds: [
      { label: "1 OR X", value: price(n1 + nx) },
      { label: "X OR 2", value: price(nx + n2) },
      { label: "1 OR 2", value: price(n1 + n2) },
    ],
  };
  const idx = markets.findIndex((m) => m.id === 1);
  const next = [...markets];
  next.splice(idx + 1, 0, dc);
  return next;
}

export async function readFixtureDetail(numericId: number): Promise<MatchDetail | null> {
  // Finished game → permanent result (0 credits, never changes).
  const result = await db.fixtureResult.findUnique({ where: { numericId: BigInt(numericId) } });
  if (result) {
    const match = withStaticLogos(result.data as unknown as Match);
    return { match, stateId: result.stateId, ...BLANK_DETAIL, markets: [] };
  }
  // Live / upcoming → cached match + markets.
  const cached = await db.fixtureCache.findUnique({ where: { numericId: BigInt(numericId) } });
  if (cached) {
    const { match, markets } = cached.data as unknown as CachedFixture;
    const stateId = cached.completed ? 5 : cached.category === "live" ? 2 : 1;
    return {
      match: withStaticLogos(match),
      stateId,
      ...BLANK_DETAIL,
      markets: ensureDoubleChanceMarket(markets),
    };
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
