"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icon";
import { LoadingDots } from "@/components/loading-dots";

// Server-driven binary auto-trader UI. Self-contained: it owns its own config,
// starts/stops a session, and polls /api/binary/auto/status for live progress.
// Engine + settlement live server-side (lib/auto-trade-engine), so this keeps
// running with the tab closed — the UI just reflects state.

const MARKETS = ["R_10", "R_25", "R_50", "R_75", "R_100", "JD10"];
const SIDES = [
  { id: "Even", label: "Even", needsDigit: false },
  { id: "Odd", label: "Odd", needsDigit: false },
  { id: "Over", label: "Over", needsDigit: true },
  { id: "Under", label: "Under", needsDigit: true },
  { id: "Matches", label: "Matches", needsDigit: true },
  { id: "Differs", label: "Differs", needsDigit: true },
] as const;
const STRATEGIES = [
  { id: "FIXED", label: "Fixed", hint: "Same stake every trade" },
  { id: "MARTINGALE", label: "Martingale", hint: "Multiply stake after a loss" },
  { id: "DALEMBERT", label: "D'Alembert", hint: "+1 unit on loss, −1 on win" },
  { id: "OSCARS", label: "Oscar's Grind", hint: "Raise only after a win" },
] as const;

interface SessionStatus {
  id: string;
  status: "RUNNING" | "STOPPED" | "DONE_TP" | "DONE_SL" | "DONE_RUNS" | "ERROR";
  stopReason: string | null;
  market: string; side: string; strategy: string;
  baseStake: number; currentStake: number;
  takeProfit: number; stopLoss: number; maxRuns: number;
  runsDone: number; wins: number; losses: number; totalPnl: number;
}
interface TradeRow {
  id: string; stake: number; payout: number; side: string;
  status: "PENDING" | "WON" | "LOST" | "VOID"; entryDigit: number; exitDigit: number | null;
}

const STATUS_LABEL: Record<SessionStatus["status"], string> = {
  RUNNING: "Running", STOPPED: "Stopped", DONE_TP: "Take-profit hit",
  DONE_SL: "Stop-loss hit", DONE_RUNS: "Max runs reached", ERROR: "Halted",
};

export function AutoPanel({ currency }: { currency: string }) {
  // config
  const [market, setMarket] = useState("R_100");
  const [side, setSide] = useState<string>("Even");
  const [targetDigit, setTargetDigit] = useState(5);
  const [duration, setDuration] = useState(5);
  const [strategy, setStrategy] = useState<string>("FIXED");
  const [baseStake, setBaseStake] = useState(10);
  const [multiplier, setMultiplier] = useState(2);
  const [takeProfit, setTakeProfit] = useState(100);
  const [stopLoss, setStopLoss] = useState(100);
  const [maxRuns, setMaxRuns] = useState(20);

  const [session, setSession] = useState<SessionStatus | null>(null);
  const [trades, setTrades] = useState<TradeRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const needsDigit = SIDES.find((s) => s.id === side)?.needsDigit ?? false;
  const running = session?.status === "RUNNING";

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/binary/auto/status", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setSession(data.session);
      setTrades(data.trades ?? []);
    } catch { /* transient */ }
  }, []);

  // Poll while a session is RUNNING (and once on mount).
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    if (running) {
      timer.current = setInterval(refresh, 2500);
      return () => { if (timer.current) clearInterval(timer.current); };
    }
  }, [running, refresh]);

  async function start() {
    setError(""); setBusy(true);
    try {
      const res = await fetch("/api/binary/auto/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          market, side, targetDigit: needsDigit ? targetDigit : 0,
          durationTicks: duration, strategy, baseStake, multiplier,
          takeProfit, stopLoss, maxRuns,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Could not start"); return; }
      await refresh();
    } catch { setError("Network error"); }
    finally { setBusy(false); }
  }

  async function stop() {
    setBusy(true);
    try { await fetch("/api/binary/auto/stop", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }); await refresh(); }
    finally { setBusy(false); }
  }

  const fmt = (v: number) => `${currency} ${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // ── Running view ────────────────────────────────────────────────────────────
  if (session && session.status !== "STOPPED" && (running || session.runsDone > 0)) {
    const pnlPos = session.totalPnl >= 0;
    return (
      <div className="flex flex-col gap-3 p-3">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-[13px] font-black text-white">
            <Icon name="smart_toy" className="text-[16px] text-[#087cff]" />
            Auto-Trader
          </span>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${running ? "bg-[#05b957]/15 text-[#05b957]" : "bg-white/[0.08] text-slate-300"}`}>
            {STATUS_LABEL[session.status]}
          </span>
        </div>

        <div className="rounded-2xl bg-[#16171d] p-4 ring-1 ring-white/[0.07]">
          <div className="flex items-end justify-between">
            <span className="text-xs font-bold text-slate-500">Net P&amp;L</span>
            <span className={`text-2xl font-black ${pnlPos ? "text-[#05b957]" : "text-red-400"}`}>
              {pnlPos ? "+" : ""}{fmt(session.totalPnl)}
            </span>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <Stat label="Runs" value={`${session.runsDone}/${session.maxRuns}`} />
            <Stat label="Wins" value={String(session.wins)} accent="text-[#05b957]" />
            <Stat label="Losses" value={String(session.losses)} accent="text-red-400" />
          </div>
          <div className="mt-3 flex justify-between text-[11px] font-bold text-slate-500">
            <span>{session.market} · {session.side} · {session.strategy}</span>
            <span>Next stake {fmt(session.currentStake)}</span>
          </div>
          <div className="mt-1 flex justify-between text-[11px] font-bold text-slate-600">
            <span>TP {fmt(session.takeProfit)}</span>
            <span>SL {fmt(session.stopLoss)}</span>
          </div>
        </div>

        {running ? (
          <button type="button" onClick={stop} disabled={busy}
            className="w-full rounded-2xl bg-red-500/90 py-3 text-sm font-black text-white transition hover:bg-red-500 active:scale-[.98] disabled:opacity-50">
            {busy ? <LoadingDots label="Stopping" /> : "Stop auto-trader"}
          </button>
        ) : (
          <div className="rounded-xl bg-white/[0.04] px-3 py-2 text-center text-[11px] font-bold text-slate-400">
            Session ended — {session.stopReason ?? STATUS_LABEL[session.status]}.
            <button type="button" onClick={() => { setSession(null); setTrades([]); }} className="ml-1 text-[#087cff] hover:underline">New session</button>
          </div>
        )}

        {trades.length > 0 && (
          <div className="rounded-2xl bg-[#16171d]/60 ring-1 ring-white/[0.05]">
            <p className="px-3 pt-2 text-[10px] font-black uppercase tracking-[0.15em] text-slate-600">Run log</p>
            <div className="max-h-44 overflow-y-auto px-3 pb-2">
              {trades.map((t) => (
                <div key={t.id} className="flex items-center justify-between border-b border-white/[0.04] py-1.5 text-[11px] font-bold last:border-0">
                  <span className="text-slate-400">{t.side} · {fmt(t.stake)}</span>
                  <span className={
                    t.status === "WON" ? "text-[#05b957]" :
                    t.status === "LOST" ? "text-red-400" :
                    t.status === "VOID" ? "text-slate-500" : "text-amber-400"
                  }>
                    {t.status === "WON" ? `+${fmt(t.payout - t.stake)}` :
                     t.status === "LOST" ? `−${fmt(t.stake)}` :
                     t.status === "VOID" ? "refunded" : "settling…"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Config view ─────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-3 p-3">
      <span className="flex items-center gap-1.5 text-[13px] font-black text-white">
        <Icon name="smart_toy" className="text-[16px] text-[#087cff]" />
        Auto-Trader
      </span>
      <p className="-mt-1 text-[11px] font-bold text-slate-500">
        Set a strategy and let it trade for you. Runs server-side — it keeps going if you close the tab.
      </p>

      <Field label="Market">
        <select value={market} onChange={(e) => setMarket(e.target.value)} className={selectCls}>
          {MARKETS.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      </Field>

      <Field label="Contract">
        <select value={side} onChange={(e) => setSide(e.target.value)} className={selectCls}>
          {SIDES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
      </Field>

      {needsDigit && (
        <Field label="Target digit (0–9)">
          <input type="number" min={0} max={9} value={targetDigit}
            onChange={(e) => setTargetDigit(Math.max(0, Math.min(9, Number(e.target.value))))} className={inputCls} />
        </Field>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Field label="Duration (ticks)">
          <input type="number" min={1} max={30} value={duration} onChange={(e) => setDuration(Math.max(1, Math.min(30, Number(e.target.value))))} className={inputCls} />
        </Field>
        <Field label="Base stake">
          <input type="number" min={10} value={baseStake} onChange={(e) => setBaseStake(Number(e.target.value))} className={inputCls} />
        </Field>
      </div>

      <Field label="Strategy">
        <div className="grid grid-cols-2 gap-1.5">
          {STRATEGIES.map((s) => (
            <button key={s.id} type="button" onClick={() => setStrategy(s.id)} title={s.hint}
              className={`rounded-xl px-2 py-2 text-[11px] font-black ring-1 transition ${strategy === s.id ? "bg-[#087cff] text-white ring-[#087cff]" : "bg-white/[0.04] text-slate-300 ring-white/[0.07] hover:bg-white/[0.07]"}`}>
              {s.label}
            </button>
          ))}
        </div>
      </Field>

      {strategy === "MARTINGALE" && (
        <Field label="Loss multiplier (1.1–5)">
          <input type="number" min={1.1} max={5} step={0.1} value={multiplier} onChange={(e) => setMultiplier(Number(e.target.value))} className={inputCls} />
        </Field>
      )}

      <div className="grid grid-cols-3 gap-2">
        <Field label="Take profit"><input type="number" min={1} value={takeProfit} onChange={(e) => setTakeProfit(Number(e.target.value))} className={inputCls} /></Field>
        <Field label="Stop loss"><input type="number" min={1} value={stopLoss} onChange={(e) => setStopLoss(Number(e.target.value))} className={inputCls} /></Field>
        <Field label="Max runs"><input type="number" min={1} max={500} value={maxRuns} onChange={(e) => setMaxRuns(Number(e.target.value))} className={inputCls} /></Field>
      </div>

      {error && (
        <p className="flex items-center gap-1.5 text-[11px] font-bold text-red-400">
          <Icon name="error" className="text-[13px]" /> {error}
        </p>
      )}

      <button type="button" onClick={start} disabled={busy}
        className="w-full rounded-2xl bg-[#087cff] py-3.5 text-sm font-black text-white shadow-lg shadow-blue-500/20 transition hover:bg-[#2a90ff] active:scale-[.98] disabled:opacity-50">
        {busy ? <LoadingDots label="Starting" /> : "Run auto-trader"}
      </button>
      <p className="text-center text-[10px] font-bold text-slate-600">
        Stop-loss is required. The engine stops automatically at TP, SL, or max runs.
      </p>
    </div>
  );
}

const selectCls = "h-11 w-full rounded-xl bg-[#16171d] px-3 text-sm font-bold text-white outline-none ring-1 ring-white/[0.07] focus:ring-[#087cff]/40";
const inputCls = "h-11 w-full rounded-xl bg-[#16171d] px-3 text-sm font-black text-white outline-none ring-1 ring-white/[0.07] focus:ring-[#087cff]/40";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-[10px] font-black uppercase tracking-[0.12em] text-slate-600">{label}</p>
      {children}
    </div>
  );
}
function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-xl bg-white/[0.04] py-2">
      <p className="text-[9px] font-black uppercase tracking-wider text-slate-600">{label}</p>
      <p className={`text-sm font-black ${accent ?? "text-white"}`}>{value}</p>
    </div>
  );
}
