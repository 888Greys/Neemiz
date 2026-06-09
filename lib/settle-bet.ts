import type { MatchDetail } from "@/lib/theoddsapi";

export type SelectionOutcome = "WON" | "LOST" | "VOID";

const VOID_STATE_IDS = new Set([13, 17]); // Abandoned, Cancelled

function normaliseLabel(raw: string): string {
  const map: Record<string, string> = {
    home: "1", away: "2", draw: "X",
    "1": "1", "2": "2", x: "X",
  };
  return map[raw.toLowerCase()] ?? raw;
}

function resolve1X2(label: string, detail: MatchDetail): SelectionOutcome {
  const h = detail.match.home.score ?? 0;
  const a = detail.match.away.score ?? 0;
  const actual = h > a ? "1" : a > h ? "2" : "X";
  return normaliseLabel(label) === actual ? "WON" : "LOST";
}

function resolveBTTS(label: string, detail: MatchDetail): SelectionOutcome {
  const bothScored =
    (detail.match.home.score ?? 0) > 0 && (detail.match.away.score ?? 0) > 0;
  const norm = label.trim().toLowerCase();
  if (norm === "yes") return bothScored ? "WON" : "LOST";
  if (norm === "no") return !bothScored ? "WON" : "LOST";
  return "VOID";
}

function resolveDoubleChance(label: string, detail: MatchDetail): SelectionOutcome {
  const h = detail.match.home.score ?? 0;
  const a = detail.match.away.score ?? 0;
  const norm = label.trim().toLowerCase();
  if (norm === "1x") return a > h ? "LOST" : "WON";  // home win or draw
  if (norm === "12") return h === a ? "LOST" : "WON"; // either team wins
  if (norm === "x2") return h > a ? "LOST" : "WON";  // away win or draw
  return "VOID";
}

function resolveDrawNoBet(label: string, detail: MatchDetail): SelectionOutcome {
  const h = detail.match.home.score ?? 0;
  const a = detail.match.away.score ?? 0;
  if (h === a) return "VOID"; // draw → stake refunded
  const norm = normaliseLabel(label);
  if (norm === "1") return h > a ? "WON" : "LOST";
  if (norm === "2") return a > h ? "WON" : "LOST";
  return "VOID";
}

// Handicap / spread. Label is "<1|2> <signed line>", e.g. "1 -0.5", "2 +1".
// The line is added to the selected team's score; an exact tie on the adjusted
// line is a push (VOID → stake refunded).
function resolveHandicap(label: string, detail: MatchDetail): SelectionOutcome {
  const m = label.trim().match(/^([12])\s+([+-]?\d+(?:\.\d+)?)$/);
  if (!m) return "VOID";
  const team = m[1];
  const line = parseFloat(m[2]);
  if (!Number.isFinite(line)) return "VOID";
  const h = detail.match.home.score ?? 0;
  const a = detail.match.away.score ?? 0;
  // Margin of the selected team after applying its handicap line.
  const margin = team === "1" ? h + line - a : a + line - h;
  if (margin > 0) return "WON";
  if (margin < 0) return "LOST";
  return "VOID"; // push
}

export function resolveSelection(
  selection: { market: string; label: string },
  detail: MatchDetail,
  stateId: number,
): SelectionOutcome {
  if (VOID_STATE_IDS.has(stateId)) return "VOID";

  const market = selection.market.trim().toLowerCase();
  switch (market) {
    case "full time result":
    case "1x2":
    case "match winner":
    case "fulltime result":
      return resolve1X2(selection.label, detail);
    case "both teams to score":
    case "btts":
    case "both teams score":
      return resolveBTTS(selection.label, detail);
    case "double chance":
      return resolveDoubleChance(selection.label, detail);
    case "draw no bet":
      return resolveDrawNoBet(selection.label, detail);
    case "handicap":
    case "asian handicap":
    case "spread":
    case "spreads":
      return resolveHandicap(selection.label, detail);
    default:
      // Unknown market — void rather than wrongly settling as LOST
      return "VOID";
  }
}

export function determineBetOutcome(
  outcomes: SelectionOutcome[],
): "WON" | "LOST" | "VOID" {
  if (outcomes.some((o) => o === "LOST")) return "LOST";
  if (outcomes.every((o) => o === "VOID")) return "VOID";
  return "WON"; // at least one WON, rest VOID
}

export function calculateWinAmount(
  stake: number,
  selectionOdds: number[],
  outcomes: SelectionOutcome[],
  betType: "SINGLE" | "MULTI",
): number {
  if (betType === "SINGLE") {
    return stake * (selectionOdds[0] ?? 1);
  }
  // MULTI: multiply only WON legs; VOID legs contribute odds of 1 (neutral)
  const effectiveOdds = selectionOdds.reduce((acc, odds, i) => {
    return outcomes[i] === "WON" ? acc * odds : acc;
  }, 1);
  return stake * effectiveOdds;
}
