/**
 * Sports settlement simulation harness.
 *
 * Drives the REAL pure settlement logic (lib/settle-bet.ts + lib/house-retention.ts)
 * against synthetic "finished" fixtures — no Odds API, no database, no dev server.
 *
 * Purpose:
 *   1. Verify every market resolves correctly (1X2, BTTS, Double Chance, Draw No Bet).
 *   2. Verify SINGLE / MULTI outcome aggregation and payout + 30% profit retention.
 *   3. Reproduce the end-to-end settle decision the cron route makes, so we can
 *      tell whether the settlement *logic* is sound vs. the live feed simply never
 *      reporting fixtures as finished (stateId 5).
 *
 * Run:  npx tsx scripts/simulate-settlement.ts
 */
import {
  resolveSelection,
  determineBetOutcome,
  calculateWinAmount,
  type SelectionOutcome,
} from "../lib/settle-bet";
import { applyProfitRetention, retainedProfit } from "../lib/house-retention";
import type { MatchDetail } from "../lib/theoddsapi";

const FINISHED_STATE_IDS = new Set([5]); // mirrors lib/theoddsapi.ts
const VOID_STATE_IDS = new Set([13, 17]); // Abandoned, Cancelled

// ── tiny test framework ───────────────────────────────────────────────────
let passed = 0;
let failed = 0;
const failures: string[] = [];

function check(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    passed++;
  } else {
    failed++;
    failures.push(`  ✗ ${name}\n      expected ${e}\n      got      ${a}`);
  }
}

// Build a minimal MatchDetail with a given scoreline. Only fields the
// resolvers read (match.home.score / match.away.score) need to be real.
function fixture(home: number, away: number, stateId = 5): { detail: MatchDetail; stateId: number } {
  const detail = {
    match: {
      home: { name: "Home", score: home },
      away: { name: "Away", score: away },
    },
  } as unknown as MatchDetail;
  return { detail, stateId };
}

// ── 1. Market resolution ──────────────────────────────────────────────────
console.log("── Market resolution ──");

// 1X2 — home 2-1 away
{
  const fx = fixture(2, 1);
  check("1X2 home win, label 1", resolveSelection({ market: "1X2", label: "1" }, fx.detail, fx.stateId), "WON");
  check("1X2 home win, label X", resolveSelection({ market: "1X2", label: "X" }, fx.detail, fx.stateId), "LOST");
  check("1X2 home win, label 2", resolveSelection({ market: "1X2", label: "2" }, fx.detail, fx.stateId), "LOST");
  check("1X2 label 'home' alias", resolveSelection({ market: "Full Time Result", label: "home" }, fx.detail, fx.stateId), "WON");
}
// 1X2 — draw 1-1
{
  const fx = fixture(1, 1);
  check("1X2 draw, label X", resolveSelection({ market: "Match Winner", label: "X" }, fx.detail, fx.stateId), "WON");
  check("1X2 draw, label 1", resolveSelection({ market: "Match Winner", label: "1" }, fx.detail, fx.stateId), "LOST");
}
// 1X2 — away win 0-2
{
  const fx = fixture(0, 2);
  check("1X2 away win, label 2", resolveSelection({ market: "fulltime result", label: "away" }, fx.detail, fx.stateId), "WON");
}

// BTTS
{
  const both = fixture(2, 1);
  const one = fixture(2, 0);
  check("BTTS yes when both score", resolveSelection({ market: "BTTS", label: "Yes" }, both.detail, both.stateId), "WON");
  check("BTTS no when both score", resolveSelection({ market: "Both Teams To Score", label: "No" }, both.detail, both.stateId), "LOST");
  check("BTTS yes when one scores", resolveSelection({ market: "btts", label: "yes" }, one.detail, one.stateId), "LOST");
  check("BTTS no when one scores", resolveSelection({ market: "btts", label: "no" }, one.detail, one.stateId), "WON");
}

// Double Chance
{
  const homeWin = fixture(3, 1);
  const draw = fixture(1, 1);
  const awayWin = fixture(0, 2);
  check("DC 1X on home win", resolveSelection({ market: "Double Chance", label: "1X" }, homeWin.detail, homeWin.stateId), "WON");
  check("DC 1X on draw", resolveSelection({ market: "Double Chance", label: "1X" }, draw.detail, draw.stateId), "WON");
  check("DC 1X on away win", resolveSelection({ market: "Double Chance", label: "1X" }, awayWin.detail, awayWin.stateId), "LOST");
  check("DC 12 on draw", resolveSelection({ market: "Double Chance", label: "12" }, draw.detail, draw.stateId), "LOST");
  check("DC X2 on away win", resolveSelection({ market: "Double Chance", label: "X2" }, awayWin.detail, awayWin.stateId), "WON");
}

// Draw No Bet
{
  const homeWin = fixture(2, 0);
  const draw = fixture(1, 1);
  check("DNB home on home win", resolveSelection({ market: "Draw No Bet", label: "1" }, homeWin.detail, homeWin.stateId), "WON");
  check("DNB home on draw → VOID", resolveSelection({ market: "Draw No Bet", label: "1" }, draw.detail, draw.stateId), "VOID");
  check("DNB away on home win", resolveSelection({ market: "Draw No Bet", label: "2" }, homeWin.detail, homeWin.stateId), "LOST");
}

// State-driven voids + unknown markets
{
  const fx = fixture(2, 1, 13); // abandoned
  check("Abandoned state → VOID", resolveSelection({ market: "1X2", label: "1" }, fx.detail, fx.stateId), "VOID");
  const cancelled = fixture(2, 1, 17);
  check("Cancelled state → VOID", resolveSelection({ market: "1X2", label: "1" }, cancelled.detail, cancelled.stateId), "VOID");
  const unknown = fixture(2, 1, 5);
  check("Unknown market → VOID", resolveSelection({ market: "Corners Over 9.5", label: "Over" }, unknown.detail, unknown.stateId), "VOID");
}

// ── 2. Bet outcome aggregation ────────────────────────────────────────────
console.log("── Bet outcome aggregation ──");
check("MULTI any LOST → LOST", determineBetOutcome(["WON", "LOST", "VOID"] as SelectionOutcome[]), "LOST");
check("MULTI all VOID → VOID", determineBetOutcome(["VOID", "VOID"] as SelectionOutcome[]), "VOID");
check("MULTI WON + VOID → WON", determineBetOutcome(["WON", "VOID"] as SelectionOutcome[]), "WON");
check("MULTI all WON → WON", determineBetOutcome(["WON", "WON"] as SelectionOutcome[]), "WON");

// ── 3. Payout + 30% profit retention ──────────────────────────────────────
console.log("── Payout & retention ──");
{
  // SINGLE: stake 100 @ 2.50 → gross 250
  const gross = calculateWinAmount(100, [2.5], ["WON"] as SelectionOutcome[], "SINGLE");
  check("SINGLE gross payout", gross, 250);
  // net = stake + 70% of profit = 100 + 0.7*150 = 205
  check("SINGLE net after retention", applyProfitRetention(100, gross), 205);
  check("SINGLE house retained", retainedProfit(100, gross), 45);
}
{
  // MULTI: stake 50, legs 1.5 (WON), 2.0 (WON), 3.0 (VOID) → 50 * 1.5 * 2.0 = 150
  const gross = calculateWinAmount(50, [1.5, 2.0, 3.0], ["WON", "WON", "VOID"] as SelectionOutcome[], "MULTI");
  check("MULTI gross (VOID leg neutral)", gross, 150);
  // net = 50 + 0.7*100 = 120
  check("MULTI net after retention", applyProfitRetention(50, gross), 120);
}

// ── 4. End-to-end settle decision (mirrors app/api/bets/settle/route.ts) ───
console.log("── End-to-end settle simulation ──");

interface SimSelection { market: string; label: string; odds: number; fixtureId: string }
interface SimBet { id: string; stake: number; betType: "SINGLE" | "MULTI"; selections: SimSelection[] }

// Synthetic finished-fixture feed keyed by fixtureId.
const feed = new Map<string, { detail: MatchDetail; stateId: number }>([
  ["fx-A", fixture(2, 1, 5)], // home win, both scored
  ["fx-B", fixture(0, 0, 5)], // goalless draw
  ["fx-C", fixture(1, 1, 2)], // STILL LIVE (stateId 2) — not finished
]);

function simulateSettle(bet: SimBet) {
  const finished = bet.selections.every((s) => {
    const fx = feed.get(s.fixtureId);
    return fx && FINISHED_STATE_IDS.has(fx.stateId);
  });
  if (!finished) return { id: bet.id, decision: "SKIP (fixture not finished)" as const };

  const outcomes = bet.selections.map((s) => {
    const fx = feed.get(s.fixtureId)!;
    return resolveSelection({ market: s.market, label: s.label }, fx.detail, fx.stateId);
  });
  const betOutcome = determineBetOutcome(outcomes);
  const gross = betOutcome === "WON"
    ? calculateWinAmount(bet.stake, bet.selections.map((s) => s.odds), outcomes, bet.betType)
    : 0;
  const net = gross > 0 ? applyProfitRetention(bet.stake, gross) : 0;
  const credited = betOutcome === "WON" ? net : betOutcome === "VOID" ? bet.stake : 0;
  return { id: bet.id, decision: betOutcome, legs: outcomes, gross, net, credited };
}

const sims: SimBet[] = [
  { id: "bet-1", stake: 100, betType: "SINGLE", selections: [{ market: "1X2", label: "1", odds: 1.8, fixtureId: "fx-A" }] },
  { id: "bet-2", stake: 100, betType: "SINGLE", selections: [{ market: "BTTS", label: "No", odds: 2.1, fixtureId: "fx-B" }] },
  { id: "bet-3", stake: 50, betType: "MULTI", selections: [
    { market: "1X2", label: "1", odds: 1.8, fixtureId: "fx-A" },
    { market: "Double Chance", label: "X2", odds: 1.4, fixtureId: "fx-B" },
  ] },
  { id: "bet-4", stake: 80, betType: "SINGLE", selections: [{ market: "1X2", label: "1", odds: 2.0, fixtureId: "fx-C" }] }, // live → skip
];

for (const b of sims) {
  const r = simulateSettle(b);
  console.log(`  ${r.id}: ${JSON.stringify(r)}`);
}

// Assertions on the simulated decisions
check("bet-1 SINGLE home win settles WON", simulateSettle(sims[0]).decision, "WON");
check("bet-1 credited net after retention", (simulateSettle(sims[0]) as any).credited, 156); // 100 + 0.7*(180-100)
check("bet-2 BTTS No on 0-0 settles WON", simulateSettle(sims[1]).decision, "WON");
check("bet-3 MULTI both legs win", simulateSettle(sims[2]).decision, "WON");
check("bet-4 live fixture is skipped", simulateSettle(sims[3]).decision, "SKIP (fixture not finished)");

// ── summary ────────────────────────────────────────────────────────────────
console.log(`\n${"─".repeat(50)}`);
console.log(`PASSED: ${passed}   FAILED: ${failed}`);
if (failures.length) {
  console.log("\nFAILURES:\n" + failures.join("\n"));
  process.exit(1);
}
console.log("All settlement simulations passed ✅");
