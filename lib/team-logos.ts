const SOCCER = (id: number) => `https://a.espncdn.com/i/teamlogos/soccer/500/${id}.png`;
const NBA = (id: number) => `https://a.espncdn.com/i/teamlogos/nba/500/${id}.png`;
/** National teams — API-Sports CDN (same IDs as api-football). */
const NATION = (id: number) => `https://media.api-sports.io/football/teams/${id}.png`;
const FLAG = (code: string) => `https://flagcdn.com/w80/${code}.png`;

export const TEAM_LOGOS: Record<string, string> = {
  // ── National teams (World Cup / internationals) ───────────────────────────
  Argentina: NATION(26),
  Belgium: NATION(1),
  Brazil: NATION(6),
  England: NATION(10),
  France: NATION(2),
  Germany: NATION(25),
  Morocco: NATION(31),
  Netherlands: NATION(1118),
  Norway: NATION(1090),
  Portugal: NATION(27),
  Spain: NATION(9),
  Switzerland: NATION(15),
  Croatia: NATION(3),
  Denmark: NATION(21),
  Italy: NATION(768),
  Japan: NATION(12),
  Mexico: NATION(16),
  Poland: NATION(24),
  Senegal: NATION(13),
  "South Korea": NATION(17),
  "Korea Republic": NATION(17),
  Sweden: NATION(5),
  Uruguay: NATION(7),
  USA: NATION(2384),
  "United States": NATION(2384),
  Canada: NATION(5529),
  Australia: NATION(20),
  Cameroon: NATION(29),
  Ghana: NATION(1504),
  Nigeria: NATION(19),
  Ecuador: NATION(2382),
  Colombia: NATION(8),
  Chile: NATION(2383),
  Peru: NATION(30),
  Wales: NATION(766),
  Scotland: NATION(1108),
  Ireland: NATION(1110),
  "Republic of Ireland": NATION(1110),
  Austria: NATION(782),
  Serbia: NATION(14),
  Tunisia: NATION(28),
  Iran: NATION(22),
  "Saudi Arabia": NATION(23),
  Qatar: NATION(1569),
  Egypt: NATION(32),
  Algeria: NATION(1530),
  "Ivory Coast": NATION(1509),
  "Côte d'Ivoire": NATION(1509),
  Turkey: NATION(777),
  Greece: NATION(788),
  Ukraine: NATION(772),
  Paraguay: NATION(2381),
  Bolivia: NATION(2380),
  Venezuela: NATION(2379),
  "New Zealand": NATION(18),
  "South Africa": NATION(1529),
  Mali: NATION(1508),
  Angola: NATION(1506),

  // ── Premier League ────────────────────────────────────────────────────────
  Arsenal: SOCCER(359),
  "Aston Villa": SOCCER(362),
  Bournemouth: SOCCER(349),
  "AFC Bournemouth": SOCCER(349),
  Brentford: SOCCER(337),
  Brighton: SOCCER(331),
  "Brighton and Hove Albion": SOCCER(331),
  "Brighton & Hove Albion": SOCCER(331),
  Chelsea: SOCCER(363),
  "Crystal Palace": SOCCER(384),
  Everton: SOCCER(368),
  Fulham: SOCCER(370),
  "Ipswich Town": SOCCER(373),
  Ipswich: SOCCER(373),
  "Leicester City": SOCCER(375),
  Leicester: SOCCER(375),
  Liverpool: SOCCER(364),
  "Manchester City": SOCCER(382),
  "Man City": SOCCER(382),
  "Manchester United": SOCCER(360),
  "Man United": SOCCER(360),
  "Man Utd": SOCCER(360),
  "Newcastle United": SOCCER(361),
  Newcastle: SOCCER(361),
  "Nottingham Forest": SOCCER(393),
  "Nottm Forest": SOCCER(393),
  Southampton: SOCCER(376),
  "Tottenham Hotspur": SOCCER(367),
  Tottenham: SOCCER(367),
  Spurs: SOCCER(367),
  "West Ham United": SOCCER(371),
  "West Ham": SOCCER(371),
  "Wolverhampton Wanderers": SOCCER(380),
  Wolves: SOCCER(380),
  Sunderland: SOCCER(379),
  "Sunderland AFC": SOCCER(379),
  Burnley: SOCCER(348),
  "Leeds United": SOCCER(357),
  Leeds: SOCCER(357),
  "Luton Town": SOCCER(389),
  "Sheffield United": SOCCER(398),
  "Sheffield Utd": SOCCER(398),

  // ── Championship / EFL (common) ───────────────────────────────────────────
  "Leicester City FC": SOCCER(375),
  Middlesbrough: SOCCER(369),
  "Norwich City": SOCCER(381),
  Norwich: SOCCER(381),
  "West Bromwich Albion": SOCCER(383),
  "West Brom": SOCCER(383),
  "Coventry City": SOCCER(388),
  Coventry: SOCCER(388),
  "Watford": SOCCER(395),
  "Hull City": SOCCER(306),
  "Stoke City": SOCCER(336),
  "Swansea City": SOCCER(318),
  Swansea: SOCCER(318),
  "Bristol City": SOCCER(333),
  "Queens Park Rangers": SOCCER(334),
  QPR: SOCCER(334),
  "Blackburn Rovers": SOCCER(365),
  Blackburn: SOCCER(365),
  "Preston North End": SOCCER(372),
  Preston: SOCCER(372),
  "Millwall": SOCCER(391),
  "Cardiff City": SOCCER(350),
  Cardiff: SOCCER(350),
  "Plymouth Argyle": SOCCER(392),
  Plymouth: SOCCER(392),
  "Oxford United": SOCCER(311),
  "Derby County": SOCCER(374),
  Derby: SOCCER(374),
  "Portsmouth": SOCCER(385),
  "Sheffield Wednesday": SOCCER(399),

  // ── La Liga ───────────────────────────────────────────────────────────────
  Barcelona: SOCCER(83),
  "FC Barcelona": SOCCER(83),
  "Real Madrid": SOCCER(86),
  "Atletico Madrid": SOCCER(1068),
  "Atlético Madrid": SOCCER(1068),
  "Atletico de Madrid": SOCCER(1068),
  Sevilla: SOCCER(243),
  "Sevilla FC": SOCCER(243),
  "Real Betis": SOCCER(244),
  "Athletic Club": SOCCER(93),
  "Athletic Bilbao": SOCCER(93),
  Valencia: SOCCER(95),
  "Valencia CF": SOCCER(95),
  Villarreal: SOCCER(94),
  "Villarreal CF": SOCCER(94),
  "Real Sociedad": SOCCER(89),
  Girona: SOCCER(9812),
  "Girona FC": SOCCER(9812),
  Osasuna: SOCCER(88),
  "Celta Vigo": SOCCER(3842),
  "Celta de Vigo": SOCCER(3842),
  Getafe: SOCCER(3751),
  "Getafe CF": SOCCER(3751),
  "Rayo Vallecano": SOCCER(3750),
  Alaves: SOCCER(3738),
  "Deportivo Alaves": SOCCER(3738),
  Alavés: SOCCER(3738),
  Mallorca: SOCCER(9906),
  "RCD Mallorca": SOCCER(9906),
  Espanyol: SOCCER(3748),
  "RCD Espanyol": SOCCER(3748),
  Leganes: SOCCER(9813),
  Leganés: SOCCER(9813),
  Valladolid: SOCCER(9811),
  "Real Valladolid": SOCCER(9811),
  "Las Palmas": SOCCER(9815),

  // ── Bundesliga ────────────────────────────────────────────────────────────
  "Bayern Munich": SOCCER(132),
  "FC Bayern Munich": SOCCER(132),
  "Bayern München": SOCCER(132),
  "Borussia Dortmund": SOCCER(124),
  Dortmund: SOCCER(124),
  "Bayer Leverkusen": SOCCER(131),
  Leverkusen: SOCCER(131),
  "RB Leipzig": SOCCER(23826),
  Leipzig: SOCCER(23826),
  "Eintracht Frankfurt": SOCCER(9823),
  Frankfurt: SOCCER(9823),
  "VfB Stuttgart": SOCCER(128),
  Stuttgart: SOCCER(128),
  "SC Freiburg": SOCCER(9821),
  Freiburg: SOCCER(9821),
  "TSG Hoffenheim": SOCCER(9822),
  Hoffenheim: SOCCER(9822),
  "Borussia Monchengladbach": SOCCER(130),
  "Borussia Mönchengladbach": SOCCER(130),
  "Mönchengladbach": SOCCER(130),
  "VfL Wolfsburg": SOCCER(129),
  Wolfsburg: SOCCER(129),
  "Werder Bremen": SOCCER(9835),
  Bremen: SOCCER(9835),
  "FC Augsburg": SOCCER(15985),
  Augsburg: SOCCER(15985),
  "1. FSV Mainz 05": SOCCER(16040),
  Mainz: SOCCER(16040),
  "Mainz 05": SOCCER(16040),
  "Union Berlin": SOCCER(43090),
  "1. FC Union Berlin": SOCCER(43090),
  "FC Heidenheim": SOCCER(43092),
  Heidenheim: SOCCER(43092),
  "VfL Bochum": SOCCER(15984),
  Bochum: SOCCER(15984),
  "Holstein Kiel": SOCCER(16042),
  "FC St. Pauli": SOCCER(16041),
  "St. Pauli": SOCCER(16041),
  "1. FC Köln": SOCCER(122),
  "FC Koln": SOCCER(122),
  "FC Cologne": SOCCER(122),
  "Hamburger SV": SOCCER(127),
  Hamburg: SOCCER(127),

  // ── Serie A ───────────────────────────────────────────────────────────────
  "Inter Milan": SOCCER(110),
  Internazionale: SOCCER(110),
  Inter: SOCCER(110),
  "AC Milan": SOCCER(103),
  Milan: SOCCER(103),
  Juventus: SOCCER(111),
  Napoli: SOCCER(114),
  "SSC Napoli": SOCCER(114),
  Roma: SOCCER(104),
  "AS Roma": SOCCER(104),
  Lazio: SOCCER(112),
  "SS Lazio": SOCCER(112),
  Atalanta: SOCCER(105),
  Fiorentina: SOCCER(109),
  Bologna: SOCCER(107),
  Torino: SOCCER(239),
  Genoa: SOCCER(3263),
  Monza: SOCCER(10919),
  Udinese: SOCCER(118),
  Cagliari: SOCCER(2925),
  Empoli: SOCCER(2572),
  Verona: SOCCER(119),
  "Hellas Verona": SOCCER(119),
  Lecce: SOCCER(113),
  Como: SOCCER(2571),
  Parma: SOCCER(115),
  Venezia: SOCCER(2574),

  // ── Ligue 1 ───────────────────────────────────────────────────────────────
  "Paris Saint Germain": SOCCER(160),
  "Paris Saint-Germain": SOCCER(160),
  PSG: SOCCER(160),
  Marseille: SOCCER(176),
  "Olympique Marseille": SOCCER(176),
  "Olympique de Marseille": SOCCER(176),
  Lyon: SOCCER(167),
  "Olympique Lyonnais": SOCCER(167),
  Monaco: SOCCER(174),
  "AS Monaco": SOCCER(174),
  Lille: SOCCER(166),
  "LOSC Lille": SOCCER(166),
  Nice: SOCCER(2502),
  "OGC Nice": SOCCER(2502),
  Rennes: SOCCER(169),
  "Stade Rennais": SOCCER(169),
  Lens: SOCCER(175),
  "RC Lens": SOCCER(175),
  Strasbourg: SOCCER(180),
  Nantes: SOCCER(165),
  Reims: SOCCER(178),
  Toulouse: SOCCER(179),
  Brest: SOCCER(171),
  Montpellier: SOCCER(164),
  "Le Havre": SOCCER(173),
  Auxerre: SOCCER(172),
  Angers: SOCCER(170),
  "Saint-Etienne": SOCCER(168),
  "Saint-Étienne": SOCCER(168),

  // ── Other big clubs ───────────────────────────────────────────────────────
  Ajax: SOCCER(139),
  PSV: SOCCER(148),
  "PSV Eindhoven": SOCCER(148),
  Feyenoord: SOCCER(209),
  "FC Porto": SOCCER(437),
  Porto: SOCCER(437),
  Benfica: SOCCER(1929),
  "Sporting CP": SOCCER(2250),
  Sporting: SOCCER(2250),
  "Sporting Lisbon": SOCCER(2250),
  Celtic: SOCCER(2569),
  Rangers: SOCCER(2570),
  Galatasaray: SOCCER(1866),
  Fenerbahce: SOCCER(1867),
  Fenerbahçe: SOCCER(1867),
  Besiktas: SOCCER(1868),
  Beşiktaş: SOCCER(1868),
  "Al Hilal": SOCCER(21827),
  "Al Nassr": SOCCER(21828),
  "Inter Miami": SOCCER(20232),
  "Inter Miami CF": SOCCER(20232),
  "LA Galaxy": SOCCER(187),
  "Los Angeles FC": SOCCER(21300),
  "LAFC": SOCCER(21300),
  Flamengo: SOCCER(819),
  Palmeiras: SOCCER(2029),
  "Sao Paulo": SOCCER(2026),
  "São Paulo": SOCCER(2026),
  Corinthians: SOCCER(874),
  "River Plate": SOCCER(2094),
  Boca: SOCCER(2095),
  "Boca Juniors": SOCCER(2095),

  // ── NBA ───────────────────────────────────────────────────────────────────
  "Atlanta Hawks": NBA(1),
  "Boston Celtics": NBA(2),
  "Brooklyn Nets": NBA(17),
  "Charlotte Hornets": NBA(30),
  "Chicago Bulls": NBA(4),
  "Cleveland Cavaliers": NBA(5),
  "Dallas Mavericks": NBA(6),
  "Denver Nuggets": NBA(7),
  "Detroit Pistons": NBA(8),
  "Golden State Warriors": NBA(9),
  "Houston Rockets": NBA(10),
  "Indiana Pacers": NBA(11),
  "LA Clippers": NBA(12),
  "Los Angeles Clippers": NBA(12),
  "Los Angeles Lakers": NBA(13),
  "LA Lakers": NBA(13),
  "Memphis Grizzlies": NBA(29),
  "Miami Heat": NBA(14),
  "Milwaukee Bucks": NBA(15),
  "Minnesota Timberwolves": NBA(16),
  "New Orleans Pelicans": NBA(3),
  "New York Knicks": NBA(18),
  "Oklahoma City Thunder": NBA(25),
  "Orlando Magic": NBA(19),
  "Philadelphia 76ers": NBA(20),
  "Phoenix Suns": NBA(21),
  "Portland Trail Blazers": NBA(22),
  "Sacramento Kings": NBA(23),
  "San Antonio Spurs": NBA(24),
  "Toronto Raptors": NBA(28),
  "Utah Jazz": NBA(26),
  "Washington Wizards": NBA(27),
};

const FLAG_BY_NATION: Record<string, string> = {
  Argentina: "ar",
  Belgium: "be",
  Brazil: "br",
  England: "gb-eng",
  France: "fr",
  Germany: "de",
  Morocco: "ma",
  Netherlands: "nl",
  Norway: "no",
  Portugal: "pt",
  Spain: "es",
  Switzerland: "ch",
  Croatia: "hr",
  Denmark: "dk",
  Italy: "it",
  Japan: "jp",
  Mexico: "mx",
  Poland: "pl",
  Senegal: "sn",
  "South Korea": "kr",
  "Korea Republic": "kr",
  Sweden: "se",
  Uruguay: "uy",
  USA: "us",
  "United States": "us",
  Canada: "ca",
  Australia: "au",
  Cameroon: "cm",
  Ghana: "gh",
  Nigeria: "ng",
  Ecuador: "ec",
  Colombia: "co",
  Chile: "cl",
  Peru: "pe",
  Wales: "gb-wls",
  Scotland: "gb-sct",
  Ireland: "ie",
  "Republic of Ireland": "ie",
  Austria: "at",
  Serbia: "rs",
  Tunisia: "tn",
  Iran: "ir",
  "Saudi Arabia": "sa",
  Qatar: "qa",
  India: "in",
  Kenya: "ke",
  Egypt: "eg",
  Algeria: "dz",
  "Ivory Coast": "ci",
  "Côte d'Ivoire": "ci",
  Turkey: "tr",
  Greece: "gr",
  Ukraine: "ua",
  Paraguay: "py",
  Bolivia: "bo",
  Venezuela: "ve",
  Panama: "pa",
  "Costa Rica": "cr",
  Honduras: "hn",
  Jamaica: "jm",
  "New Zealand": "nz",
  "South Africa": "za",
  Mali: "ml",
  Angola: "ao",
  Czechia: "cz",
  "Czech Republic": "cz",
  Slovakia: "sk",
  Romania: "ro",
  Hungary: "hu",
  Slovenia: "si",
  Albania: "al",
  Georgia: "ge",
  Iceland: "is",
  Finland: "fi",
  "Northern Ireland": "gb-nir",
};

/** Lowercase, strip accents / punctuation / FC|CF|AFC noise for fuzzy match. */
export function normalizeTeamKey(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(
      /\b(fc|cf|afc|sc|ac|as|ssc|rcd|rc|sv|vfb|vfl|tsv|bk|if|fk|sk|cd|ud|sd|club|de|the)\b/g,
      " ",
    )
    .replace(/\s+/g, " ")
    .trim();
}

const NORMALIZED_LOGOS = (() => {
  const map = new Map<string, string>();
  for (const [name, url] of Object.entries(TEAM_LOGOS)) {
    const key = normalizeTeamKey(name);
    if (key && !map.has(key)) map.set(key, url);
  }
  return map;
})();

const NORMALIZED_FLAGS = (() => {
  const map = new Map<string, string>();
  for (const [name, code] of Object.entries(FLAG_BY_NATION)) {
    map.set(normalizeTeamKey(name), FLAG(code));
  }
  return map;
})();

/**
 * Sync logo lookup: static map (exact + fuzzy) then national flag.
 * Clubs not in the map return undefined — use resolveTeamLogo / attachMatchLogos.
 */
export function getTeamLogo(name: string): string | undefined {
  if (!name?.trim()) return undefined;
  const trimmed = name.trim();
  if (TEAM_LOGOS[trimmed]) return TEAM_LOGOS[trimmed];
  if (TEAM_LOGOS[name]) return TEAM_LOGOS[name];

  const key = normalizeTeamKey(trimmed);
  if (NORMALIZED_LOGOS.has(key)) return NORMALIZED_LOGOS.get(key);

  // Prefer longer keys so "Inter Milan" wins over accidental short overlaps.
  let best: { len: number; url: string } | null = null;
  for (const [k, url] of NORMALIZED_LOGOS) {
    if (k.length < 5) continue;
    if (key === k || key.startsWith(k + " ") || k.startsWith(key + " ") || key.includes(" " + k) || k.includes(" " + key)) {
      if (!best || k.length > best.len) best = { len: k.length, url };
    }
  }
  if (best) return best.url;

  return NORMALIZED_FLAGS.get(key) ?? (FLAG_BY_NATION[trimmed] ? FLAG(FLAG_BY_NATION[trimmed]!) : undefined);
}

const SPORTSDB_KEY = process.env.THESPORTSDB_KEY ?? "3";

type SportsDbTeam = {
  strTeam?: string;
  strAlternate?: string;
  strBadge?: string;
  strTeamBadge?: string;
};

/** Free TheSportsDB badge lookup (cached ~30 days). Safe for page loads. */
export async function fetchSportsDbBadge(name: string): Promise<string | undefined> {
  if (!name?.trim()) return undefined;
  try {
    const res = await fetch(
      `https://www.thesportsdb.com/api/v1/json/${SPORTSDB_KEY}/searchteams.php?t=${encodeURIComponent(name.trim())}`,
      { next: { revalidate: 2_592_000 } },
    );
    if (!res.ok) return undefined;
    const data = (await res.json()) as { teams?: SportsDbTeam[] | null };
    const teams = data?.teams;
    if (!teams?.length) return undefined;

    const want = normalizeTeamKey(name);
    const best =
      teams.find((t) => normalizeTeamKey(t.strTeam ?? "") === want) ??
      teams.find((t) => {
        const alt = (t.strAlternate ?? "")
          .split(",")
          .map((s) => normalizeTeamKey(s))
          .filter(Boolean);
        return alt.includes(want);
      }) ??
      teams.find((t) => {
        const n = normalizeTeamKey(t.strTeam ?? "");
        return n.includes(want) || want.includes(n);
      }) ??
      teams[0];

    return best?.strBadge || best?.strTeamBadge || undefined;
  } catch {
    return undefined;
  }
}

/** Sync map first, then SportsDB. */
export async function resolveTeamLogo(name: string): Promise<string | undefined> {
  return getTeamLogo(name) ?? (await fetchSportsDbBadge(name));
}

type LogoSide = { name: string; logo?: string; score: number | null };

/** Fill missing logos on a match list (bounded SportsDB lookups, free). */
export async function attachMatchLogos<
  T extends { home: LogoSide; away: LogoSide },
>(matches: T[], maxLookups = 48): Promise<T[]> {
  const need = new Set<string>();
  for (const m of matches) {
    if (!m.home.logo && !getTeamLogo(m.home.name)) need.add(m.home.name);
    if (!m.away.logo && !getTeamLogo(m.away.name)) need.add(m.away.name);
  }

  const names = [...need].slice(0, maxLookups);
  const found = new Map<string, string | undefined>();
  const BATCH = 6;
  for (let i = 0; i < names.length; i += BATCH) {
    const batch = names.slice(i, i + BATCH);
    const urls = await Promise.all(batch.map(fetchSportsDbBadge));
    batch.forEach((n, j) => found.set(n, urls[j]));
  }

  return matches.map((m) => ({
    ...m,
    home: {
      ...m.home,
      logo: m.home.logo ?? getTeamLogo(m.home.name) ?? found.get(m.home.name),
    },
    away: {
      ...m.away,
      logo: m.away.logo ?? getTeamLogo(m.away.name) ?? found.get(m.away.name),
    },
  }));
}
