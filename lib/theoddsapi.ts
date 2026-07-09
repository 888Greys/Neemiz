import { getTeamLogo, fetchSportsDbBadge, attachMatchLogos } from "@/lib/team-logos";
import { getLeagueLogo } from "@/lib/league-logos";

const BASE    = "https://api.the-odds-api.com/v4";
const API_KEY = process.env.ODDS_API_KEY ?? "";

const FLAG = (code: string) => `https://flagcdn.com/w40/${code}.png`;

// Map sport_key → display info. `un` (United Nations) flag stands in for
// international competitions (World Cup, cricket internationals, boxing).
const SPORT_META: Record<string, { league: string; country: string; flag: string }> = {
  // ── Soccer ──
  soccer_epl:                        { league: "Premier League",   country: "England",       flag: FLAG("gb-eng") },
  soccer_efl_champ:                  { league: "Championship",     country: "England",       flag: FLAG("gb-eng") },
  soccer_england_league1:            { league: "League One",       country: "England",       flag: FLAG("gb-eng") },
  soccer_england_league2:            { league: "League Two",       country: "England",       flag: FLAG("gb-eng") },
  soccer_england_efl_cup:            { league: "EFL Cup",          country: "England",       flag: FLAG("gb-eng") },
  soccer_fa_cup:                     { league: "FA Cup",           country: "England",       flag: FLAG("gb-eng") },
  soccer_spl:                        { league: "Scottish Premiership", country: "Scotland",  flag: FLAG("gb-sct") },
  soccer_spain_la_liga:              { league: "La Liga",          country: "Spain",         flag: FLAG("es")     },
  soccer_spain_segunda_division:     { league: "La Liga 2",        country: "Spain",         flag: FLAG("es")     },
  soccer_spain_copa_del_rey:         { league: "Copa del Rey",     country: "Spain",         flag: FLAG("es")     },
  soccer_germany_bundesliga:         { league: "Bundesliga",       country: "Germany",       flag: FLAG("de")     },
  soccer_germany_bundesliga2:        { league: "Bundesliga 2",     country: "Germany",       flag: FLAG("de")     },
  soccer_germany_liga3:              { league: "3. Liga",          country: "Germany",       flag: FLAG("de")     },
  soccer_germany_dfb_pokal:          { league: "DFB-Pokal",        country: "Germany",       flag: FLAG("de")     },
  soccer_germany_bundesliga_women:   { league: "Frauen-Bundesliga", country: "Germany",      flag: FLAG("de")     },
  soccer_italy_serie_a:              { league: "Serie A",          country: "Italy",         flag: FLAG("it")     },
  soccer_italy_serie_b:              { league: "Serie B",          country: "Italy",         flag: FLAG("it")     },
  soccer_italy_coppa_italia:         { league: "Coppa Italia",     country: "Italy",         flag: FLAG("it")     },
  soccer_france_ligue_one:           { league: "Ligue 1",          country: "France",        flag: FLAG("fr")     },
  soccer_france_ligue_two:           { league: "Ligue 2",          country: "France",        flag: FLAG("fr")     },
  soccer_france_coupe_de_france:     { league: "Coupe de France",  country: "France",        flag: FLAG("fr")     },
  soccer_netherlands_eredivisie:     { league: "Eredivisie",       country: "Netherlands",   flag: FLAG("nl")     },
  soccer_portugal_primeira_liga:     { league: "Primeira Liga",    country: "Portugal",      flag: FLAG("pt")     },
  soccer_belgium_first_div:          { league: "Belgian Pro League", country: "Belgium",     flag: FLAG("be")     },
  soccer_turkey_super_league:        { league: "Süper Lig",        country: "Turkey",        flag: FLAG("tr")     },
  soccer_austria_bundesliga:         { league: "Austrian Bundesliga", country: "Austria",    flag: FLAG("at")     },
  soccer_denmark_superliga:          { league: "Superliga",        country: "Denmark",       flag: FLAG("dk")     },
  soccer_norway_eliteserien:         { league: "Eliteserien",      country: "Norway",        flag: FLAG("no")     },
  soccer_sweden_allsvenskan:         { league: "Allsvenskan",      country: "Sweden",        flag: FLAG("se")     },
  soccer_sweden_superettan:          { league: "Superettan",       country: "Sweden",        flag: FLAG("se")     },
  soccer_switzerland_superleague:    { league: "Swiss Super League", country: "Switzerland", flag: FLAG("ch")     },
  soccer_finland_veikkausliiga:      { league: "Veikkausliiga",    country: "Finland",       flag: FLAG("fi")     },
  soccer_greece_super_league:        { league: "Super League Greece", country: "Greece",     flag: FLAG("gr")     },
  soccer_poland_ekstraklasa:         { league: "Ekstraklasa",      country: "Poland",        flag: FLAG("pl")     },
  soccer_russia_premier_league:      { league: "Russian Premier League", country: "Russia",  flag: FLAG("ru")     },
  soccer_league_of_ireland:          { league: "League of Ireland", country: "Ireland",      flag: FLAG("ie")     },
  soccer_uefa_champs_league:         { league: "Champions League", country: "Europe",        flag: FLAG("eu")     },
  soccer_uefa_champs_league_qualification: { league: "UCL Qualifying", country: "Europe",    flag: FLAG("eu")     },
  soccer_uefa_champs_league_women:   { league: "UWCL",             country: "Europe",        flag: FLAG("eu")     },
  soccer_uefa_europa_league:         { league: "Europa League",    country: "Europe",        flag: FLAG("eu")     },
  soccer_uefa_europa_conference_league: { league: "Conference League", country: "Europe",    flag: FLAG("eu")     },
  soccer_uefa_european_championship: { league: "UEFA Euro",        country: "Europe",        flag: FLAG("eu")     },
  soccer_uefa_euro_qualification:    { league: "Euro Qualifiers",  country: "Europe",        flag: FLAG("eu")     },
  soccer_uefa_nations_league:        { league: "Nations League",   country: "Europe",        flag: FLAG("eu")     },
  soccer_fifa_world_cup:             { league: "FIFA World Cup",   country: "World",         flag: FLAG("un")     },
  soccer_fifa_world_cup_womens:      { league: "Women's World Cup", country: "World",        flag: FLAG("un")     },
  soccer_fifa_club_world_cup:        { league: "Club World Cup",   country: "World",         flag: FLAG("un")     },
  soccer_fifa_world_cup_qualifiers_europe: { league: "WC Qualifiers (Europe)", country: "Europe", flag: FLAG("eu") },
  soccer_fifa_world_cup_qualifiers_south_america: { league: "WC Qualifiers (SA)", country: "South America", flag: FLAG("un") },
  soccer_africa_cup_of_nations:      { league: "AFCON",            country: "Africa",        flag: FLAG("un")     },
  soccer_kenya_premier_league:       { league: "KPL",              country: "Kenya",         flag: FLAG("ke")     },
  soccer_argentina_primera_division: { league: "Liga Profesional", country: "Argentina",     flag: FLAG("ar")     },
  soccer_brazil_campeonato:          { league: "Brazil Série A",   country: "Brazil",        flag: FLAG("br")     },
  soccer_brazil_serie_b:             { league: "Brazil Série B",   country: "Brazil",        flag: FLAG("br")     },
  soccer_chile_campeonato:           { league: "Primera División", country: "Chile",         flag: FLAG("cl")     },
  soccer_mexico_ligamx:              { league: "Liga MX",          country: "Mexico",        flag: FLAG("mx")     },
  soccer_usa_mls:                    { league: "MLS",              country: "USA",           flag: FLAG("us")     },
  soccer_conmebol_copa_libertadores: { league: "Copa Libertadores",country: "South America", flag: FLAG("un")     },
  soccer_conmebol_copa_sudamericana: { league: "Copa Sudamericana",country: "South America", flag: FLAG("un")     },
  soccer_conmebol_copa_america:      { league: "Copa América",     country: "South America", flag: FLAG("un")     },
  soccer_concacaf_gold_cup:          { league: "Gold Cup",         country: "North America", flag: FLAG("un")     },
  soccer_concacaf_leagues_cup:       { league: "Leagues Cup",      country: "North America", flag: FLAG("un")     },
  soccer_china_superleague:          { league: "Chinese Super League", country: "China",     flag: FLAG("cn")     },
  soccer_japan_j_league:             { league: "J League",         country: "Japan",         flag: FLAG("jp")     },
  soccer_korea_kleague1:             { league: "K League 1",       country: "South Korea",   flag: FLAG("kr")     },
  soccer_australia_aleague:          { league: "A-League",         country: "Australia",     flag: FLAG("au")     },
  soccer_saudi_arabia_pro_league:    { league: "Saudi Pro League", country: "Saudi Arabia",  flag: FLAG("sa")     },
  // ── Basketball ──
  basketball_nba:                    { league: "NBA",              country: "USA",           flag: FLAG("us")     },
  basketball_nba_preseason:          { league: "NBA Preseason",    country: "USA",           flag: FLAG("us")     },
  basketball_nba_summer_league:      { league: "NBA Summer League", country: "USA",          flag: FLAG("us")     },
  basketball_wnba:                   { league: "WNBA",             country: "USA",           flag: FLAG("us")     },
  basketball_ncaab:                  { league: "NCAAB",            country: "USA",           flag: FLAG("us")     },
  basketball_euroleague:             { league: "EuroLeague",       country: "Europe",        flag: FLAG("eu")     },
  basketball_nbl:                    { league: "NBL",              country: "Australia",     flag: FLAG("au")     },
  // ── American Football ──
  americanfootball_nfl:              { league: "NFL",              country: "USA",           flag: FLAG("us")     },
  americanfootball_nfl_preseason:    { league: "NFL Preseason",    country: "USA",           flag: FLAG("us")     },
  americanfootball_ncaaf:            { league: "NCAAF",            country: "USA",           flag: FLAG("us")     },
  americanfootball_cfl:              { league: "CFL",              country: "Canada",        flag: FLAG("ca")     },
  americanfootball_ufl:              { league: "UFL",              country: "USA",           flag: FLAG("us")     },
  // ── Baseball ──
  baseball_mlb:                      { league: "MLB",              country: "USA",           flag: FLAG("us")     },
  baseball_mlb_preseason:            { league: "MLB Preseason",    country: "USA",           flag: FLAG("us")     },
  baseball_kbo:                      { league: "KBO",              country: "South Korea",   flag: FLAG("kr")     },
  baseball_npb:                      { league: "NPB",              country: "Japan",         flag: FLAG("jp")     },
  baseball_ncaa:                     { league: "NCAA Baseball",    country: "USA",           flag: FLAG("us")     },
  baseball_milb:                     { league: "MiLB",             country: "USA",           flag: FLAG("us")     },
  // ── Ice Hockey ──
  icehockey_nhl:                     { league: "NHL",              country: "USA",           flag: FLAG("us")     },
  icehockey_nhl_preseason:           { league: "NHL Preseason",    country: "USA",           flag: FLAG("us")     },
  icehockey_ahl:                     { league: "AHL",              country: "USA",           flag: FLAG("us")     },
  icehockey_sweden_hockey_league:    { league: "SHL",              country: "Sweden",        flag: FLAG("se")     },
  icehockey_sweden_allsvenskan:      { league: "HockeyAllsvenskan", country: "Sweden",       flag: FLAG("se")     },
  icehockey_liiga:                   { league: "Liiga",            country: "Finland",       flag: FLAG("fi")     },
  // ── Rugby ──
  rugbyleague_nrl:                   { league: "NRL",              country: "Australia",     flag: FLAG("au")     },
  rugbyleague_nrl_state_of_origin:   { league: "State of Origin",  country: "Australia",     flag: FLAG("au")     },
  rugbyunion_six_nations:            { league: "Six Nations",      country: "Europe",        flag: FLAG("eu")     },
  // ── Other ──
  aussierules_afl:                   { league: "AFL",              country: "Australia",     flag: FLAG("au")     },
  handball_germany_bundesliga:       { league: "Handball-Bundesliga", country: "Germany",    flag: FLAG("de")     },
  lacrosse_pll:                      { league: "PLL",              country: "USA",           flag: FLAG("us")     },
  // ── Cricket ──
  cricket_odi:                       { league: "One Day Internationals", country: "International", flag: FLAG("un") },
  cricket_test_match:                { league: "Test Matches",     country: "International",  flag: FLAG("un")     },
  cricket_international_t20:         { league: "International T20", country: "International", flag: FLAG("un")     },
  cricket_t20_blast:                 { league: "T20 Blast",        country: "England",        flag: FLAG("gb-eng") },
  cricket_icc_world_cup:             { league: "ICC World Cup",    country: "International",   flag: FLAG("un")     },
  cricket_t20_world_cup:             { league: "T20 World Cup",    country: "International",   flag: FLAG("un")     },
  cricket_ipl:                       { league: "IPL",              country: "India",           flag: FLAG("in")     },
  cricket_big_bash:                  { league: "Big Bash",         country: "Australia",       flag: FLAG("au")     },
  // ── Tennis ──
  tennis_atp_wimbledon:              { league: "Wimbledon (ATP)",  country: "England",       flag: FLAG("gb-eng") },
  tennis_wta_wimbledon:              { league: "Wimbledon (WTA)",  country: "England",       flag: FLAG("gb-eng") },
  tennis_atp_french_open:            { league: "French Open (ATP)", country: "France",       flag: FLAG("fr")     },
  tennis_wta_french_open:            { league: "French Open (WTA)", country: "France",       flag: FLAG("fr")     },
  tennis_atp_us_open:                { league: "US Open (ATP)",    country: "USA",           flag: FLAG("us")     },
  tennis_wta_us_open:                { league: "US Open (WTA)",    country: "USA",           flag: FLAG("us")     },
  // ── Combat ──
  mma_mixed_martial_arts:            { league: "MMA / UFC",        country: "USA",           flag: FLAG("us")     },
  boxing_boxing:                     { league: "Boxing",           country: "International",  flag: FLAG("un")     },
};

function metaFor(sportKey: string, sportTitle?: string) {
  const known = SPORT_META[sportKey];
  if (known) return known;
  return {
    league: sportTitle || sportKey.replace(/^[^_]+_/, "").replace(/_/g, " "),
    country: "",
    flag: FLAG("un"),
  };
}

// Fallback list if the /sports discovery call fails or the key is missing.
const FALLBACK_SPORTS = [
  "soccer_epl",
  "soccer_spain_la_liga",
  "soccer_germany_bundesliga",
  "soccer_italy_serie_a",
  "basketball_nba",
];

// Discover ALL in-season match leagues (free /sports), then refresh on a
// credit budget so 4k+ users never burn Odds API credits on page views.
//
// Cost model (eu region):
//   odds h2h only          = 1 credit / sport
//   odds h2h+totals+spreads = 3 credits / sport
//   scores (no daysFrom)   = 1 credit / sport
//   scores daysFrom=1..3   = 2 credits / sport
//
// Default budget ~220 credits/hour ≈ 5.3k/day ≈ 160k/mo — under 100K plan when
// cron is hourly; leave headroom for settlement. Override via ODDS_HOURLY_BUDGET.
const PREFERRED_GROUPS = [
  "Soccer", "Basketball", "American Football", "Ice Hockey", "Baseball",
  "Tennis", "Mixed Martial Arts", "Boxing", "Cricket", "Rugby League", "Rugby Union",
  "Aussie Rules", "Lacrosse", "Handball",
];

/** Credits we allow the refresh cron to spend per run (default ~hourly). */
export const ODDS_HOURLY_BUDGET = Math.max(
  40,
  Math.min(800, Number(process.env.ODDS_HOURLY_BUDGET) || 220),
);

interface SportInfo {
  key: string;
  group: string;
  title: string;
  description?: string;
  active: boolean;
  has_outrights: boolean;
}

export type SportRefreshPlan = {
  key: string;
  group: string;
  title: string;
  /** Featured markets for /odds — fewer markets = fewer credits. */
  markets: "h2h" | "h2h,totals,spreads";
  /** Include daysFrom on /scores (costs 2 instead of 1). */
  scoresDaysFrom: number | null;
  tier: "hot" | "warm" | "cold";
};

// Always refresh these every run when active (World Cup + top soccer + US majors).
const HOT_KEYS = [
  "soccer_fifa_world_cup",
  "soccer_epl",
  "soccer_spain_la_liga",
  "soccer_germany_bundesliga",
  "soccer_italy_serie_a",
  "soccer_france_ligue_one",
  "soccer_uefa_champs_league",
  "soccer_uefa_europa_league",
  "soccer_kenya_premier_league",
  "soccer_usa_mls",
  "basketball_nba",
  "basketball_wnba",
  "americanfootball_nfl",
  "icehockey_nhl",
  "baseball_mlb",
];

const MARQUEE_KEYS = [
  "fifa_world_cup", "world_cup", "uefa_champs", "uefa_europa", "libertadores", "sudamericana",
  "epl", "la_liga", "serie_a", "bundesliga", "ligue_one", "kenya", "mls",
  "nba", "wnba", "nfl", "nhl", "mlb",
];

async function fetchActiveSports(): Promise<SportInfo[]> {
  if (!API_KEY) return [];
  try {
    const res = await fetch(`${BASE}/sports?apiKey=${API_KEY}`, { next: { revalidate: 21600 } });
    if (!res.ok) return [];
    const sports = (await res.json()) as SportInfo[];
    return sports.filter((s) => s.active && !s.has_outrights);
  } catch {
    return [];
  }
}

function sortActive(active: SportInfo[]): SportInfo[] {
  const groupRank = (g: string) => {
    const i = PREFERRED_GROUPS.indexOf(g);
    return i === -1 ? 999 : i;
  };
  const marqueeRank = (k: string) => {
    const i = MARQUEE_KEYS.findIndex((m) => k.includes(m));
    return i === -1 ? 99 : i;
  };
  return [...active].sort(
    (a, b) =>
      groupRank(a.group) - groupRank(b.group) ||
      marqueeRank(a.key) - marqueeRank(b.key) ||
      a.title.localeCompare(b.title),
  );
}

/** All active match-league keys (for UI / discovery). Free — no credit cost. */
export async function getFetchSports(): Promise<string[]> {
  const active = sortActive(await fetchActiveSports());
  if (active.length === 0) return FALLBACK_SPORTS;
  return active.map((s) => s.key);
}

/**
 * Credit-aware refresh plan: every active league is covered over a rotation,
 * hot leagues every run with full markets, others rotate with cheaper calls.
 *
 * ~50 leagues @ full markets+scores ≈ 250 credits/run → blows 100K/mo if hourly.
 * This plan stays near ODDS_HOURLY_BUDGET while still wiring ALL leagues.
 */
export async function getRefreshPlan(budget = ODDS_HOURLY_BUDGET): Promise<{
  plan: SportRefreshPlan[];
  estimatedCredits: number;
  activeCount: number;
  slot: number;
}> {
  const active = sortActive(await fetchActiveSports());
  if (active.length === 0) {
    return {
      plan: FALLBACK_SPORTS.map((key) => ({
        key,
        group: "Soccer",
        title: metaFor(key).league,
        markets: "h2h,totals,spreads" as const,
        scoresDaysFrom: 1,
        tier: "hot" as const,
      })),
      estimatedCredits: FALLBACK_SPORTS.length * 5,
      activeCount: FALLBACK_SPORTS.length,
      slot: 0,
    };
  }

  const byKey = new Map(active.map((s) => [s.key, s]));
  const hot: SportInfo[] = [];
  for (const key of HOT_KEYS) {
    const s = byKey.get(key);
    if (s) hot.push(s);
  }
  // Also treat any currently-active marquee soccer as hot if not already pinned
  for (const s of active) {
    if (hot.some((h) => h.key === s.key)) continue;
    if (MARQUEE_KEYS.some((m) => s.key.includes(m)) && s.group === "Soccer") {
      hot.push(s);
    }
  }

  const hotKeys = new Set(hot.map((s) => s.key));
  const rest = active.filter((s) => !hotKeys.has(s.key));

  // Rotate cold leagues across hours so every league refreshes within ~N hours.
  const slot = Math.floor(Date.now() / 3_600_000) % Math.max(1, Math.ceil(rest.length / 8) || 1);
  const chunkSize = Math.max(8, Math.ceil(rest.length / Math.max(1, Math.ceil(rest.length / 12))));
  const warmStart = (slot * chunkSize) % Math.max(1, rest.length);
  const warm = rest.length
    ? [...rest.slice(warmStart), ...rest.slice(0, warmStart)].slice(0, chunkSize)
    : [];
  const warmKeys = new Set(warm.map((s) => s.key));
  // Remaining cold: h2h-only, no scores this hour (still listed in UI from last cache)
  const cold = rest.filter((s) => !warmKeys.has(s.key));

  const plan: SportRefreshPlan[] = [];
  let estimated = 0;
  const costOf = (p: SportRefreshPlan) => {
    const markets = p.markets.split(",").length;
    const scores = p.scoresDaysFrom == null ? 0 : p.scoresDaysFrom > 0 ? 2 : 1;
    return markets + scores;
  };

  const push = (s: SportInfo, tier: SportRefreshPlan["tier"]) => {
    const item: SportRefreshPlan =
      tier === "hot"
        ? { key: s.key, group: s.group, title: s.title, markets: "h2h,totals,spreads", scoresDaysFrom: 1, tier }
        : tier === "warm"
          ? { key: s.key, group: s.group, title: s.title, markets: "h2h", scoresDaysFrom: 1, tier }
          : { key: s.key, group: s.group, title: s.title, markets: "h2h", scoresDaysFrom: null, tier };
    const c = costOf(item);
    if (estimated + c > budget && tier === "cold") return; // skip cold if over budget
    if (estimated + c > budget && tier === "warm") {
      // Downgrade warm to h2h-only no scores
      item.scoresDaysFrom = null;
      const c2 = costOf(item);
      if (estimated + c2 > budget) return;
      plan.push(item);
      estimated += c2;
      return;
    }
    plan.push(item);
    estimated += c;
  };

  for (const s of hot) push(s, "hot");
  for (const s of warm) push(s, "warm");
  // Cold: only if budget remains — keeps every league touched over the day
  for (const s of cold) push(s, "cold");

  // Guarantee: if somehow nothing planned, at least hot/fallback
  if (plan.length === 0) {
    for (const s of hot.length ? hot : active.slice(0, 8)) push(s, "hot");
  }

  return { plan, estimatedCredits: estimated, activeCount: active.length, slot };
}

/** Free /sports discovery — all in-season match leagues for UI strips / filters. */
export async function listActiveLeagues(): Promise<
  { key: string; group: string; title: string; flag?: string }[]
> {
  if (!API_KEY) {
    return FALLBACK_SPORTS.map((key) => {
      const meta = metaFor(key);
      return { key, group: "Soccer", title: meta.league, flag: meta.flag };
    });
  }
  try {
    const active = sortActive(await fetchActiveSports());
    return active.map((s) => {
      const meta = metaFor(s.key, s.title);
      return { key: s.key, group: s.group, title: meta.league, flag: meta.flag };
    });
  } catch {
    return [];
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

/** SportPesa-style list markets shown on each match card. */
export type ListOdd = { label: string; value: string; key: string };

export type ListMarkets = {
  threeWay: ListOdd[];
  doubleChance: ListOdd[];
  overUnder: ListOdd[];
  btts: ListOdd[];
};

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
  /** Inline card markets (3-Way / DC / O-U / BTTS). */
  listMarkets?: ListMarkets;
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

/** Fair double-chance prices from 1X2 (de-vigged implied probs). */
function doubleChanceFromH2h(o1: number, ox: number, o2: number): ListOdd[] {
  const p1 = 1 / o1;
  const px = 1 / ox;
  const p2 = 1 / o2;
  const sum = p1 + px + p2;
  if (!(sum > 0)) return [];
  const n1 = p1 / sum;
  const nx = px / sum;
  const n2 = p2 / sum;
  const fmt = (p: number) => Math.max(1.01, 1 / p).toFixed(2);
  return [
    { key: "1X", label: "1 OR X", value: fmt(n1 + nx) },
    { key: "X2", label: "X OR 2", value: fmt(nx + n2) },
    { key: "12", label: "1 OR 2", value: fmt(n1 + n2) },
  ];
}

function extractOverUnder(event: OddsEvent, preferLine = 2.5): ListOdd[] {
  if (!event.bookmakers?.length) return [];
  type Line = { over?: number; under?: number };
  const lines = new Map<number, Line>();

  for (const bm of event.bookmakers) {
    const totals = bm.markets.find((m) => m.key === "totals");
    if (!totals?.outcomes?.length) continue;
    for (const o of totals.outcomes) {
      if (o.point == null) continue;
      const entry = lines.get(o.point) ?? {};
      if (/^over$/i.test(o.name)) entry.over = o.price;
      if (/^under$/i.test(o.name)) entry.under = o.price;
      lines.set(o.point, entry);
    }
  }

  const preferred = lines.get(preferLine);
  const pick =
    preferred?.over && preferred?.under
      ? { line: preferLine, ...preferred }
      : [...lines.entries()]
          .map(([line, v]) => ({ line, ...v }))
          .find((v) => v.over && v.under);

  if (!pick?.over || !pick?.under) return [];
  return [
    { key: `O${pick.line}`, label: `OVER ${pick.line.toFixed(2)}`, value: pick.over.toFixed(2) },
    { key: `U${pick.line}`, label: `UNDER ${pick.line.toFixed(2)}`, value: pick.under.toFixed(2) },
  ];
}

function buildListMarkets(
  event: OddsEvent,
  h2h: { label: string; value: string }[],
): ListMarkets {
  const o1 = parseFloat(h2h.find((o) => o.label === "1")?.value ?? "");
  const ox = parseFloat(h2h.find((o) => o.label === "X")?.value ?? "");
  const o2 = parseFloat(h2h.find((o) => o.label === "2")?.value ?? "");

  const threeWay: ListOdd[] = h2h.map((o) => ({
    key: o.label,
    label: o.label === "1" ? event.home_team : o.label === "2" ? event.away_team : "DRAW",
    value: o.value,
  }));

  const doubleChance =
    o1 > 1 && ox > 1 && o2 > 1 ? doubleChanceFromH2h(o1, ox, o2) : [];

  return {
    threeWay,
    doubleChance,
    overUnder: extractOverUnder(event, 2.5),
    btts: [], // Odds API v4 sports odds endpoint does not support btts
  };
}

/** Distinct Over/Under lines on the event (each line = one market). */
function countTotalsLines(event: OddsEvent): number {
  if (!event.bookmakers?.length) return 0;
  const lines = new Set<number>();
  for (const bm of event.bookmakers) {
    const totals = bm.markets.find((m) => m.key === "totals");
    if (!totals?.outcomes?.length) continue;
    for (const o of totals.outcomes) {
      if (o.point != null) lines.add(o.point);
    }
  }
  return lines.size;
}

/** Distinct handicap lines (each point = one market). */
function countSpreadLines(event: OddsEvent): number {
  if (!event.bookmakers?.length) return 0;
  const lines = new Set<number>();
  for (const bm of event.bookmakers) {
    const spreads = bm.markets.find((m) => m.key === "spreads");
    if (!spreads?.outcomes?.length) continue;
    for (const o of spreads.outcomes) {
      if (o.point != null) lines.add(Math.abs(o.point));
    }
  }
  return lines.size;
}

/**
 * SportPesa-style +N = markets beyond what the list card shows.
 * Counts each O/U and handicap line separately so N varies per match.
 */
function countExtraMarkets(event: OddsEvent, list: ListMarkets): number {
  const totalsLines = countTotalsLines(event);
  const spreadLines = countSpreadLines(event);
  const detail = buildMarketsFromEvent(event);
  const hasBtts = detail.some((m) => m.id === 4) || list.btts.length > 0;

  let total = 0;
  if (list.threeWay.length > 0) total += 1;
  if (list.doubleChance.length > 0) total += 1;
  total += Math.max(totalsLines, list.overUnder.length > 0 ? 1 : 0);
  total += spreadLines;
  if (hasBtts) total += 1;

  // Card budget: up to 6 odds → typically 3 Way + Double Chance (2 groups).
  let shownGroups = 0;
  let budget = 6;
  for (const g of [list.threeWay, list.doubleChance, list.overUnder, list.btts]) {
    if (g.length === 0 || budget <= 0) continue;
    shownGroups += 1;
    budget -= Math.min(g.length, budget);
  }

  return Math.max(0, total - shownGroups);
}

/**
 * Recompute SportPesa +N from cached detail markets (for fixtures_cache rows
 * that still store the old flat extraMarkets from bookmaker.markets.length - 1).
 */
export function extraMarketsFromCached(
  markets: BettingMarket[],
  list?: ListMarkets | null,
): number {
  const h2h = markets.find((m) => m.id === 1);
  const totals = markets.filter((m) => m.id === 3);
  const spreads = markets.filter((m) => m.id === 2);
  const btts = markets.find((m) => m.id === 4);

  // Distinct O/U lines from outcome extras (point), else one market per totals group.
  const ouLines = new Set<string>();
  for (const t of totals) {
    for (const o of t.odds) {
      if (o.extra) ouLines.add(o.extra);
    }
  }
  const totalsCount = ouLines.size > 0 ? ouLines.size : totals.length > 0 ? 1 : 0;

  const spreadLines = new Set<string>();
  for (const s of spreads) {
    for (const o of s.odds) {
      if (o.extra) spreadLines.add(o.extra.replace(/^\+/, "").replace(/^-/, ""));
    }
  }
  const spreadCount = spreadLines.size > 0 ? spreadLines.size : spreads.length > 0 ? 1 : 0;

  const threeWay = list?.threeWay?.length
    ? list.threeWay
    : (h2h?.odds ?? []).map((o) => ({ key: o.label, label: o.label, value: o.value }));
  const o1 = parseFloat(threeWay.find((o) => o.key === "1" || o.label === "1")?.value ?? "");
  const ox = parseFloat(threeWay.find((o) => o.key === "X" || o.label === "X" || /draw/i.test(o.label))?.value ?? "");
  const o2 = parseFloat(threeWay.find((o) => o.key === "2" || o.label === "2")?.value ?? "");
  const doubleChance =
    list?.doubleChance?.length
      ? list.doubleChance
      : o1 > 1 && ox > 1 && o2 > 1
        ? doubleChanceFromH2h(o1, ox, o2)
        : [];

  let total = 0;
  if (threeWay.length > 0) total += 1;
  if (doubleChance.length > 0) total += 1;
  total += totalsCount;
  total += spreadCount;
  if (btts || (list?.btts?.length ?? 0) > 0) total += 1;

  const listGroups = [
    threeWay,
    doubleChance,
    list?.overUnder?.length ? list.overUnder : totalsCount > 0 ? [{ key: "x" }] : [],
    list?.btts?.length ? list.btts : btts ? [{ key: "x" }] : [],
  ];
  let shownGroups = 0;
  let budget = 6;
  for (const g of listGroups) {
    if (g.length === 0 || budget <= 0) continue;
    shownGroups += 1;
    budget -= Math.min(g.length, budget);
  }

  return Math.max(0, total - shownGroups);
}

export function normalizeOddsEvent(event: OddsEvent, liveScore?: ScoreEvent): Match {
  const meta  = metaFor(event.sport_key, event.sport_title);
  const { odds } = extractH2hOdds(event);
  const listMarkets = buildListMarkets(event, odds);
  const extraMarkets = countExtraMarkets(event, listMarkets);

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
    leagueLogo:   getLeagueLogo(meta?.league ?? event.sport_title),
    country:      meta?.country ?? "",
    countryFlag:  meta?.flag ?? undefined,
    home: {
      name: event.home_team,
      logo: getTeamLogo(event.home_team),
      score: homeScore !== null ? Number(homeScore) : null,
    },
    away: {
      name: event.away_team,
      logo: getTeamLogo(event.away_team),
      score: awayScore !== null ? Number(awayScore) : null,
    },
    period,
    isLive,
    startingAt:   event.commence_time,
    odds,
    extraMarkets,
    listMarkets,
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

  // SportPesa-style Double Chance derived from 1X2 (same as list cards).
  const ftr = markets.find((m) => m.id === 1);
  if (ftr) {
    const o1 = parseFloat(ftr.odds.find((o) => o.label === "1")?.value ?? "");
    const ox = parseFloat(ftr.odds.find((o) => o.label === "X")?.value ?? "");
    const o2 = parseFloat(ftr.odds.find((o) => o.label === "2")?.value ?? "");
    if (o1 > 1 && ox > 1 && o2 > 1) {
      const p1 = 1 / o1;
      const px = 1 / ox;
      const p2 = 1 / o2;
      const sum = p1 + px + p2;
      const n1 = p1 / sum;
      const nx = px / sum;
      const n2 = p2 / sum;
      const price = (p: number) => Math.max(1.01, 1 / p).toFixed(2);
      markets.push({
        id: 101,
        name: "Double Chance",
        odds: [
          { label: "1 OR X", value: price(n1 + nx) },
          { label: "X OR 2", value: price(nx + n2) },
          { label: "1 OR 2", value: price(n1 + n2) },
        ],
      });
    }
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

export async function fetchOddsStatus(
  sportKey: string,
  markets: string = "h2h,totals,spreads",
): Promise<{ data: OddsEvent[]; failed: boolean; credits: number; remaining: number | null }> {
  if (!API_KEY) return { data: [], failed: true, credits: 0, remaining: null };
  const url = `${BASE}/sports/${sportKey}/odds?apiKey=${API_KEY}&regions=eu&markets=${encodeURIComponent(markets)}&oddsFormat=decimal`;
  try {
    const res = await fetch(url, { cache: "no-store" });
    const credits = Number(res.headers.get("x-requests-last") ?? markets.split(",").length);
    const remainingRaw = res.headers.get("x-requests-remaining");
    const remaining = remainingRaw != null ? Number(remainingRaw) : null;
    if (!res.ok) {
      if (isApiOutage(res.status)) console.error(`OddsAPI odds ${sportKey} → ${res.status} (API outage / quota)`);
      else if (res.status !== 404) console.error(`OddsAPI odds ${sportKey} → ${res.status}`);
      return { data: [], failed: isApiOutage(res.status), credits, remaining };
    }
    return { data: (await res.json()) as OddsEvent[], failed: false, credits, remaining };
  } catch (e) {
    console.error("OddsAPI fetchOdds error:", e);
    return { data: [], failed: true, credits: 0, remaining: null };
  }
}

export async function fetchScoresStatus(
  sportKey: string,
  daysFrom: number | null = 1,
): Promise<{ data: ScoreEvent[]; failed: boolean; credits: number; remaining: number | null }> {
  if (!API_KEY) return { data: [], failed: true, credits: 0, remaining: null };
  const qs =
    daysFrom == null
      ? `apiKey=${API_KEY}`
      : `apiKey=${API_KEY}&daysFrom=${daysFrom}`;
  const url = `${BASE}/sports/${sportKey}/scores?${qs}`;
  try {
    const res = await fetch(url, { cache: "no-store" });
    const credits = Number(res.headers.get("x-requests-last") ?? (daysFrom == null ? 1 : 2));
    const remainingRaw = res.headers.get("x-requests-remaining");
    const remaining = remainingRaw != null ? Number(remainingRaw) : null;
    if (!res.ok) {
      if (isApiOutage(res.status)) console.error(`OddsAPI scores ${sportKey} → ${res.status} (API outage / quota)`);
      return { data: [], failed: isApiOutage(res.status), credits, remaining };
    }
    return { data: (await res.json()) as ScoreEvent[], failed: false, credits, remaining };
  } catch (e) {
    console.error("OddsAPI fetchScores error:", e);
    return { data: [], failed: true, credits: 0, remaining: null };
  }
}

async function fetchOdds(sportKey: string, markets = "h2h,totals,spreads"): Promise<OddsEvent[]> {
  return (await fetchOddsStatus(sportKey, markets)).data;
}

async function fetchScores(sportKey: string, daysFrom: number | null = 1): Promise<ScoreEvent[]> {
  return (await fetchScoresStatus(sportKey, daysFrom)).data;
}

// ── Team badge enrichment (TheSportsDB) ────────────────────────────────────────
// TheOddsAPI gives no team logos. Prefer static map, then TheSportsDB (free).
export async function enrichBadges(matches: Match[], cap: number): Promise<Match[]> {
  return attachMatchLogos(matches, Math.max(cap * 2, 24));
}

/** @deprecated use fetchSportsDbBadge from team-logos */
async function fetchTeamBadge(name: string): Promise<string | undefined> {
  return fetchSportsDbBadge(name);
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Direct World Cup pull for local sportsbook (always include when key is set).
 * Returns live + upcoming WC fixtures with national-team logos attached.
 */
export async function getWorldCupFixtures(): Promise<{ live: Match[]; upcoming: Match[] }> {
  if (!API_KEY) return { live: [], upcoming: [] };
  const sport = "soccer_fifa_world_cup";
  const now = Date.now();
  try {
    const [odds, scores] = await Promise.all([fetchOdds(sport), fetchScores(sport)]);
    const scoreMap = new Map(scores.map((s) => [s.id, s]));
    const live: Match[] = [];
    const upcoming: Match[] = [];
    for (const e of odds) {
      const score = scoreMap.get(e.id);
      const kickedOff = new Date(e.commence_time).getTime() <= now;
      const isLive = !!score && !score.completed && kickedOff;
      const match = normalizeOddsEvent(e, score);
      if (isLive) live.push(match);
      else if (!score?.completed && new Date(e.commence_time).getTime() > now) upcoming.push(match);
      else if (!score?.completed && !kickedOff) upcoming.push(match);
    }
    // Also surface not-yet-in-odds scores? skip — odds feed has the 4 QFs.
    return {
      live: await enrichBadges(live, 20),
      upcoming: await enrichBadges(upcoming, 20),
    };
  } catch (e) {
    console.error("getWorldCupFixtures error:", e);
    return { live: [], upcoming: [] };
  }
}

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
  const meta       = metaFor(score.sport_key, score.sport_title);
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

/**
 * Expensive: scans in-season sports against the Odds API.
 * Do NOT call from user-facing routes (4k+ users). Prefer readFixtureDetail.
 * Kept for admin/debug and rare settlement fallbacks only.
 */
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
      const meta       = metaFor(score.sport_key, score.sport_title);
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
