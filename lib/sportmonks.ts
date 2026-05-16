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
  type_id?: number;
  market_description?: string;
  label?: string;
  value?: string;
  name?: string;
  participant?: string;
  bookmaker_odds?: Array<{ label: string; value: string; name?: string }>;
}

interface SMFixture {
  id: number;
  name: string;
  starting_at: string;
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

  // Try flat-odds first (v3 default): market_id 1 = Full Time Result
  const flat = f.odds.filter(
    (o) => (o.market_id === 1 || o.type_id === 1) && o.value && o.label,
  );
  if (flat.length >= 2) {
    return flat.slice(0, 3).map((o) => ({
      label: normaliseOddLabel(o.label!),
      value: Number(o.value).toFixed(2),
    }));
  }

  // Try nested bookmaker_odds
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
  const extraMarkets = Math.max(0, (f.odds?.length ?? 0) - 1) * 12;

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
    30,
  );
  return raw.map((f) => normalize(f, true));
}

export async function getUpcomingFixtures(limit = 18): Promise<Match[]> {
  const today = new Date().toISOString().split("T")[0];
  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().split("T")[0];
  const raw = await fetchSM<SMFixture>(
    `/fixtures/between/${today}/${tomorrow}`,
    "participants;league.country;odds",
    { per_page: String(limit), sort: "starting_at" },
    300,
  );
  return raw.map((f) => normalize(f, false));
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
