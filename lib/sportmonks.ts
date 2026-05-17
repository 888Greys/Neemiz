const BASE = "https://api.sportmonks.com/v3/football";
const TOKEN = process.env.SPORTS_MONK_API ?? "";

// ── Raw API types ─────────────────────────────────────────────────────────────

interface SMCountry {
  id: number;
  name: string;
  image_path?: string;
}

interface SMLeague {
  id: number;
  name: string;
  image_path?: string;
  country?: SMCountry;
}

interface SMParticipant {
  id: number;
  name: string;
  image_path?: string;
  meta?: { location: "home" | "away" };
}

interface SMScore {
  score: { goals: number | null; participant: "home" | "away" };
  type_id: number; // 1 = current score
}

interface SMPeriod {
  id: number;
  minutes?: number;
  ticking?: boolean;
  started?: boolean;
  description?: string;
}

interface SMState {
  id: number;
  name: string;
  short_name?: string;
}

interface SMOdd {
  id: number;
  market_id?: number;
  bookmaker_id?: number;
  type_id?: number;
  market_description?: string;
  label?: string;
  value?: string;
  name?: string;
  participant?: string;
  bookmaker_odds?: Array<{ label: string; value: string; name?: string }>;
}

// Sportmonks state_id reference:
// 1=NS(Not Started) 2=1H 3=HT 4=2H 5=FT 6=ET 7=PEN 11=AET 13=Abandoned 17=Cancelled
const FINISHED_STATE_IDS = new Set([5, 11, 13, 17, 21]);
const LIVE_STATE_IDS = new Set([2, 3, 4, 6, 7]);

interface SMFixture {
  id: number;
  name: string;
  starting_at: string;
  state_id?: number;
  participants?: SMParticipant[];
  scores?: SMScore[];
  periods?: SMPeriod[];
  state?: SMState;
  league?: SMLeague;
  odds?: SMOdd[];
}

// ── Normalised UI type ────────────────────────────────────────────────────────

export interface Match {
  id: number;
  league: string;
  leagueLogo?: string;
  country: string;
  countryFlag?: string;
  home: { name: string; logo?: string; score: number | null };
  away: { name: string; logo?: string; score: number | null };
  period: string;   // e.g. "2nd Half 86'" or "22:00"
  isLive: boolean;
  startingAt: string;
  odds: { label: string; value: string }[];
  extraMarkets: number;
}

// ── Fetcher ───────────────────────────────────────────────────────────────────

async function fetchSMOne<T>(
  path: string,
  include?: string,
  revalidate = 30,
): Promise<T | null> {
  if (!TOKEN) return null;
  const params = new URLSearchParams({ api_token: TOKEN });
  if (include) params.set("include", include);
  try {
    const res = await fetch(`${BASE}${path}?${params}`, { next: { revalidate } });
    if (!res.ok) { console.error(`SportsMonk ${path} → ${res.status}`); return null; }
    const json = await res.json();
    return (json.data ?? null) as T | null;
  } catch (e) {
    console.error("SportsMonk fetchOne error:", e);
    return null;
  }
}

async function fetchSM<T>(
  path: string,
  include?: string,
  extra?: Record<string, string>,
  revalidate = 60,
): Promise<T[]> {
  if (!TOKEN) return [];
  const params = new URLSearchParams({ api_token: TOKEN });
  if (include) params.set("include", include);
  if (extra) Object.entries(extra).forEach(([k, v]) => params.set(k, v));

  try {
    const res = await fetch(`${BASE}${path}?${params}`, {
      next: { revalidate },
    });
    if (!res.ok) {
      console.error(`SportsMonk ${path} → ${res.status}`);
      return [];
    }
    const json = await res.json();
    return (json.data ?? []) as T[];
  } catch (e) {
    console.error("SportsMonk fetch error:", e);
    return [];
  }
}

// ── Normaliser ────────────────────────────────────────────────────────────────

function buildPeriodLabel(f: SMFixture): string {
  const active = f.periods?.find((p) => p.ticking);
  if (active?.minutes) {
    const half = f.state?.name ?? "";
    return half ? `${half} ${active.minutes}'` : `${active.minutes}'`;
  }
  if (f.state?.name) return f.state.name;
  // upcoming — show local time
  const d = new Date(f.starting_at);
  return isNaN(d.getTime())
    ? "--:--"
    : d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function extractOdds(f: SMFixture): { label: string; value: string }[] {
  if (!f.odds?.length) return [];

  // market_id 1 = Full Time Result (1X2); pick first bookmaker's set
  const ftr = f.odds.filter((o) => o.market_id === 1 && o.value && o.label);
  if (ftr.length >= 2) {
    // group by bookmaker_id to get a consistent set of 3
    const firstBookie = ftr[0].bookmaker_id;
    const set = firstBookie
      ? ftr.filter((o) => o.bookmaker_id === firstBookie)
      : ftr;
    const ORDER: Record<string, number> = { home: 0, "1": 0, draw: 1, x: 1, away: 2, "2": 2 };
    const sorted = set.sort((a, b) => (ORDER[a.label!.toLowerCase()] ?? 9) - (ORDER[b.label!.toLowerCase()] ?? 9));
    return sorted.slice(0, 3).map((o) => ({
      label: normaliseOddLabel(o.label!),
      value: Number(o.value).toFixed(2),
    }));
  }

  // Fallback: nested bookmaker_odds
  const nested = f.odds.find((o) => o.bookmaker_odds?.length);
  if (nested?.bookmaker_odds) {
    return nested.bookmaker_odds.slice(0, 3).map((o) => ({
      label: normaliseOddLabel(o.label),
      value: Number(o.value).toFixed(2),
    }));
  }

  return [];
}

function normaliseOddLabel(raw: string): string {
  const map: Record<string, string> = {
    home: "1", away: "2", draw: "X",
    "1": "1", "2": "2", x: "X", X: "X",
  };
  return map[raw.toLowerCase()] ?? raw;
}

function normalize(f: SMFixture, live: boolean): Match {
  const home = f.participants?.find((p) => p.meta?.location === "home");
  const away = f.participants?.find((p) => p.meta?.location === "away");

  const cur = f.scores?.filter((s) => s.type_id === 1) ?? [];
  const homeScore = cur.find((s) => s.score.participant === "home")?.score.goals ?? null;
  const awayScore = cur.find((s) => s.score.participant === "away")?.score.goals ?? null;

  const odds = extractOdds(f);
  const distinctMarkets = new Set(f.odds?.map((o) => o.market_id)).size;
  const extraMarkets = Math.max(0, distinctMarkets - 1);

  return {
    id: f.id,
    league: f.league?.name ?? "Unknown League",
    leagueLogo: f.league?.image_path,
    country: f.league?.country?.name ?? "",
    countryFlag: f.league?.country?.image_path,
    home: { name: home?.name ?? "Home", logo: home?.image_path, score: homeScore },
    away: { name: away?.name ?? "Away", logo: away?.image_path, score: awayScore },
    period: buildPeriodLabel(f),
    isLive: live,
    startingAt: f.starting_at,
    odds,
    extraMarkets,
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function getLivescores(): Promise<Match[]> {
  const raw = await fetchSM<SMFixture>(
    "/livescores/inplay",
    "participants;scores;periods;state;league.country;odds",
    undefined,
    60,
  );
  return raw
    .filter((f) => !FINISHED_STATE_IDS.has(f.state_id ?? 0))
    .map((f) => normalize(f, true));
}

export async function getUpcomingFixtures(): Promise<Match[]> {
  const today = new Date().toISOString().split("T")[0];
  const endDate = new Date(Date.now() + 15 * 86_400_000).toISOString().split("T")[0];
  const raw = await fetchSM<SMFixture>(
    `/fixtures/between/${today}/${endDate}`,
    "participants;league.country;odds",
    { per_page: "200", sort: "starting_at" },
    60,
  );
  return raw
    .filter((f) => !FINISHED_STATE_IDS.has(f.state_id ?? 0) && !LIVE_STATE_IDS.has(f.state_id ?? 0))
    .map((f) => normalize(f, false));
}

// ── Fixture detail ────────────────────────────────────────────────────────────

export interface MatchEvent {
  id: number;
  type_id: number;   // 14=Goal 15=OwnGoal 16=RedCard 17=YellowRed 18=Sub 19=YellowCard
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

export interface MatchDetail {
  match: Match;
  homeParticipantId: number;
  awayParticipantId: number;
  events: MatchEvent[];
  stats: MatchStat[];
  homeLineup: LineupEntry[];
  awayLineup: LineupEntry[];
  homePeriodScores: (number | null)[];
  awayPeriodScores: (number | null)[];
}

interface SMFixtureDetail extends SMFixture {
  events?: MatchEvent[];
  statistics?: Array<{
    type_id: number;
    participant_id: number;
    location: "home" | "away";
    data: { value: number };
    type?: { name: string };
  }>;
  lineups?: Array<LineupEntry>;
}

// Stats to skip (shown in events timeline instead)
const SKIP_STAT_NAMES = new Set(["Substitutions", "Yellowcards", "Redcards", "Assists"]);

export async function getFixtureDetail(id: number): Promise<MatchDetail | null> {
  const f = await fetchSMOne<SMFixtureDetail>(
    `/fixtures/${id}`,
    "participants;scores;periods;state;league.country;events;statistics.type;lineups",
    30,
  );
  if (!f) return null;

  const home = f.participants?.find((p) => p.meta?.location === "home");
  const away = f.participants?.find((p) => p.meta?.location === "away");
  const isLive = LIVE_STATE_IDS.has(f.state_id ?? 0);

  // Period scores: type_id 15 = 1st half final, type_id 16 = 2nd half final (Sportmonks period score types)
  // Actually scores array has type_id per-score; 1=current, 2=1H, 3=FT, etc.
  const periodScore = (loc: "home" | "away", typeId: number) =>
    f.scores?.find((s) => s.score.participant === loc && s.type_id === typeId)?.score.goals ?? null;

  const homePeriodScores = [periodScore("home", 2), periodScore("home", 3)];
  const awayPeriodScores = [periodScore("away", 2), periodScore("away", 3)];

  // Stats: pair home/away by stat name, skip irrelevant ones
  const statMap: Record<string, MatchStat> = {};
  for (const s of f.statistics ?? []) {
    const name = s.type?.name ?? `Stat ${s.type_id}`;
    if (SKIP_STAT_NAMES.has(name)) continue;
    if (!statMap[name]) statMap[name] = { name, home: null, away: null };
    if (s.location === "home") statMap[name].home = s.data.value;
    else statMap[name].away = s.data.value;
  }

  return {
    match: normalize(f, isLive),
    homeParticipantId: home?.id ?? 0,
    awayParticipantId: away?.id ?? 0,
    events: (f.events ?? []).sort((a, b) => a.minute - b.minute || (a.extra_minute ?? 0) - (b.extra_minute ?? 0)),
    stats: Object.values(statMap).filter((s) => s.home !== null || s.away !== null),
    homeLineup: (f.lineups ?? []).filter((l) => l.participant_id === home?.id).sort((a, b) => (a.formation_position ?? 99) - (b.formation_position ?? 99)),
    awayLineup: (f.lineups ?? []).filter((l) => l.participant_id === away?.id).sort((a, b) => (a.formation_position ?? 99) - (b.formation_position ?? 99)),
    homePeriodScores,
    awayPeriodScores,
  };
}

// ── Mock fallback (used when SPORTS_MONK_API is not set) ──────────────────────
// Country flags via flagcdn.com (public, no auth).
// Team/league logos come from SportsMonk API once SPORTS_MONK_API key is set.

const FLAG = (code: string) => `https://flagcdn.com/w40/${code}.png`;

export const MOCK_LIVE: Match[] = [
  {
    id: 1,
    league: "Turkey. Süper Lig", country: "Turkey",
    countryFlag: FLAG("tr"),
    home: { name: "Rizespor", score: 2 },
    away: { name: "Beşiktaş", score: 2 },
    period: "2nd Half 86'", isLive: true, startingAt: "",
    odds: [{ label: "1", value: "5.50" }, { label: "X", value: "1.50" }, { label: "2", value: "5.00" }],
    extraMarkets: 57,
  },
  {
    id: 2,
    league: "ATP Rome — Clay", country: "Italy",
    countryFlag: FLAG("it"),
    home: { name: "J. Sinner", score: null },
    away: { name: "D. Medvedev", score: null },
    period: "2nd Set", isLive: true, startingAt: "",
    odds: [{ label: "1", value: "1.11" }, { label: "2", value: "6.49" }],
    extraMarkets: 99,
  },
  {
    id: 3,
    league: "France. Ligue 2", country: "France",
    countryFlag: FLAG("fr"),
    home: { name: "Saint-Étienne", score: 0 },
    away: { name: "Rodez Aveyron", score: 0 },
    period: "1st Half 17'", isLive: true, startingAt: "",
    odds: [{ label: "1", value: "1.90" }, { label: "X", value: "3.23" }, { label: "2", value: "4.30" }],
    extraMarkets: 43,
  },
  {
    id: 4,
    league: "Germany. Bundesliga", country: "Germany",
    countryFlag: FLAG("de"),
    home: { name: "Bayern Munich", score: 2 },
    away: { name: "Dortmund", score: 1 },
    period: "HT", isLive: true, startingAt: "",
    odds: [{ label: "1", value: "1.35" }, { label: "X", value: "4.80" }, { label: "2", value: "7.20" }],
    extraMarkets: 84,
  },
  {
    id: 5,
    league: "Spain. La Liga", country: "Spain",
    countryFlag: FLAG("es"),
    home: { name: "Barcelona", score: 1 },
    away: { name: "Real Madrid", score: 1 },
    period: "2nd Half 71'", isLive: true, startingAt: "",
    odds: [{ label: "1", value: "2.60" }, { label: "X", value: "3.10" }, { label: "2", value: "2.80" }],
    extraMarkets: 112,
  },
  {
    id: 6,
    league: "England. Premier League", country: "England",
    countryFlag: FLAG("gb-eng"),
    home: { name: "Arsenal", score: 2 },
    away: { name: "Chelsea", score: 1 },
    period: "2nd Half 62'", isLive: true, startingAt: "",
    odds: [{ label: "1", value: "1.45" }, { label: "X", value: "4.20" }, { label: "2", value: "6.50" }],
    extraMarkets: 124,
  },
];

export const MOCK_UPCOMING: Match[] = [
  {
    id: 101,
    league: "England. Premier League", country: "England",
    countryFlag: FLAG("gb-eng"),
    home: { name: "Aston Villa", score: null },
    away: { name: "Liverpool", score: null },
    period: "22:00", isLive: false, startingAt: "2026-05-15T22:00:00Z",
    odds: [{ label: "1", value: "2.78" }, { label: "X", value: "3.46" }, { label: "2", value: "2.54" }],
    extraMarkets: 99,
  },
  {
    id: 102,
    league: "IEM Atlanta. CS2", country: "USA",
    countryFlag: FLAG("us"),
    home: { name: "Natus Vincere", score: null },
    away: { name: "Vitality", score: null },
    period: "23:30", isLive: false, startingAt: "2026-05-15T23:30:00Z",
    odds: [{ label: "1", value: "3.96" }, { label: "2", value: "1.25" }],
    extraMarkets: 99,
  },
  {
    id: 103,
    league: "USA. NBA", country: "USA",
    countryFlag: FLAG("us"),
    home: { name: "Cleveland Cavaliers", score: null },
    away: { name: "Detroit Pistons", score: null },
    period: "02:00", isLive: false, startingAt: "2026-05-16T02:00:00Z",
    odds: [{ label: "1", value: "1.54" }, { label: "2", value: "2.43" }],
    extraMarkets: 45,
  },
  {
    id: 104,
    league: "Spain. La Liga", country: "Spain",
    countryFlag: FLAG("es"),
    home: { name: "Atlético Madrid", score: null },
    away: { name: "Sevilla", score: null },
    period: "21:00", isLive: false, startingAt: "2026-05-15T21:00:00Z",
    odds: [{ label: "1", value: "1.72" }, { label: "X", value: "3.90" }, { label: "2", value: "4.80" }],
    extraMarkets: 88,
  },
  {
    id: 105,
    league: "Italy. Serie A", country: "Italy",
    countryFlag: FLAG("it"),
    home: { name: "Juventus", score: null },
    away: { name: "AC Milan", score: null },
    period: "20:45", isLive: false, startingAt: "2026-05-15T20:45:00Z",
    odds: [{ label: "1", value: "2.20" }, { label: "X", value: "3.20" }, { label: "2", value: "3.40" }],
    extraMarkets: 76,
  },
  {
    id: 106,
    league: "France. Ligue 1", country: "France",
    countryFlag: FLAG("fr"),
    home: { name: "PSG", score: null },
    away: { name: "Monaco", score: null },
    period: "21:00", isLive: false, startingAt: "2026-05-15T21:00:00Z",
    odds: [{ label: "1", value: "1.55" }, { label: "X", value: "4.10" }, { label: "2", value: "5.50" }],
    extraMarkets: 91,
  },
];
