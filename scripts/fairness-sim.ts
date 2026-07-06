// ─────────────────────────────────────────────────────────────────────────────
// LIVE FAIRNESS AUDIT  —  run:  bunx tsx scripts/fairness-sim.ts
//
// Read-only. Pulls live Deriv ticks for every synthetic symbol and runs the
// REAL pricing code against the REAL settlement kernel to report which live
// contracts are +EV for players (RTP > 100% = exploitable). This is the manual
// counterpart to tests/fairness.test.ts: the test proves the *architecture* on a
// synthetic market; this script audits the *current live* pricing on real data.
//
// No DB, no writes, no auth — just Deriv's public tick feed.
// ─────────────────────────────────────────────────────────────────────────────

import { quoteToDigit } from "neemiz-binary-engine";
import { payoutRate as dirRate, touchProbability } from "@/lib/directional";
import { digitDistribution } from "@/lib/binary/fairness";

const SYMBOLS = ["1HZ10V", "1HZ25V", "1HZ50V", "1HZ75V", "1HZ100V", "R_10", "R_25", "R_50", "R_75", "R_100", "JD10"];
const COUNT = 5000;

function fetchTicks(sym: string): Promise<number[]> {
  return new Promise((resolve) => {
    const ws = new WebSocket("wss://ws.derivws.com/websockets/v3?app_id=1089");
    const to = setTimeout(() => { try { ws.close(); } catch {} resolve([]); }, 12000);
    ws.onopen = () => ws.send(JSON.stringify({ ticks_history: sym, count: COUNT, end: "latest", style: "ticks" }));
    ws.onmessage = (e: MessageEvent) => {
      const d = JSON.parse(String(e.data));
      if (d.history) { clearTimeout(to); ws.close(); resolve(d.history.prices.map(Number)); }
      if (d.error)   { clearTimeout(to); ws.close(); resolve([]); }
    };
    ws.onerror = () => { clearTimeout(to); resolve([]); };
  });
}

const pct = (x: number) => (x * 100).toFixed(1) + "%";
const edge = (rtp: number) => ((rtp - 1) * 100).toFixed(1) + "%";

type Row = { sym: string; contract: string; rtp: number };

function auditDigits(sym: string, prices: number[]): Row {
  const p = digitDistribution(prices, quoteToDigit);
  const rows: Row[] = [];
  const pEven = p.filter((_, i) => i % 2 === 0).reduce((a, b) => a + b, 0);
  rows.push({ sym, contract: "Even", rtp: pEven * 1.9 });
  rows.push({ sym, contract: "Odd", rtp: (1 - pEven) * 1.9 });
  for (let t = 0; t < 10; t++) {
    rows.push({ sym, contract: `Matches ${t}`, rtp: p[t] * 9.15 });
    rows.push({ sym, contract: `Differs ${t}`, rtp: (1 - p[t]) * 1.05 });
  }
  for (let t = 0; t <= 8; t++) { const w = 9 - t; const r = Math.floor((9.5 / w) * 100) / 100; rows.push({ sym, contract: `Over ${t}`, rtp: p.slice(t + 1).reduce((a, b) => a + b, 0) * r }); }
  for (let t = 1; t <= 9; t++) { const r = Math.floor((9.5 / t) * 100) / 100; rows.push({ sym, contract: `Under ${t}`, rtp: p.slice(0, t).reduce((a, b) => a + b, 0) * r }); }
  return rows.reduce((a, b) => (b.rtp > a.rtp ? b : a));
}

function sigmaTick(prices: number[]): number {
  const r: number[] = [];
  for (let i = 1; i < prices.length; i++) r.push(Math.log(prices[i] / prices[i - 1]));
  const m = r.reduce((a, b) => a + b, 0) / r.length;
  return Math.sqrt(r.reduce((a, b) => a + (b - m) * (b - m), 0) / r.length);
}

// Directional audit: compare the priced win prob against the empirical win rate
// from real forward paths (the discrete/continuous gap shows up here).
function auditDirectional(sym: string, prices: number[]): Row {
  const sig = sigmaTick(prices);
  let worst: Row = { sym, contract: "-", rtp: 0 };
  for (const dur of [5, 10]) {
    for (const off of [0.5, 1, 2]) {
      const barMul = off * sig * Math.sqrt(dur);
      for (const side of ["TOUCH", "NO_TOUCH"] as const) {
        const barrier = side === "TOUCH" ? 1 + barMul : 1 + barMul; // up-barrier
        let wins = 0, n = 0;
        for (let i = 0; i + dur < prices.length; i += 3) {
          const entry = prices[i];
          const bar = entry * (1 + barMul);
          const up = bar > entry;
          let touched = false;
          for (let k = 1; k <= dur; k++) { const pr = prices[i + k]; if (up ? pr >= bar : pr <= bar) { touched = true; break; } }
          if (side === "TOUCH" ? touched : !touched) wins++;
          n++;
        }
        if (n < 50) continue;
        const empP = wins / n;
        const rate = dirRate({ kind: "TOUCH_NO_TOUCH", side, entrySpot: 1, barrier, sigmaTick: sig, durationTicks: dur });
        const netMult = rate > 1 ? 1 + (rate - 1) * 0.7 : rate; // 30% profit retention
        const rtp = empP * netMult;
        if (rtp > worst.rtp) worst = { sym, contract: `NO/TOUCH ${side} d${dur} ${off}σ`, rtp };
      }
    }
  }
  return worst;
}

async function main() {
  const digitWorst: Row[] = [];
  const dirWorst: Row[] = [];
  for (const sym of SYMBOLS) {
    const prices = await fetchTicks(sym);
    if (prices.length < 500) { console.log(`${sym}: FETCH FAILED`); continue; }
    const dg = auditDigits(sym, prices);
    const dr = auditDirectional(sym, prices);
    digitWorst.push(dg);
    dirWorst.push(dr);
    console.log(`${sym.padEnd(8)} digit worst ${dg.contract.padEnd(12)} RTP ${pct(dg.rtp).padStart(7)}  |  directional worst ${dr.contract.padEnd(22)} RTP ${pct(dr.rtp).padStart(7)}`);
  }

  console.log("\n===== EXPLOITABLE (player +EV) =====");
  for (const w of [...digitWorst, ...dirWorst].filter((w) => w.rtp > 1).sort((a, b) => b.rtp - a.rtp)) {
    console.log(`  ${w.sym.padEnd(8)} ${w.contract.padEnd(24)} RTP ${pct(w.rtp).padStart(7)}  player edge ${edge(w.rtp)}`);
  }
  console.log("\nNote: a contract priced via estimateWinProb (Monte-Carlo of the kernel)");
  console.log("would show RTP ≤ 100% here — see tests/fairness.test.ts for the invariant.");
}

main();
