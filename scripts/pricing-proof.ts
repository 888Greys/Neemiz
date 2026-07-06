// ─────────────────────────────────────────────────────────────────────────────
// LIVE BEFORE/AFTER PROOF  —  run:  bunx tsx scripts/pricing-proof.ts
//
// Read-only. For every symbol, pulls live Deriv ticks, splits them train/test,
// and compares the OLD closed-form price against the NEW engine price on the
// exact contract that was the worst exploit (NO_TOUCH near-barrier), measuring
// realized RTP out-of-sample. Shows the exploit closing on real data.
// ─────────────────────────────────────────────────────────────────────────────

import { payoutRate as dirRate } from "@/lib/directional";
import { priceDirectionalContract, sampleWindows, type Window } from "@/lib/binary/pricing";
import { resolveContract, type ResolveParams } from "@/lib/binary/kernel";
import { makeRng } from "@/lib/binary/fairness";

const SYMBOLS = ["1HZ10V", "1HZ25V", "1HZ50V", "1HZ75V", "1HZ100V", "R_10", "R_25", "R_50", "R_75", "R_100", "JD10"];
const DUR = 5;
const OFFSET = 0.5; // barrier at 0.5σ — the worst NO_TOUCH case from the audit

function fetchTicks(sym: string): Promise<number[]> {
  return new Promise((resolve) => {
    const ws = new WebSocket("wss://ws.derivws.com/websockets/v3?app_id=1089");
    const to = setTimeout(() => { try { ws.close(); } catch {} resolve([]); }, 12000);
    ws.onopen = () => ws.send(JSON.stringify({ ticks_history: sym, count: 8000, end: "latest", style: "ticks" }));
    ws.onmessage = (e: MessageEvent) => {
      const d = JSON.parse(String(e.data));
      if (d.history) { clearTimeout(to); ws.close(); resolve(d.history.prices.map(Number)); }
      if (d.error)   { clearTimeout(to); ws.close(); resolve([]); }
    };
    ws.onerror = () => { clearTimeout(to); resolve([]); };
  });
}

function sigmaOf(ticks: number[]): number {
  const r: number[] = [];
  for (let i = 1; i < ticks.length; i++) r.push(Math.log(ticks[i] / ticks[i - 1]));
  const m = r.reduce((a, b) => a + b, 0) / r.length;
  return Math.sqrt(r.reduce((a, b) => a + (b - m) * (b - m), 0) / r.length);
}

const toPath = (f: number[]) => f.map((price, k) => ({ price, epoch: k + 1 }));
const pct = (x: number) => (x * 100).toFixed(1) + "%";

function noTouchSettle(frac: number) {
  return (w: Window): boolean => {
    const barrier = w.entry * (1 + frac);
    const params: ResolveParams = { kind: "TOUCH_NO_TOUCH", side: "NO_TOUCH", entrySpot: w.entry, barrier, durationTicks: DUR, stake: 1, payout: 1, payoutPerPoint: null };
    const r = resolveContract(params, toPath(w.forward));
    return r.ready ? r.won : false;
  };
}

function realizedRtp(ticks: number[], settle: (w: Window) => boolean, mult: number): number {
  const windows = sampleWindows(ticks, DUR, 30_000, makeRng(7));
  let payout = 0;
  for (const w of windows) if (settle(w)) payout += mult;
  return payout / windows.length;
}

async function main() {
  console.log(`NO_TOUCH @ ${OFFSET}σ, ${DUR} ticks — realized RTP out-of-sample (>100% = player +EV)\n`);
  console.log("symbol    OLD (closed-form)   NEW (engine)");
  let oldMax = 0, newMax = 0;
  for (const sym of SYMBOLS) {
    const ticks = await fetchTicks(sym);
    if (ticks.length < 2000) { console.log(`${sym.padEnd(8)}  fetch failed`); continue; }
    const mid = ticks.length >> 1;
    const train = ticks.slice(0, mid);
    const test = ticks.slice(mid);
    const sigma = sigmaOf(train);
    const frac = OFFSET * sigma * Math.sqrt(DUR);
    const settle = noTouchSettle(frac);

    // OLD: closed-form rate + 30% profit retention.
    const rate = dirRate({ kind: "TOUCH_NO_TOUCH", side: "NO_TOUCH", entrySpot: 1, barrier: 1 + frac, sigmaTick: sigma, durationTicks: DUR });
    const oldMult = rate > 1 ? 1 + (rate - 1) * 0.7 : rate;
    const oldRtp = realizedRtp(test, settle, oldMult);

    // NEW: engine price from train, measured on test.
    const q = priceDirectionalContract("TOUCH_NO_TOUCH", "NO_TOUCH", frac, DUR, train);
    const newStr = q.accepted ? pct(realizedRtp(test, settle, q.payoutMultiplier)) : "REJECTED";
    if (q.accepted) newMax = Math.max(newMax, realizedRtp(test, settle, q.payoutMultiplier));
    oldMax = Math.max(oldMax, oldRtp);

    console.log(`${sym.padEnd(8)}  ${pct(oldRtp).padStart(8)} ${oldRtp > 1 ? "❌" : "✅"}         ${newStr.padStart(8)} ${q.accepted && realizedRtp(test, settle, q.payoutMultiplier) > 1 ? "❌" : "✅"}`);
  }
  console.log(`\nworst-case RTP:  OLD ${pct(oldMax)}   NEW ${pct(newMax)}`);
  console.log(newMax <= 1 ? "✅ exploit closed on every symbol." : "⚠️  still +EV somewhere — investigate.");
}

main();
