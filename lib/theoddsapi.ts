const BASE    = "https://api.the-odds-api.com/v4";
const API_KEY = process.env.ODDS_API_KEY ?? "";

const FLAG = (code: string) => `https://flagcdn.com/w40/${code}.png`;

// Map sport_key → display info
const SPORT_META: Record<string, { league: string; country: string; flag: string }> = {
  soccer_epl:                   { league: "Premier League",      country: "England",     flag: FLAG("gb-eng") },
  soccer_spain_la_liga:         { league: "La Liga",             country: "Spain",       flag: FLAG("es")     },
  soccer_germany_bundesliga:    { league: "Bundesliga",          country: "Germany",     flag: FLAG("de")     },
  soccer_italy_serie_a:         { league: "Serie A",             country: "Italy",       flag: FLAG("it")     },
  soccer_france_ligue_one:      { league: "Ligue 1",             country: "France",      flag: FLAG("fr")     },
  soccer_uefa_champs_league:    { league: "Champions League",    country: "Europe",      flag: FLAG("eu")     },
  soccer_uefa_europa_league:    { league: "Europa League",       country: "Europe",      flag: FLAG("eu")     },
  soccer_africa_cup_of_nations: { league: "AFCON",               country: "Africa",      flag: ""             },
  soccer_kenya_premier_league:  { league: "KPL",                 country: "Kenya",       flag: FLAG("ke")     },
  soccer_turkey_super_league:   { league: "Süper Lig",          country: "Turkey",      flag: FLAG("tr")     },
  soccer_netherlands_eredivisie:{ league: "Eredivisie",          country: "Netherlands", flag: FLAG("nl")     },
  soccer_portugal_primeira_liga:{ league: "Primeira Liga",       country: "Portugal",    flag: FLAG("pt")     },
  basketball_nba:               { league: "NBA",                 country: "USA",         flag: FLAG("us")     },
  basketball_euroleague:        { league: "EuroLeague",          country: "Europe",      flag: FLAG("eu")     },
  americanfootball_nfl:         { league: "NFL",                 country: "USA",         flag: FLAG("us")     },
  tennis_atp_french_open:       { league: "French Open",         country: "France",      flag: FLAG("fr")     },
  mma_mixed_martial_arts:       { league: "MMA / UFC",           country: "USA",         flag: FLAG("us")     },
  cricket_icc_world_cup:        { league: "ICC World Cup",       country: "International",flag: ""            },
};

// Sports to fetch for the main sports page
const FETCH_SPORTS = [
  "soccer_epl",
  "soccer_spain_la_liga",
  "soccer_germany_bundesliga",
  "soccer_italy_serie_a",
  "soccer_france_ligue_one",
  "soccer_uefa_champs_league",
  "soccer_africa_cup_of_nations",
  "soccer_kenya_premier_league",
  "basketball_nba",
];

// ── Raw API types ─────────────────────────────────────────────────────────────

interface OddsEvent {
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
      outcomes: { name: string; price: number }[];
    }[];
  }[];
}

interface ScoreEvent {
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

// ── Normalised UI type (matches lib/sportmonks Match shape) ───────────────────

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

// Convert hex event ID to stable integer for URL params
function toNumericId(eventId: string): number {
  return parseInt(eventId.replace(/[^0-9a-f]/gi, "").slice(0, 8), 16) || 0;
}

function formatKickofffTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "--:--";
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function extractH2hOdds(
  event: OddsEvent,
): { odds: { label: string; value: string }[]; extraMarkets: number } {
  if (!event.bookmakers?.length) return { odds: [], extraMarkets: 0 };

  // Pick first bookmaker with h2h market
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

function normalizeOddsEvent(event: OddsEvent, liveScore?: ScoreEvent): Match {
  const meta  = SPORT_META[event.sport_key];
  const { odds, extraMarkets } = extractH2hOdds(event);

  const homeScore = liveScore?.scores?.find((s) => s.name === event.home_team)?.score ?? null;
  const awayScore = liveScore?.scores?.find((s) => s.name === event.away_team)?.score ?? null;
  const isLive    = !!liveScore && !liveScore.completed;

  const period = isLive ? "Live" : formatKickofffTime(event.commence_time);

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

// ── Fetcher ───────────────────────────────────────────────────────────────────

async function fetchOdds(sportKey: string): Promise<OddsEvent[]> {
  if (!API_KEY) return [];
  const url = `${BASE}/sports/${sportKey}/odds?apiKey=${API_KEY}&regions=eu&markets=h2h,totals,spreads&oddsFormat=decimal`;
  try {
    const res = await fetch(url, { next: { revalidate: 120 } });
    if (!res.ok) {
      if (res.status !== 404) console.error(`OddsAPI odds ${sportKey} → ${res.status}`);
      return [];
    }
    return (await res.json()) as OddsEvent[];
  } catch (e) {
    console.error("OddsAPI fetchOdds error:", e);
    return [];
  }
}

async function fetchScores(sportKey: string): Promise<ScoreEvent[]> {
  if (!API_KEY) return [];
  const url = `${BASE}/sports/${sportKey}/scores?apiKey=${API_KEY}&daysFrom=1`;
  try {
    const res = await fetch(url, { next: { revalidate: 30 } });
    if (!res.ok) return [];
    return (await res.json()) as ScoreEvent[];
  } catch (e) {
    console.error("OddsAPI fetchScores error:", e);
    return [];
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function getLivescores(): Promise<Match[]> {
  const results = await Promise.all(
    FETCH_SPORTS.map(async (sport) => {
      const [odds, scores] = await Promise.all([fetchOdds(sport), fetchScores(sport)]);
      const scoreMap = new Map(scores.map((s) => [s.id, s]));
      return odds
        .filter((e) => {
          const score = scoreMap.get(e.id);
          return score && !score.completed;
        })
        .map((e) => normalizeOddsEvent(e, scoreMap.get(e.id)));
    }),
  );
  return results.flat();
}

export async function getUpcomingFixtures(): Promise<Match[]> {
  const now = Date.now();
  const results = await Promise.all(
    FETCH_SPORTS.map(async (sport) => {
      const [odds, scores] = await Promise.all([fetchOdds(sport), fetchScores(sport)]);
      const liveIds = new Set(
        scores.filter((s) => !s.completed).map((s) => s.id),
      );
      return odds
        .filter((e) => {
          if (liveIds.has(e.id)) return false; // already in live
          return new Date(e.commence_time).getTime() > now;
        })
        .map((e) => normalizeOddsEvent(e));
    }),
  );
  // Sort soonest first, cap at 200
  return results.flat().sort(
    (a, b) => new Date(a.startingAt).getTime() - new Date(b.startingAt).getTime(),
  ).slice(0, 200);
}

// ── Mock fallback ─────────────────────────────────────────────────────────────

export const MOCK_LIVE: Match[] = [
  {
    id: 1, eventId: "mock-1", sportKey: "soccer_epl",
    league: "Premier League", country: "England", countryFlag: FLAG("gb-eng"),
    home: { name: "Arsenal",  score: 2 }, away: { name: "Chelsea", score: 1 },
    period: "Live", isLive: true, startingAt: "",
    odds: [{ label: "1", value: "1.45" }, { label: "X", value: "4.20" }, { label: "2", value: "6.50" }],
    extraMarkets: 12,
  },
  {
    id: 2, eventId: "mock-2", sportKey: "soccer_germany_bundesliga",
    league: "Bundesliga", country: "Germany", countryFlag: FLAG("de"),
    home: { name: "Bayern Munich", score: 2 }, away: { name: "Dortmund", score: 1 },
    period: "Live", isLive: true, startingAt: "",
    odds: [{ label: "1", value: "1.35" }, { label: "X", value: "4.80" }, { label: "2", value: "7.20" }],
    extraMarkets: 8,
  },
  {
    id: 3, eventId: "mock-3", sportKey: "soccer_spain_la_liga",
    league: "La Liga", country: "Spain", countryFlag: FLAG("es"),
    home: { name: "Barcelona", score: 1 }, away: { name: "Real Madrid", score: 1 },
    period: "Live", isLive: true, startingAt: "",
    odds: [{ label: "1", value: "2.60" }, { label: "X", value: "3.10" }, { label: "2", value: "2.80" }],
    extraMarkets: 11,
  },
];

export const MOCK_UPCOMING: Match[] = [
  {
    id: 101, eventId: "mock-101", sportKey: "soccer_epl",
    league: "Premier League", country: "England", countryFlag: FLAG("gb-eng"),
    home: { name: "Aston Villa", score: null }, away: { name: "Liverpool", score: null },
    period: "22:00", isLive: false, startingAt: new Date(Date.now() + 3_600_000).toISOString(),
    odds: [{ label: "1", value: "2.78" }, { label: "X", value: "3.46" }, { label: "2", value: "2.54" }],
    extraMarkets: 9,
  },
  {
    id: 102, eventId: "mock-102", sportKey: "basketball_nba",
    league: "NBA", country: "USA", countryFlag: FLAG("us"),
    home: { name: "Cleveland Cavaliers", score: null }, away: { name: "Detroit Pistons", score: null },
    period: "02:00", isLive: false, startingAt: new Date(Date.now() + 7_200_000).toISOString(),
    odds: [{ label: "1", value: "1.54" }, { label: "2", value: "2.43" }],
    extraMarkets: 4,
  },
  {
    id: 103, eventId: "mock-103", sportKey: "soccer_italy_serie_a",
    league: "Serie A", country: "Italy", countryFlag: FLAG("it"),
    home: { name: "Juventus", score: null }, away: { name: "AC Milan", score: null },
    period: "20:45", isLive: false, startingAt: new Date(Date.now() + 10_800_000).toISOString(),
    odds: [{ label: "1", value: "2.20" }, { label: "X", value: "3.20" }, { label: "2", value: "3.40" }],
    extraMarkets: 7,
  },
];
