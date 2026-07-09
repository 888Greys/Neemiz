import { getTeamLogo } from "@/lib/team-logos";

const BASE    = "https://api.the-odds-api.com/v4";
const API_KEY = process.env.ODDS_API_KEY ?? "";

const FLAG = (code: string) => `https://flagcdn.com/w40/${code}.png`;

// Map sport_key → display info. `un` (United Nations) flag stands in for
// international competitions (World Cup, cricket internationals, boxing).
const SPORT_META: Record<string, { league: string; country: string; flag: string }> = {
  // ── Soccer ──
  soccer_epl:                        { league: "Premier League",   country: "England",       flag: FLAG("gb-eng") },
  soccer_spain_la_liga:              { league: "La Liga",          country: "Spain",         flag: FLAG("es")     },
  soccer_germany_bundesliga:         { league: "Bundesliga",       country: "Germany",       flag: FLAG("de")     },
  soccer_italy_serie_a:              { league: "Serie A",          country: "Italy",         flag: FLAG("it")     },
  soccer_france_ligue_one:           { league: "Ligue 1",          country: "France",        flag: FLAG("fr")     },
  soccer_uefa_champs_league:         { league: "Champions League", country: "Europe",        flag: FLAG("eu")     },
  soccer_uefa_europa_league:         { league: "Europa League",    country: "Europe",        flag: FLAG("eu")     },
  soccer_africa_cup_of_nations:      { league: "AFCON",            country: "Africa",        flag: FLAG("un")     },
  soccer_kenya_premier_league:       { league: "KPL",              country: "Kenya",         flag: FLAG("ke")     },
  soccer_turkey_super_league:        { league: "Süper Lig",        country: "Turkey",        flag: FLAG("tr")     },
  soccer_netherlands_eredivisie:     { league: "Eredivisie",       country: "Netherlands",   flag: FLAG("nl")     },
  soccer_portugal_primeira_liga:     { league: "Primeira Liga",    country: "Portugal",      flag: FLAG("pt")     },
  soccer_fifa_world_cup:             { league: "FIFA World Cup",   country: "World",         flag: FLAG("un")     },
  soccer_conmebol_copa_libertadores: { league: "Copa Libertadores",country: "South America", flag: FLAG("un")     },
  soccer_conmebol_copa_sudamericana: { league: "Copa Sudamericana",country: "South America", flag: FLAG("un")     },
  soccer_brazil_serie_b:             { league: "Brazil Série B",   country: "Brazil",        flag: FLAG("br")     },
  soccer_chile_campeonato:           { league: "Primera División", country: "Chile",         flag: FLAG("cl")     },
  soccer_china_superleague:          { league: "Super League",     country: "China",         flag: FLAG("cn")     },
  soccer_japan_j_league:             { league: "J League",         country: "Japan",         flag: FLAG("jp")     },
  soccer_norway_eliteserien:         { league: "Eliteserien",      country: "Norway",        flag: FLAG("no")     },
  soccer_spain_segunda_division:     { league: "La Liga 2",        country: "Spain",         flag: FLAG("es")     },
  soccer_sweden_allsvenskan:         { league: "Allsvenskan",      country: "Sweden",        flag: FLAG("se")     },
  soccer_sweden_superettan:          { league: "Superettan",       country: "Sweden",        flag: FLAG("se")     },
  // ── Basketball ──
  basketball_nba:                    { league: "NBA",              country: "USA",           flag: FLAG("us")     },
  basketball_wnba:                   { league: "WNBA",             country: "USA",           flag: FLAG("us")     },
  basketball_euroleague:             { league: "EuroLeague",       country: "Europe",        flag: FLAG("eu")     },
  // ── American Football ──
  americanfootball_nfl:              { league: "NFL",              country: "USA",           flag: FLAG("us")     },
  americanfootball_nfl_preseason:    { league: "NFL Preseason",    country: "USA",           flag: FLAG("us")     },
  americanfootball_ncaaf:            { league: "NCAAF",            country: "USA",           flag: FLAG("us")     },
  americanfootball_cfl:              { league: "CFL",              country: "Canada",        flag: FLAG("ca")     },
  americanfootball_ufl:              { league: "UFL",              country: "USA",           flag: FLAG("us")     },
  // ── Baseball ──
  baseball_mlb:                      { league: "MLB",              country: "USA",           flag: FLAG("us")     },
  baseball_kbo:                      { league: "KBO",              country: "South Korea",   flag: FLAG("kr")     },
  baseball_npb:                      { league: "NPB",              country: "Japan",         flag: FLAG("jp")     },
  baseball_ncaa:                     { league: "NCAA Baseball",    country: "USA",           flag: FLAG("us")     },
  // ── Ice Hockey ──
  icehockey_nhl:                     { league: "NHL",              country: "USA",           flag: FLAG("us")     },
  icehockey_ahl:                     { league: "AHL",              country: "USA",           flag: FLAG("us")     },
  // ── Rugby League ──
  rugbyleague_nrl:                   { league: "NRL",              country: "Australia",     flag: FLAG("au")     },
  rugbyleague_nrl_state_of_origin:   { league: "State of Origin",  country: "Australia",     flag: FLAG("au")     },
  // ── Other ──
  aussierules_afl:                   { league: "AFL",              country: "Australia",     flag: FLAG("au")     },
  handball_germany_bundesliga:       { league: "Handball-Bundesliga", country: "Germany",    flag: FLAG("de")     },
  lacrosse_pll:                      { league: "PLL",              country: "USA",           flag: FLAG("us")     },
  // ── Cricket ──
  cricket_odi:                       { league: "One Day Internationals", country: "International", flag: FLAG("un") },
  cricket_test_match:                { league: "Test Matches",     country: "International",  flag: FLAG("un")     },
  cricket_t20_blast:                 { league: "T20 Blast",        country: "England",        flag: FLAG("gb-eng") },
  cricket_icc_world_cup:             { league: "ICC World Cup",    country: "International",   flag: FLAG("un")     },
  // ── Tennis ──
  tennis_atp_french_open:            { league: "French Open (ATP)", country: "France",       flag: FLAG("fr")     },
  tennis_wta_french_open:            { league: "French Open (WTA)", country: "France",       flag: FLAG("fr")     },
  // ── Combat ──
  mma_mixed_martial_arts:            { league: "MMA / UFC",        country: "USA",           flag: FLAG("us")     },
  boxing_boxing:                     { league: "Boxing",           country: "International",  flag: FLAG("un")     },
};

// Fallback list if the /sports discovery call fails or the key is missing.
const FALLBACK_SPORTS = [
  "soccer_epl",
  "soccer_spain_la_liga",
  "soccer_germany_bundesliga",
  "soccer_italy_serie_a",
  "basketball_nba",
];

// We no longer hardcode leagues (they go off-season). Instead we ask the API
// which sports are in season and pull odds for those — prioritising the most
// popular groups first and capping the count to stay within quota.
const PREFERRED_GROUPS = [
  "Soccer", "Basketball", "American Football", "Ice Hockey", "Baseball",
  "Tennis", "Mixed Martial Arts", "Boxing", "Cricket", "Rugby League", "Rugby Union",
];
const MAX_SPORTS = 12;

interface SportInfo { key: string; group: string; title: string; active: boolean; has_outrights: boolean; }

// The /sports endpoint is free (doesn't consume the odds quota). Cached 6h
// since the in-season set changes slowly. Returns in-season sport keys,
// most-popular groups first.
// Marquee competitions floated to the front of their group.
const MARQUEE_KEYS = [
  "world_cup", "uefa_champs", "uefa_europa", "libertadores", "sudamericana",
  "epl", "la_liga", "serie_a", "bundesliga", "ligue_one",
  "nba", "nfl", "nhl", "mlb",
];

export async function getFetchSports(): Promise<string[]> {
  if (!API_KEY) return FALLBACK_SPORTS;
  try {
    const res = await fetch(`${BASE}/sports?apiKey=${API_KEY}`, { next: { revalidate: 21600 } });
    if (!res.ok) return FALLBACK_SPORTS;
    const sports = (await res.json()) as SportInfo[];
    // In-season + real match markets only (skip tournament-winner / outright futures).
    const active = sports.filter((s) => s.active && !s.has_outrights);
    if (active.length === 0) return FALLBACK_SPORTS;

    const groupRank   = (g: string) => { const i = PREFERRED_GROUPS.indexOf(g); return i === -1 ? 999 : i; };
    const marqueeRank = (k: string) => { const i = MARQUEE_KEYS.findIndex((m) => k.includes(m)); return i === -1 ? 99 : i; };

    // Bucket by group, marquee competitions first within each.
    const buckets = new Map<number, SportInfo[]>();
    for (const s of active) {
      const key = groupRank(s.group);
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key)!.push(s);
    }
    for (const arr of buckets.values()) arr.sort((a, b) => marqueeRank(a.key) - marqueeRank(b.key));

    // Round-robin across groups (preferred order) so the mix is varied,
    // not 12 soccer leagues.
    const order = [...buckets.keys()].sort((a, b) => a - b);
    const picked: string[] = [];
    for (let i = 0; picked.length < MAX_SPORTS; i++) {
      let added = false;
      for (const g of order) {
        const s = buckets.get(g)![i];
        if (s) { picked.push(s.key); added = true; if (picked.length >= MAX_SPORTS) break; }
      }
      if (!added) break;
    }
    return picked.length ? picked : FALLBACK_SPORTS;
  } catch (e) {
    console.error("OddsAPI getFetchSports error:", e);
    return FALLBACK_SPORTS;
  }
}

// ── State IDs (mirrors Sportmonks convention so settle-bet.ts needs no changes)
// 1 = Not Started, 2 = Live, 5 = Finished
export const FINISHED_STATE_IDS = new Set([5]);

// ── Raw API types ─────────────────────────────────────────────────────────────

interface OddsOutcome {
  name:   string;
  price:  number;
  point?: number;   // used by totals (Over/Under) and spreads (Handicap)
}

export interface OddsEvent {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers?: {
    key: string;
    title: string;
    markets: {
      key: string;
      outcomes: OddsOutcome[];
    }[];
  }[];
}

export interface ScoreEvent {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string;
  completed: boolean;
  home_team: string;
  away_team: string;
  scores: { name: string; score: string }[] | null;
  last_update: string | null;
}

// ── Normalised UI types ───────────────────────────────────────────────────────

export interface Match {
  id: number;
  eventId: string;     // original Odds API string ID (for re-fetching)
  sportKey: string;
  league: string;
  leagueLogo?: string;
  country: string;
  countryFlag?: string;
  home: { name: string; logo?: string; score: number | null };
  away: { name: string; logo?: string; score: number | null };
  period: string;
  isLive: boolean;
  startingAt: string;
  odds: { label: string; value: string }[];
  extraMarkets: number;
}

// Empty stub types — Odds API doesn't supply lineup/events data,
// but these must be exported so all callers compile unchanged.
export interface MatchEvent {
  id: number;
  type_id: number;
  participant_id: number;
  player_name: string;
  related_player_name: string | null;
  minute: number;
  extra_minute: number | null;
  result: string | null;
  info: string | null;
  addition: string | null;
}

export interface MatchStat {
  name: string;
  home: number | null;
  away: number | null;
}

export interface LineupEntry {
  player_id: number;
  player_name: string;
  participant_id: number;
  jersey_number: number | null;
  formation_position: number | null;
  on_bench: boolean;
}

export interface MarketOdd {
  label: string;
  value: string;
  extra?: string;
}

export interface BettingMarket {
  id: number;
  name: string;
  odds: MarketOdd[];
}

export interface MatchDetail {
  match: Match;
  stateId: number;
  homeParticipantId: number;
  awayParticipantId: number;
  events: MatchEvent[];
  stats: MatchStat[];
  homeLineup: LineupEntry[];
  awayLineup: LineupEntry[];
  homePeriodScores: (number | null)[];
  awayPeriodScores: (number | null)[];
  markets: BettingMarket[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

// Convert hex event ID to stable integer for URL params / DB storage
export function toNumericId(eventId: string): number {
  return parseInt(eventId.replace(/[^0-9a-f]/gi, "").slice(0, 8), 16) || 0;
}

function formatKickoffTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "--:--";
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function extractH2hOdds(
  event: OddsEvent,
): { odds: { label: string; value: string }[]; extraMarkets: number } {
  if (!event.bookmakers?.length) return { odds: [], extraMarkets: 0 };

  for (const bm of event.bookmakers) {
    const h2h = bm.markets.find((m) => m.key === "h2h");
    if (!h2h?.outcomes?.length) continue;

    const outcomes = h2h.outcomes;
    const homeOdds = outcomes.find((o) => o.name === event.home_team);
    const awayOdds = outcomes.find((o) => o.name === event.away_team);
    const drawOdds = outcomes.find((o) => o.name === "Draw");

    const odds: { label: string; value: string }[] = [];
    if (homeOdds) odds.push({ label: "1", value: homeOdds.price.toFixed(2) });
    if (drawOdds) odds.push({ label: "X", value: drawOdds.price.toFixed(2) });
    if (awayOdds) odds.push({ label: "2", value: awayOdds.price.toFixed(2) });

    const extraMarkets = bm.markets.length - 1;
    return { odds, extraMarkets: Math.max(0, extraMarkets) };
  }

  return { odds: [], extraMarkets: 0 };
}

export function normalizeOddsEvent(event: OddsEvent, liveScore?: ScoreEvent): Match {
  const meta  = SPORT_META[event.sport_key];
  const { odds, extraMarkets } = extractH2hOdds(event);

  const homeScore = liveScore?.scores?.find((s) => s.name === event.home_team)?.score ?? null;
  const awayScore = liveScore?.scores?.find((s) => s.name === event.away_team)?.score ?? null;
  // A game is only "live" once kickoff has passed. TheOddsAPI returns
  // not-yet-started games in the scores feed with completed:false too, so
  // !completed alone would wrongly flag pre-game matches as live.
  const hasKickedOff = new Date(event.commence_time).getTime() <= Date.now();
  const isLive    = !!liveScore && !liveScore.completed && hasKickedOff;

  const period = isLive ? "Live" : formatKickoffTime(event.commence_time);

  return {
    id:           toNumericId(event.id),
    eventId:      event.id,
    sportKey:     event.sport_key,
    league:       meta?.league ?? event.sport_title,
    country:      meta?.country ?? "",
    countryFlag:  meta?.flag ?? undefined,
    home:         { name: event.home_team, score: homeScore !== null ? Number(homeScore) : null },
    away:         { name: event.away_team, score: awayScore !== null ? Number(awayScore) : null },
    period,
    isLive,
    startingAt:   event.commence_time,
    odds,
    extraMarkets,
  };
}

// Build BettingMarket[] from all bookmaker markets on an event.
// Picks the bookmaker with the most market types, then normalises each market.
export function buildMarketsFromEvent(event: OddsEvent): BettingMarket[] {
  if (!event.bookmakers?.length) return [];

  // Pick the bookmaker with the most distinct market keys
  const bm = event.bookmakers.reduce((best, cur) =>
    cur.markets.length > best.markets.length ? cur : best,
  );

  const MARKET_META: Record<string, { id: number; name: string }> = {
    h2h:     { id: 1, name: "Full Time Result" },
    spreads: { id: 2, name: "Handicap" },
    totals:  { id: 3, name: "Over/Under" },
    btts:    { id: 4, name: "Both Teams To Score" },
  };

  const markets: BettingMarket[] = [];

  for (const market of bm.markets) {
    const meta = MARKET_META[market.key];
    if (!meta) continue;

    const odds: MarketOdd[] = market.outcomes.map((o) => {
      if (market.key === "h2h") {
        // Normalise team names → 1/X/2
        const labelMap: Record<string, string> = {
          [event.home_team]: "1",
          [event.away_team]: "2",
          "Draw": "X",
        };
        return { label: labelMap[o.name] ?? o.name, value: o.price.toFixed(2) };
      }
      if (market.key === "totals") {
        // e.g. "Over 2.5", "Under 2.5"
        return {
          label: o.name,
          value: o.price.toFixed(2),
          extra: o.point !== undefined ? String(o.point) : undefined,
        };
      }
      if (market.key === "spreads") {
        const label = o.name === event.home_team ? "1" : "2";
        return {
          label,
          value: o.price.toFixed(2),
          extra: o.point !== undefined ? (o.point > 0 ? `+${o.point}` : String(o.point)) : undefined,
        };
      }
      // btts / other
      return { label: o.name, value: o.price.toFixed(2) };
    });

    if (odds.length > 0) markets.push({ id: meta.id, name: meta.name, odds });
  }

  // Sort by market id so Full Time Result appears first
  return markets.sort((a, b) => a.id - b.id);
}

// ── Fetchers ──────────────────────────────────────────────────────────────────

// A 401 (out of credits / bad key) or 429 (rate limited) means the API is
// genuinely unavailable — distinct from 404 (sport simply has no current
// games). Callers that make financial decisions (settlement / refunds) must
// not treat an outage as "no data".
function isApiOutage(status: number): boolean {
  return status === 401 || status === 429 || status >= 500;
}

export async function fetchOddsStatus(sportKey: string): Promise<{ data: OddsEvent[]; failed: boolean }> {
  if (!API_KEY) return { data: [], failed: true };
  const url = `${BASE}/sports/${sportKey}/odds?apiKey=${API_KEY}&regions=eu&markets=h2h,totals,spreads&oddsFormat=decimal`;
  try {
    const res = await fetch(url, { next: { revalidate: 7200 } });
    if (!res.ok) {
      if (isApiOutage(res.status)) console.error(`OddsAPI odds ${sportKey} → ${res.status} (API outage / quota)`);
      else if (res.status !== 404) console.error(`OddsAPI odds ${sportKey} → ${res.status}`);
      return { data: [], failed: isApiOutage(res.status) };
    }
    return { data: (await res.json()) as OddsEvent[], failed: false };
  } catch (e) {
    console.error("OddsAPI fetchOdds error:", e);
    return { data: [], failed: true };
  }
}

export async function fetchScoresStatus(sportKey: string, daysFrom = 1): Promise<{ data: ScoreEvent[]; failed: boolean }> {
  if (!API_KEY) return { data: [], failed: true };
  const url = `${BASE}/sports/${sportKey}/scores?apiKey=${API_KEY}&daysFrom=${daysFrom}`;
  try {
    const res = await fetch(url, { next: { revalidate: 120 } });
    if (!res.ok) {
      if (isApiOutage(res.status)) console.error(`OddsAPI scores ${sportKey} → ${res.status} (API outage / quota)`);
      return { data: [], failed: isApiOutage(res.status) };
    }
    return { data: (await res.json()) as ScoreEvent[], failed: false };
  } catch (e) {
    console.error("OddsAPI fetchScores error:", e);
    return { data: [], failed: true };
  }
}

async function fetchOdds(sportKey: string): Promise<OddsEvent[]> {
  return (await fetchOddsStatus(sportKey)).data;
}

async function fetchScores(sportKey: string, daysFrom = 1): Promise<ScoreEvent[]> {
  return (await fetchScoresStatus(sportKey, daysFrom)).data;
}

// ── Team badge enrichment (TheSportsDB) ────────────────────────────────────────
// TheOddsAPI gives no team logos, so we look up a badge by team name from
// TheSportsDB (free). Cached 30 days (badges never change); any miss/failure
// falls back to the coloured-initial avatar in the UI.
const SPORTSDB_KEY = "3"; // public test key

async function fetchTeamBadge(name: string): Promise<string | undefined> {
  if (!name) return undefined;
  try {
    const res = await fetch(
      `https://www.thesportsdb.com/api/v1/json/${SPORTSDB_KEY}/searchteams.php?t=${encodeURIComponent(name)}`,
      { next: { revalidate: 2_592_000 } },
    );
    if (!res.ok) return undefined;
    const data = (await res.json()) as { teams?: { strBadge?: string; strTeamBadge?: string }[] } | null;
    const t = data?.teams?.[0];
    return t?.strBadge || t?.strTeamBadge || undefined;
  } catch {
    return undefined;
  }
}

// Attach team badges to the first `cap` matches (bounded concurrency so we
// don't burst TheSportsDB on a cold cache). Beyond the cap, matches keep their
// initial-avatar fallback; the 30-day cache warms more over time.
export async function enrichBadges(matches: Match[], cap: number): Promise<Match[]> {
  const names = [...new Set(
    matches.slice(0, cap).flatMap((m) => [m.home.name, m.away.name]),
  )].filter(Boolean);

  const badges = new Map<string, string | undefined>();
  const BATCH = 8;
  for (let i = 0; i < names.length; i += BATCH) {
    const batch = names.slice(i, i + BATCH);
    const found = await Promise.all(batch.map(fetchTeamBadge));
    batch.forEach((n, j) => badges.set(n, found[j]));
  }

  return matches.map((m, idx) =>
    idx >= cap ? m : {
      ...m,
      home: {
        ...m.home,
        logo: m.home.logo ?? getTeamLogo(m.home.name) ?? badges.get(m.home.name),
      },
      away: {
        ...m.away,
        logo: m.away.logo ?? getTeamLogo(m.away.name) ?? badges.get(m.away.name),
      },
    },
  );
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function getLivescores(): Promise<Match[]> {
  const now = Date.now();
  const FETCH_SPORTS = await getFetchSports();
  const results = await Promise.all(
    FETCH_SPORTS.map(async (sport) => {
      const [odds, scores] = await Promise.all([fetchOdds(sport), fetchScores(sport)]);
      const scoreMap = new Map(scores.map((s) => [s.id, s]));
      return odds
        .filter((e) => {
          const score = scoreMap.get(e.id);
          // Truly live = in scores feed, not finished, AND kickoff has passed.
          // Pre-game matches (completed:false, scores:null) are excluded here
          // and fall through to getUpcomingFixtures instead.
          return score && !score.completed && new Date(e.commence_time).getTime() <= now;
        })
        .map((e) => normalizeOddsEvent(e, scoreMap.get(e.id)));
    }),
  );
  return enrichBadges(results.flat(), 30);
}

export async function getUpcomingFixtures(): Promise<Match[]> {
  const now = Date.now();
  const FETCH_SPORTS = await getFetchSports();
  const results = await Promise.all(
    FETCH_SPORTS.map(async (sport) => {
      const [odds, scores] = await Promise.all([fetchOdds(sport), fetchScores(sport)]);
      const scoreMap = new Map(scores.map((s) => [s.id, s]));
      // Only genuinely-live games (kicked off + not completed) are excluded.
      const liveIds = new Set(
        odds
          .filter((e) => {
            const s = scoreMap.get(e.id);
            return s && !s.completed && new Date(e.commence_time).getTime() <= now;
          })
          .map((e) => e.id),
      );
      return odds
        .filter((e) => {
          if (liveIds.has(e.id)) return false;
          return new Date(e.commence_time).getTime() > now;
        })
        .map((e) => normalizeOddsEvent(e));
    }),
  );
  const fixtures = results.flat().sort(
    (a, b) => new Date(a.startingAt).getTime() - new Date(b.startingAt).getTime(),
  ).slice(0, 200);
  return enrichBadges(fixtures, 60);
}

// Fetch full match detail for the fixture detail page and bet verification.
// Searches all tracked sports for the event matching the numeric ID.
// Returns empty events/stats/lineups — Odds API doesn't supply those.
// Stub fields the Odds API can't supply, shared by every MatchDetail we build.
export const BLANK_DETAIL = {
  homeParticipantId: 0, awayParticipantId: 0,
  events: [] as MatchEvent[], stats: [] as MatchStat[],
  homeLineup: [] as LineupEntry[], awayLineup: [] as LineupEntry[],
  homePeriodScores: [null, null] as (number | null)[],
  awayPeriodScores: [null, null] as (number | null)[],
};

// Build a MatchDetail for a finished/aged game that only exists in the scores
// feed (left the odds feed). Shared by getFixtureDetail and getSettlementFixtures.
export function detailFromScore(id: number, score: ScoreEvent): { detail: MatchDetail; stateId: number } {
  const isFinished = !!score.completed;
  const isLive     = !score.completed && new Date(score.commence_time).getTime() <= Date.now();
  const stateId    = isFinished ? 5 : isLive ? 2 : 1;
  const meta       = SPORT_META[score.sport_key];
  const homeRaw    = score.scores?.find((s) => s.name === score.home_team)?.score ?? null;
  const awayRaw    = score.scores?.find((s) => s.name === score.away_team)?.score ?? null;

  const match: Match = {
    id,
    eventId:     score.id,
    sportKey:    score.sport_key,
    league:      meta?.league ?? score.sport_title,
    country:     meta?.country ?? "",
    countryFlag: meta?.flag ?? undefined,
    home: { name: score.home_team, score: homeRaw !== null ? Number(homeRaw) : null },
    away: { name: score.away_team, score: awayRaw !== null ? Number(awayRaw) : null },
    period:      isFinished ? "FT" : isLive ? "Live" : formatKickoffTime(score.commence_time),
    isLive,
    startingAt:  score.commence_time,
    odds:        [],
    extraMarkets: 0,
  };
  return { detail: { match, stateId, ...BLANK_DETAIL, markets: [] }, stateId };
}

// Resolve many fixtures for settlement in a SINGLE pass over the in-season
// sports. The old approach called getFixtureDetail once per fixture, and each
// of those looped every sport (fetchOdds + fetchScores) — O(fixtures × sports)
// API credits per cron run, which exhausted the Odds API plan within hours.
// This fetches each sport's feeds exactly once → O(sports), constant in the
// number of pending fixtures. `apiHealthy` is false when any sport's feed call
// hit a genuine outage (401 out-of-credits / 429 / 5xx), so the caller can
// avoid making refund/void decisions from missing data.
export async function getSettlementFixtures(
  ids: number[],
  opts?: { sportKeys?: string[] },
): Promise<{ fixtures: Map<number, { detail: MatchDetail; stateId: number }>; apiHealthy: boolean }> {
  const wanted = new Set(ids);
  const fixtures = new Map<number, { detail: MatchDetail; stateId: number }>();
  if (!API_KEY || wanted.size === 0) return { fixtures, apiHealthy: !!API_KEY };

  // Narrow to the sports the pending bets actually belong to when known —
  // turns an all-sports scan into a couple of targeted calls. Falls back to the
  // full in-season list when any fixture's sport is unknown (legacy rows).
  const narrowed = opts?.sportKeys?.filter(Boolean);
  const FETCH_SPORTS = narrowed && narrowed.length > 0 ? Array.from(new Set(narrowed)) : await getFetchSports();
  let apiHealthy = true;

  const perSport = await Promise.all(
    FETCH_SPORTS.map(async (sport) => {
      const [odds, scores] = await Promise.all([
        fetchOddsStatus(sport),
        fetchScoresStatus(sport, 3), // daysFrom=3 (API max) to catch recently-finished games
      ]);
      if (odds.failed || scores.failed) apiHealthy = false;
      return { odds: odds.data, scores: scores.data };
    }),
  );

  for (const { odds, scores } of perSport) {
    const scoreById = new Map(scores.map((s) => [s.id, s]));

    // Path 1: games still in the odds feed (upcoming / live / just-finished).
    for (const event of odds) {
      const nid = toNumericId(event.id);
      if (!wanted.has(nid) || fixtures.has(nid)) continue;
      const score      = scoreById.get(event.id);
      const isFinished = !!score?.completed;
      const isLive     = !!score && !score.completed && new Date(event.commence_time).getTime() <= Date.now();
      const stateId    = isFinished ? 5 : isLive ? 2 : 1;
      const match      = normalizeOddsEvent(event, score ?? undefined);
      fixtures.set(nid, { detail: { match, stateId, ...BLANK_DETAIL, markets: buildMarketsFromEvent(event) }, stateId });
    }

    // Path 2: finished games that have left the odds feed but are still in scores.
    for (const score of scores) {
      const nid = toNumericId(score.id);
      if (!wanted.has(nid) || fixtures.has(nid)) continue;
      fixtures.set(nid, detailFromScore(nid, score));
    }
  }

  return { fixtures, apiHealthy };
}

export async function getFixtureDetail(id: number): Promise<MatchDetail | null> {
  const FETCH_SPORTS = await getFetchSports();
  const blank = BLANK_DETAIL;

  for (const sport of FETCH_SPORTS) {
    const [odds, scores] = await Promise.all([
      fetchOdds(sport),
      fetchScores(sport, 3),   // daysFrom=3 (API max) so settlement catches finished games
    ]);

    // ── Path 1: game still in the odds feed (upcoming / live) ──
    const event = odds.find((e) => toNumericId(e.id) === id);
    if (event) {
      const score      = scores.find((s) => s.id === event.id);
      const isFinished = !!score?.completed;
      const isLive     = !!score && !score.completed && new Date(event.commence_time).getTime() <= Date.now();
      const stateId    = isFinished ? 5 : isLive ? 2 : 1;

      const match = normalizeOddsEvent(event, score ?? undefined);
      const [homeBadge, awayBadge] = await Promise.all([
        fetchTeamBadge(match.home.name),
        fetchTeamBadge(match.away.name),
      ]);
      match.home.logo = match.home.logo ?? homeBadge;
      match.away.logo = match.away.logo ?? awayBadge;

      return { match, stateId, ...blank, markets: buildMarketsFromEvent(event) };
    }

    // ── Path 2: finished game that's left the odds feed — settle from scores ──
    const score = scores.find((s) => toNumericId(s.id) === id);
    if (score) {
      const isFinished = !!score.completed;
      const isLive     = !score.completed && new Date(score.commence_time).getTime() <= Date.now();
      const stateId    = isFinished ? 5 : isLive ? 2 : 1;
      const meta       = SPORT_META[score.sport_key];
      const homeRaw    = score.scores?.find((s) => s.name === score.home_team)?.score ?? null;
      const awayRaw    = score.scores?.find((s) => s.name === score.away_team)?.score ?? null;

      const match: Match = {
        id,
        eventId:     score.id,
        sportKey:    score.sport_key,
        league:      meta?.league ?? score.sport_title,
        country:     meta?.country ?? "",
        countryFlag: meta?.flag ?? undefined,
        home: { name: score.home_team, score: homeRaw !== null ? Number(homeRaw) : null },
        away: { name: score.away_team, score: awayRaw !== null ? Number(awayRaw) : null },
        period:      isFinished ? "FT" : isLive ? "Live" : formatKickoffTime(score.commence_time),
        isLive,
        startingAt:  score.commence_time,
        odds:        [],
        extraMarkets: 0,
      };

      return { match, stateId, ...blank, markets: [] };
    }
  }
  return null;
}

// ── Mock fallback ─────────────────────────────────────────────────────────────

function withLogos<T extends Match>(m: T): T {
  return {
    ...m,
    home: { ...m.home, logo: m.home.logo ?? getTeamLogo(m.home.name) },
    away: { ...m.away, logo: m.away.logo ?? getTeamLogo(m.away.name) },
  };
}

export const MOCK_LIVE: Match[] = [
  withLogos({
    id: 1, eventId: "mock-1", sportKey: "soccer_epl",
    league: "Premier League", country: "England", countryFlag: FLAG("gb-eng"),
    home: { name: "Arsenal",  score: 2 }, away: { name: "Chelsea", score: 1 },
    period: "62'", isLive: true, startingAt: "",
    odds: [{ label: "1", value: "1.45" }, { label: "X", value: "4.20" }, { label: "2", value: "6.50" }],
    extraMarkets: 12,
  }),
  withLogos({
    id: 2, eventId: "mock-2", sportKey: "soccer_germany_bundesliga",
    league: "Bundesliga", country: "Germany", countryFlag: FLAG("de"),
    home: { name: "Bayern Munich", score: 2 }, away: { name: "Borussia Dortmund", score: 1 },
    period: "HT", isLive: true, startingAt: "",
    odds: [{ label: "1", value: "1.35" }, { label: "X", value: "4.80" }, { label: "2", value: "7.20" }],
    extraMarkets: 8,
  }),
  withLogos({
    id: 3, eventId: "mock-3", sportKey: "soccer_spain_la_liga",
    league: "La Liga", country: "Spain", countryFlag: FLAG("es"),
    home: { name: "Barcelona", score: 1 }, away: { name: "Real Madrid", score: 1 },
    period: "71'", isLive: true, startingAt: "",
    odds: [{ label: "1", value: "2.60" }, { label: "X", value: "3.10" }, { label: "2", value: "2.80" }],
    extraMarkets: 11,
  }),
  withLogos({
    id: 4, eventId: "mock-4", sportKey: "soccer_italy_serie_a",
    league: "Serie A", country: "Italy", countryFlag: FLAG("it"),
    home: { name: "Juventus", score: 0 }, away: { name: "AC Milan", score: 1 },
    period: "38'", isLive: true, startingAt: "",
    odds: [{ label: "1", value: "2.90" }, { label: "X", value: "3.20" }, { label: "2", value: "2.45" }],
    extraMarkets: 9,
  }),
  withLogos({
    id: 5, eventId: "mock-5", sportKey: "basketball_nba",
    league: "NBA", country: "USA", countryFlag: FLAG("us"),
    home: { name: "Los Angeles Lakers", score: 88 }, away: { name: "Boston Celtics", score: 91 },
    period: "Q3", isLive: true, startingAt: "",
    odds: [{ label: "1", value: "2.10" }, { label: "2", value: "1.75" }],
    extraMarkets: 6,
  }),
];

export const MOCK_UPCOMING: Match[] = [
  withLogos({
    id: 101, eventId: "mock-101", sportKey: "soccer_epl",
    league: "Premier League", country: "England", countryFlag: FLAG("gb-eng"),
    home: { name: "Aston Villa", score: null }, away: { name: "Liverpool", score: null },
    period: "22:00", isLive: false, startingAt: new Date(Date.now() + 3_600_000).toISOString(),
    odds: [{ label: "1", value: "2.78" }, { label: "X", value: "3.46" }, { label: "2", value: "2.54" }],
    extraMarkets: 9,
  }),
  withLogos({
    id: 102, eventId: "mock-102", sportKey: "basketball_nba",
    league: "NBA", country: "USA", countryFlag: FLAG("us"),
    home: { name: "Cleveland Cavaliers", score: null }, away: { name: "Detroit Pistons", score: null },
    period: "02:00", isLive: false, startingAt: new Date(Date.now() + 7_200_000).toISOString(),
    odds: [{ label: "1", value: "1.54" }, { label: "2", value: "2.43" }],
    extraMarkets: 4,
  }),
  withLogos({
    id: 103, eventId: "mock-103", sportKey: "soccer_italy_serie_a",
    league: "Serie A", country: "Italy", countryFlag: FLAG("it"),
    home: { name: "Juventus", score: null }, away: { name: "AC Milan", score: null },
    period: "20:45", isLive: false, startingAt: new Date(Date.now() + 10_800_000).toISOString(),
    odds: [{ label: "1", value: "2.20" }, { label: "X", value: "3.20" }, { label: "2", value: "3.40" }],
    extraMarkets: 7,
  }),
];
