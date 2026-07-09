/** API-Sports / api-football league crest CDN. */
const LEAGUE = (id: number) => `https://media.api-sports.io/football/leagues/${id}.png`;

/**
 * Known competition logos keyed by display / Odds API titles.
 * Prefer these over country flags in the sports league strip.
 */
export const LEAGUE_LOGOS: Record<string, string> = {
  // England
  "Premier League": LEAGUE(39),
  EPL: LEAGUE(39),
  Championship: LEAGUE(40),
  "League One": LEAGUE(41),
  "League Two": LEAGUE(42),
  "EFL Cup": LEAGUE(48),
  "FA Cup": LEAGUE(45),
  "Scottish Premiership": LEAGUE(179),
  "Premiership - Scotland": LEAGUE(179),

  // Spain
  "La Liga": LEAGUE(140),
  "La Liga - Spain": LEAGUE(140),
  "La Liga 2": LEAGUE(141),
  "Copa del Rey": LEAGUE(143),

  // Germany
  Bundesliga: LEAGUE(78),
  "Bundesliga - Germany": LEAGUE(78),
  "Bundesliga 2": LEAGUE(79),
  "Bundesliga 2 - Germany": LEAGUE(79),
  "3. Liga": LEAGUE(80),
  "DFB-Pokal": LEAGUE(81),

  // Italy
  "Serie A": LEAGUE(135),
  "Serie A - Italy": LEAGUE(135),
  "Serie B": LEAGUE(136),
  "Coppa Italia": LEAGUE(137),

  // France
  "Ligue 1": LEAGUE(61),
  "Ligue 1 - France": LEAGUE(61),
  "Ligue 2": LEAGUE(62),
  "Coupe de France": LEAGUE(66),

  // Europe cups
  "Champions League": LEAGUE(2),
  "UEFA Champions League": LEAGUE(2),
  "Europa League": LEAGUE(3),
  "UEFA Europa League": LEAGUE(3),
  "Conference League": LEAGUE(848),
  "UEFA Europa Conference League": LEAGUE(848),
  "Nations League": LEAGUE(5),
  "UEFA Nations League": LEAGUE(5),

  // World / internationals
  "FIFA World Cup": LEAGUE(1),
  "World Cup": LEAGUE(1),
  "Women's World Cup": LEAGUE(8),
  "Club World Cup": LEAGUE(15),
  AFCON: LEAGUE(6),
  "Africa Cup of Nations": LEAGUE(6),
  "Copa América": LEAGUE(9),
  "Gold Cup": LEAGUE(22),

  // Americas
  MLS: LEAGUE(253),
  "Liga MX": LEAGUE(262),
  "Liga Profesional": LEAGUE(128),
  "Primera División - Argentina": LEAGUE(128),
  "Brazil Série A": LEAGUE(71),
  "Brazil Série B": LEAGUE(72),
  "Copa Libertadores": LEAGUE(13),
  "Copa Sudamericana": LEAGUE(11),

  // Rest of world
  Eredivisie: LEAGUE(88),
  "Dutch Eredivisie": LEAGUE(88),
  "Primeira Liga": LEAGUE(94),
  "Primeira Liga - Portugal": LEAGUE(94),
  "Süper Lig": LEAGUE(203),
  "Turkey Super League": LEAGUE(203),
  "Austrian Bundesliga": LEAGUE(218),
  "Austrian Football Bundesliga": LEAGUE(218),
  Superliga: LEAGUE(119),
  "Denmark Superliga": LEAGUE(119),
  Eliteserien: LEAGUE(103),
  "Eliteserien - Norway": LEAGUE(103),
  Allsvenskan: LEAGUE(113),
  "Allsvenskan - Sweden": LEAGUE(113),
  Superettan: LEAGUE(114),
  "Swiss Super League": LEAGUE(207),
  "Swiss Superleague": LEAGUE(207),
  Veikkausliiga: LEAGUE(244),
  "Veikkausliiga - Finland": LEAGUE(244),
  "Chinese Super League": LEAGUE(169),
  "Super League - China": LEAGUE(169),
  "J League": LEAGUE(98),
  "K League 1": LEAGUE(292),
  "A-League": LEAGUE(188),
  "Saudi Pro League": LEAGUE(307),
  KPL: LEAGUE(276),
};

function normalizeLeagueKey(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const NORMALIZED = (() => {
  const map = new Map<string, string>();
  for (const [name, url] of Object.entries(LEAGUE_LOGOS)) {
    const key = normalizeLeagueKey(name);
    if (key && !map.has(key)) map.set(key, url);
  }
  return map;
})();

/** League crest URL for strip / headers — never a country flag. */
export function getLeagueLogo(name: string): string | undefined {
  if (!name?.trim()) return undefined;
  const trimmed = name.trim();
  if (LEAGUE_LOGOS[trimmed]) return LEAGUE_LOGOS[trimmed];

  const key = normalizeLeagueKey(trimmed);
  if (NORMALIZED.has(key)) return NORMALIZED.get(key);

  let best: { len: number; url: string } | null = null;
  for (const [k, url] of NORMALIZED) {
    if (k.length < 4) continue;
    if (key === k || key.includes(k) || k.includes(key)) {
      if (!best || k.length > best.len) best = { len: k.length, url };
    }
  }
  return best?.url;
}
