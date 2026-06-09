/**
 * TheSportsDB settlement source.
 *
 * The Odds API is great for ODDS but its /scores feed is thin and often misses
 * or fails to mark finished games (confirmed 2026-06-09: NBA/NHL games absent,
 * Gold Cup unavailable, NRL stuck completed=false). TheSportsDB — free, no
 * credits, 30 req/min — reliably has those results.
 *
 * Given a bet's "Home vs Away" name pair, this looks up the finished game and
 * returns scores mapped to the BET's home/away (their home/away order can
 * differ from ours), so lib/settle-bet.ts resolves it unchanged.
 */
import { BLANK_DETAIL, type Match, type MatchDetail } from "@/lib/theoddsapi";

const KEY = process.env.THESPORTSDB_KEY ?? "3"; // free tier
const V1 = `https://www.thesportsdb.com/api/v1/json/${KEY}`;

const FINISHED = new Set(["FT", "AET", "AOT", "PEN", "MATCH FINISHED", "FINISHED", "FT/AET"]);

function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b(fc|sc|afc|cf|club|de|the)\b/g, " ")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Token-overlap similarity in [0,1]; 1 when one name's tokens are a subset of
// the other (handles "Vegas Golden Knights" vs "Las Vegas Golden Knights").
function similarity(a: string, b: string): number {
  const ta = new Set(norm(a).split(" ").filter(Boolean));
  const tb = new Set(norm(b).split(" ").filter(Boolean));
  if (ta.size === 0 || tb.size === 0) return 0;
  let shared = 0;
  for (const t of ta) if (tb.has(t)) shared++;
  return shared / Math.min(ta.size, tb.size);
}

interface SdbTeam { idTeam: string; strTeam: string; strSport: string }
interface SdbEvent {
  idEvent: string; strEvent: string; strSport: string;
  strHomeTeam: string; strAwayTeam: string;
  intHomeScore: string | null; intAwayScore: string | null;
  dateEvent: string; strStatus: string | null;
}

async function jget<T>(path: string): Promise<T | null> {
  try {
    const r = await fetch(`${V1}/${path}`, { next: { revalidate: 300 } });
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch {
    return null;
  }
}

function isFinished(ev: SdbEvent): boolean {
  const hasScores = ev.intHomeScore !== null && ev.intAwayScore !== null && ev.intHomeScore !== "" && ev.intAwayScore !== "";
  const status = (ev.strStatus ?? "").trim().toUpperCase();
  if (!hasScores) return false;
  if (FINISHED.has(status)) return true;
  // Some events carry scores with an empty/odd status; accept if the game date
  // is clearly in the past (yesterday or earlier).
  const d = new Date(ev.dateEvent).getTime();
  return Number.isFinite(d) && d < Date.now() - 12 * 60 * 60 * 1000;
}

/**
 * Resolve a finished game by team names. Returns a MatchDetail whose
 * home/away scores are aligned to the passed homeName/awayName, plus stateId
 * (5 = finished). Returns null if not found or not finished.
 */
export async function getThesportsdbResult(
  homeName: string,
  awayName: string,
  targetDate?: Date,
): Promise<{ detail: MatchDetail; stateId: number } | null> {
  // 1. Find the home team and its recent events.
  const search = await jget<{ teams: SdbTeam[] | null }>(`searchteams.php?t=${encodeURIComponent(homeName)}`);
  const teams = search?.teams ?? [];
  if (teams.length === 0) return null;

  const team = teams
    .map((t) => ({ t, s: similarity(t.strTeam, homeName) }))
    .sort((a, b) => b.s - a.s)[0];
  if (!team || team.s < 0.5) return null;

  const last = await jget<{ results: SdbEvent[] | null }>(`eventslast.php?id=${team.t.idTeam}`);
  const events = last?.results ?? [];
  if (events.length === 0) return null;

  // 2. Among finished events whose other side matches the away team, pick the
  //    one nearest the bet's placement date. Teams in a playoff series meet
  //    repeatedly, so name alone is not enough — without a date anchor we could
  //    settle the wrong game. Require the match within ±5 days of the bet.
  const WINDOW = 5 * 24 * 60 * 60 * 1000;
  const candidates = events
    .map((e) => ({ e, opp: Math.max(similarity(e.strAwayTeam, awayName), similarity(e.strHomeTeam, awayName)) }))
    .filter((x) => x.opp >= 0.5 && isFinished(x.e));
  if (candidates.length === 0) return null;

  let ev: SdbEvent | undefined;
  if (targetDate) {
    const tgt = targetDate.getTime();
    const within = candidates.filter((x) => Math.abs(new Date(x.e.dateEvent).getTime() - tgt) <= WINDOW);
    if (within.length === 0) return null; // no game near the bet date — don't risk the wrong one
    ev = within.sort((a, b) => Math.abs(new Date(a.e.dateEvent).getTime() - tgt) - Math.abs(new Date(b.e.dateEvent).getTime() - tgt))[0].e;
  } else {
    ev = candidates.sort((a, b) => b.opp - a.opp)[0].e;
  }
  if (!ev) return null;

  // 3. Map scores to the BET's home/away by name (their order may differ).
  const sdbHomeIsBetHome = similarity(ev.strHomeTeam, homeName) >= similarity(ev.strAwayTeam, homeName);
  const betHomeScore = Number(sdbHomeIsBetHome ? ev.intHomeScore : ev.intAwayScore);
  const betAwayScore = Number(sdbHomeIsBetHome ? ev.intAwayScore : ev.intHomeScore);
  if (!Number.isFinite(betHomeScore) || !Number.isFinite(betAwayScore)) return null;

  const match: Match = {
    id: 0,
    eventId: `sdb_${ev.idEvent}`,
    sportKey: `thesportsdb_${ev.strSport}`,
    league: ev.strSport,
    country: "",
    home: { name: homeName, score: betHomeScore },
    away: { name: awayName, score: betAwayScore },
    period: "FT",
    isLive: false,
    startingAt: ev.dateEvent,
    odds: [],
    extraMarkets: 0,
  };
  return { detail: { match, stateId: 5, ...BLANK_DETAIL, markets: [] }, stateId: 5 };
}

// Parse a stored "Home vs Away" match name into the two team names.
export function parseMatchName(matchName: string): { home: string; away: string } | null {
  const m = matchName.split(/\s+vs\.?\s+/i);
  if (m.length !== 2) return null;
  return { home: m[0].trim(), away: m[1].trim() };
}
