/**
 * API-Sports (api-football v3) data adapter — EVALUATION / opt-in.
 *
 * Produces the app's normalized `Match` shape from API-Football so the existing
 * cache + UI can render API-Sports data (team logos + 1X2 odds + live scores)
 * without disturbing the live the-odds-api path. Triggered via
 * /api/cron/refresh-fixtures?provider=apisports.
 *
 * Currently SOCCER only, as a proof of coverage. Other sports (basketball /
 * baseball / hockey) use different hosts + response shapes and will be added
 * once the provider/bundle is chosen.
 *
 * Free test key allows 100 requests/day — this refresh is deliberately frugal
 * (a few calls per run) so a demo stays within that.
 */
import { db } from "@/lib/db";
import type { Match, BettingMarket } from "@/lib/theoddsapi";

const KEY = process.env.APISPORTS_KEY ?? "907f93e345f597596b5b642a7866dce2"; // free test key (override via env)
const FOOTBALL = "https://v3.football.api-sports.io";

// ── Raw response types (only the fields we read) ───────────────────────────
interface ApiFixture {
  fixture: { id: number; date: string; status: { short: string; long: string; elapsed: number | null } };
  league: { id: number; name: string; country: string; logo: string | null; flag: string | null };
  teams: { home: { id: number; name: string; logo: string | null }; away: { id: number; name: string; logo: string | null } };
  goals: { home: number | null; away: number | null };
}
interface ApiOddsResp {
  fixture: { id: number };
  bookmakers: { id: number; name: string; bets: { id: number; name: string; values: { value: string; odd: string }[] }[] }[];
}

const LIVE_CODES = new Set(["1H", "2H", "HT", "ET", "BT", "P", "LIVE", "INT"]);
const FINISHED_CODES = new Set(["FT", "AET", "PEN"]);

async function apiGet<T>(host: string, path: string): Promise<{ data: T[]; failed: boolean }> {
  try {
    const r = await fetch(`${host}${path}`, {
      headers: { "x-apisports-key": KEY },
      next: { revalidate: 120 },
    });
    if (!r.ok) {
      console.error(`API-Sports ${path} → ${r.status}`);
      return { data: [], failed: r.status === 401 || r.status === 429 || r.status >= 500 };
    }
    const json = (await r.json()) as { response?: T[]; errors?: unknown };
    const errs = json.errors;
    const hasErrors = Array.isArray(errs) ? errs.length > 0 : !!errs && Object.keys(errs as object).length > 0;
    if (hasErrors) console.error(`API-Sports ${path} errors:`, JSON.stringify(errs));
    return { data: json.response ?? [], failed: hasErrors && (json.response?.length ?? 0) === 0 };
  } catch (e) {
    console.error("API-Sports fetch error:", e);
    return { data: [], failed: true };
  }
}

function stateId(short: string): number {
  if (FINISHED_CODES.has(short)) return 5;
  if (LIVE_CODES.has(short)) return 2;
  return 1;
}

function normalize(f: ApiFixture, odds?: { home?: string; draw?: string; away?: string }): Match {
  const short = f.fixture.status.short;
  const isLive = LIVE_CODES.has(short);
  const isFinished = FINISHED_CODES.has(short);
  const o: { label: string; value: string }[] = [];
  if (odds?.home) o.push({ label: "1", value: Number(odds.home).toFixed(2) });
  if (odds?.draw) o.push({ label: "X", value: Number(odds.draw).toFixed(2) });
  if (odds?.away) o.push({ label: "2", value: Number(odds.away).toFixed(2) });

  return {
    id: f.fixture.id,
    eventId: String(f.fixture.id),
    sportKey: `football_${f.league.id}`,
    league: f.league.name,
    leagueLogo: f.league.logo ?? undefined,
    country: f.league.country,
    countryFlag: f.league.flag ?? undefined,
    home: { name: f.teams.home.name, logo: f.teams.home.logo ?? undefined, score: f.goals.home },
    away: { name: f.teams.away.name, logo: f.teams.away.logo ?? undefined, score: f.goals.away },
    period: isFinished ? "FT" : isLive ? (f.fixture.status.elapsed ? `${f.fixture.status.elapsed}'` : "Live") : new Date(f.fixture.date).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
    isLive,
    startingAt: f.fixture.date,
    odds: o,
    extraMarkets: 0,
  };
}

// Build a fixtureId → 1X2 map from an /odds response (Match Winner, bet id 1).
function oddsMap(rows: ApiOddsResp[]): Map<number, { home?: string; draw?: string; away?: string }> {
  const m = new Map<number, { home?: string; draw?: string; away?: string }>();
  for (const row of rows) {
    const bm = row.bookmakers?.[0];
    const matchWinner = bm?.bets?.find((b) => b.id === 1 || /match winner|1x2/i.test(b.name));
    if (!matchWinner) continue;
    const get = (v: string) => matchWinner.values.find((x) => x.value.toLowerCase() === v)?.odd;
    m.set(row.fixture.id, { home: get("home"), draw: get("draw"), away: get("away") });
  }
  return m;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export interface ApiSportsRefreshResult {
  ok: boolean;
  provider: "apisports";
  apiHealthy: boolean;
  liveFixtures: number;
  upcomingFixtures: number;
  withOdds: number;
  upserted: number;
}

/**
 * Frugal soccer refresh: live games + tomorrow's fixtures + a page of odds,
 * upserted into the same fixtures_cache the UI reads.
 */
export async function refreshSoccerFromApiSports(): Promise<ApiSportsRefreshResult> {
  const tomorrow = isoDate(new Date(Date.now() + 24 * 60 * 60 * 1000));

  const [live, upcoming, oddsResp] = await Promise.all([
    apiGet<ApiFixture>(FOOTBALL, `/fixtures?live=all`),
    apiGet<ApiFixture>(FOOTBALL, `/fixtures?date=${tomorrow}`),
    apiGet<ApiOddsResp>(FOOTBALL, `/odds?date=${tomorrow}&page=1`),
  ]);

  const apiHealthy = !live.failed && !upcoming.failed;
  const odds = oddsMap(oddsResp.data);
  let withOdds = 0;
  let upserted = 0;

  const rows: { fixture: ApiFixture; category: "live" | "upcoming" }[] = [
    ...live.data.map((f) => ({ fixture: f, category: "live" as const })),
    ...upcoming.data
      .filter((f) => f.fixture.status.short === "NS")
      .slice(0, 150)
      .map((f) => ({ fixture: f, category: "upcoming" as const })),
  ];

  for (const { fixture, category } of rows) {
    const o = odds.get(fixture.fixture.id);
    if (o && (o.home || o.away)) withOdds++;
    const match = normalize(fixture, o);
    const markets: BettingMarket[] = match.odds.length
      ? [{ id: 1, name: "Full Time Result", odds: match.odds.map((x) => ({ label: x.label, value: x.value })) }]
      : [];
    const data = JSON.parse(JSON.stringify({ match, markets }));
    const numericId = BigInt(fixture.fixture.id);
    const completed = FINISHED_CODES.has(fixture.fixture.status.short);

    await db.fixtureCache.upsert({
      where: { numericId },
      create: { numericId, eventId: String(fixture.fixture.id), sportKey: match.sportKey, commenceTime: new Date(fixture.fixture.date), category, completed, data },
      update: { sportKey: match.sportKey, commenceTime: new Date(fixture.fixture.date), category, completed, data },
    });
    upserted++;
  }

  return {
    ok: true,
    provider: "apisports",
    apiHealthy,
    liveFixtures: live.data.length,
    upcomingFixtures: upcoming.data.length,
    withOdds,
    upserted,
  };
}
