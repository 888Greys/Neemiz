/**
 * Map betslip selections (UI display names) onto cached Odds API markets.
 * List cards use "3 Way" + team names; the cache stores "Full Time Result" + 1/X/2.
 */
import type { BettingMarket, Match } from "@/lib/theoddsapi";

const MARKET_CANONICAL: Record<string, string> = {
  "full time result": "Full Time Result",
  "3 way": "Full Time Result",
  "1x2": "Full Time Result",
  "match result": "Full Time Result",
  "match winner": "Full Time Result",
  "double chance": "Double Chance",
  "over/under": "Over/Under",
  totals: "Over/Under",
  "total goals": "Over/Under",
  handicap: "Handicap",
  "asian handicap": "Handicap",
  spreads: "Handicap",
  "both teams to score": "Both Teams To Score",
  btts: "Both Teams To Score",
  "both teams score": "Both Teams To Score",
};

export function canonicalMarketName(requested: string): string {
  const key = requested.trim().toLowerCase();
  return MARKET_CANONICAL[key] ?? requested.trim();
}

export function findCachedMarket(
  markets: BettingMarket[],
  requested: string,
): BettingMarket | undefined {
  const want = canonicalMarketName(requested).toLowerCase();
  return markets.find((m) => m.name.trim().toLowerCase() === want);
}

/** Normalize a UI label to the settlement label stored on the cached odd. */
export function normalizeSelectionLabel(
  requestedLabel: string,
  market: BettingMarket,
  match: Pick<Match, "home" | "away">,
): string {
  const raw = requestedLabel.trim();
  const lower = raw.toLowerCase();

  if (market.name === "Full Time Result" || market.id === 1) {
    if (lower === "1") return "1";
    if (lower === "2") return "2";
    if (lower === "x" || lower === "draw") return "X";
    if (match.home.name.trim().toLowerCase() === lower) return "1";
    if (match.away.name.trim().toLowerCase() === lower) return "2";
  }

  // "OVER 2.5" / "UNDER 2.5" → match Over/Under with extra
  const ou = /^(over|under)\s+([\d.]+)$/i.exec(raw);
  if (ou && (market.name === "Over/Under" || market.id === 3)) {
    const side = ou[1].toLowerCase() === "over" ? "Over" : "Under";
    const line = ou[2];
    const hit = market.odds.find(
      (o) => o.label.trim().toLowerCase() === side.toLowerCase() && (o.extra ?? "") === line,
    );
    if (hit) return hit.extra ? `${hit.label} ${hit.extra}` : hit.label;
  }

  return raw;
}

export function findCachedOdd(
  market: BettingMarket,
  requestedLabel: string,
  match: Pick<Match, "home" | "away">,
) {
  const normalized = normalizeSelectionLabel(requestedLabel, market, match);
  const want = normalized.trim().toLowerCase();
  return market.odds.find((o) => {
    const base = o.label.trim().toLowerCase();
    const withExtra = `${o.label} ${o.extra ?? ""}`.trim().toLowerCase();
    return base === want || withExtra === want;
  });
}
