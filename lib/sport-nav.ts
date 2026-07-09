/** Map Odds API sport_key / group → UI sport slug + label + glyph. */
export type SportNav = {
  slug: string;
  label: string;
  /** Sport ball / equipment glyph (real icon, not letter initials) */
  glyph: string;
  /** Odds API group name(s) */
  groups: string[];
  /** sport_key prefixes */
  prefixes: string[];
};

export const DEFAULT_SPORT_SLUG = "football";

export const SPORT_NAV: SportNav[] = [
  {
    slug: "football",
    label: "Football",
    glyph: "⚽",
    groups: ["Soccer"],
    prefixes: ["soccer_"],
  },
  {
    slug: "basketball",
    label: "Basketball",
    glyph: "🏀",
    groups: ["Basketball"],
    prefixes: ["basketball_"],
  },
  {
    slug: "tennis",
    label: "Tennis",
    glyph: "🎾",
    groups: ["Tennis"],
    prefixes: ["tennis_"],
  },
  {
    slug: "american-football",
    label: "American Football",
    glyph: "🏈",
    groups: ["American Football"],
    prefixes: ["americanfootball_"],
  },
  {
    slug: "baseball",
    label: "Baseball",
    glyph: "⚾",
    groups: ["Baseball"],
    prefixes: ["baseball_"],
  },
  {
    slug: "ice-hockey",
    label: "Ice Hockey",
    glyph: "🏒",
    groups: ["Ice Hockey"],
    prefixes: ["icehockey_"],
  },
  {
    slug: "cricket",
    label: "Cricket",
    glyph: "🏏",
    groups: ["Cricket"],
    prefixes: ["cricket_"],
  },
  {
    slug: "mma",
    label: "MMA",
    glyph: "🥊",
    groups: ["Mixed Martial Arts"],
    prefixes: ["mma_"],
  },
  {
    slug: "boxing",
    label: "Boxing",
    glyph: "🥊",
    groups: ["Boxing"],
    prefixes: ["boxing_"],
  },
  {
    slug: "rugby",
    label: "Rugby",
    glyph: "🏉",
    groups: ["Rugby League", "Rugby Union"],
    prefixes: ["rugbyleague_", "rugbyunion_"],
  },
  {
    slug: "aussie-rules",
    label: "Aussie Rules",
    glyph: "🏈",
    groups: ["Aussie Rules"],
    prefixes: ["aussierules_"],
  },
  {
    slug: "handball",
    label: "Handball",
    glyph: "🤾",
    groups: ["Handball"],
    prefixes: ["handball_"],
  },
  {
    slug: "lacrosse",
    label: "Lacrosse",
    glyph: "🥍",
    groups: ["Lacrosse"],
    prefixes: ["lacrosse_"],
  },
];

export function sportNavFromSlug(slug: string | undefined | null): SportNav | null {
  if (!slug) return null;
  return SPORT_NAV.find((s) => s.slug === slug) ?? null;
}

/** Resolve sport for the page — defaults to Football when unset. */
export function resolveSportSlug(raw: string | undefined | null): string {
  if (raw === "all") return "all";
  if (raw && SPORT_NAV.some((s) => s.slug === raw)) return raw;
  return DEFAULT_SPORT_SLUG;
}

export function sportSlugFromKey(sportKey: string): string | null {
  const key = sportKey.toLowerCase();
  for (const s of SPORT_NAV) {
    if (s.prefixes.some((p) => key.startsWith(p))) return s.slug;
  }
  if (key.startsWith("football_")) return "football";
  return null;
}

export function matchBelongsToSport(sportKey: string, nav: SportNav): boolean {
  const key = sportKey.toLowerCase();
  return (
    nav.prefixes.some((p) => key.startsWith(p)) ||
    (nav.slug === "football" && key.startsWith("football_"))
  );
}
