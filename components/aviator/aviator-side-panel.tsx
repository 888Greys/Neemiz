"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { MONEY_LOCALE } from "@/lib/currency";

// ─── Types ────────────────────────────────────────────────────────────────────

interface RecentWin {
  key:       string;
  username:  string | null;
  winAmount: number;
  cashoutAt: number;
  auto:      boolean;
  ts:        number;
}

interface HistoryRound {
  roundId:     string;
  roundNumber: number;
  crashPoint:  number;
}

type RoundState = "WAITING" | "BETTING" | "FLYING" | "CRASHED";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const GROWTH_RATE = 0.00006;

function cpHex(cp: number) {
  if (cp < 1.5) return "#ef4444";
  if (cp < 2)   return "#f97316";
  if (cp < 5)   return "#eab308";
  if (cp < 10)  return "#3b82f6";
  return              "#a855f7";
}

function cpTextCls(cp: number) {
  if (cp < 1.5) return "text-red-400";
  if (cp < 2)   return "text-orange-400";
  if (cp < 5)   return "text-yellow-400";
  if (cp < 10)  return "text-blue-400";
  return              "text-purple-400";
}

function avatarCls(name: string | null) {
  const cs = ["bg-violet-600","bg-blue-600","bg-green-600","bg-orange-500","bg-pink-600","bg-teal-600","bg-rose-600","bg-indigo-600"];
  return cs[((name ?? "?").charCodeAt(0)) % cs.length];
}

function fmtKsh(n: number) {
  return "KSh " + n.toLocaleString(MONEY_LOCALE, { maximumFractionDigits: 0 });
}

// ─── Live Status Card ─────────────────────────────────────────────────────────

function LiveStatusCard({
  state,
  roundNumber,
  multiplier,
  liveCount,
}: {
  state:       RoundState;
  roundNumber: number | null;
  multiplier:  number;
  liveCount:   number;
}) {
  const isCrashed = state === "CRASHED";
  const isFlying  = state === "FLYING";
  const isBetting = state === "BETTING";

  const borderCls = isCrashed ? "border-red-500/25 bg-red-950/10"
    : isFlying                ? "border-green-500/25 bg-green-950/10"
    : isBetting               ? "border-yellow-500/20 bg-yellow-950/10"
    :                           "border-white/[0.06] bg-[#0f1218]";

  const pulseColor = isFlying ? "bg-green-400" : isBetting ? "bg-yellow-400" : "bg-slate-600";
  const animate    = (isFlying || isBetting) ? "animate-pulse" : "";

  const stateLabel = { WAITING: "Waiting…", BETTING: "Place your bets!", FLYING: "In flight", CRASHED: "Crashed" }[state];

  const multColor = isCrashed   ? "#ef4444"
    : multiplier >= 10          ? "#a855f7"
    : multiplier >= 5           ? "#f97316"
    : multiplier >= 2           ? "#eab308"
    :                             "#22c55e";

  return (
    <div className={`rounded-2xl border p-4 transition-colors ${borderCls}`}>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${pulseColor} ${animate}`} />
          <span className="text-[11px] font-black uppercase tracking-widest text-white/50">Live</span>
          {roundNumber !== null && (
            <span className="text-[10px] text-white/25">· #{roundNumber}</span>
          )}
        </div>
        <div className="flex items-center gap-1.5 rounded-full border border-white/[0.07] bg-white/[0.04] px-2.5 py-1">
          <span className="text-[10px]">🎮</span>
          <span className="text-[10px] font-bold text-white/40">
            {liveCount} bet{liveCount !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      <div className="flex items-end justify-between">
        <p className="text-xs font-black text-white/60">{stateLabel}</p>
        {(isFlying || isCrashed) && (
          <p className="text-3xl font-black leading-none" style={{ color: multColor }}>
            {multiplier.toFixed(2)}<span className="text-xl">x</span>
          </p>
        )}
      </div>

      {/* State bar */}
      <div className="mt-3 grid grid-cols-4 gap-1">
        {(["WAITING", "BETTING", "FLYING", "CRASHED"] as RoundState[]).map((s) => {
          const active = s === state;
          const past   = ["WAITING","BETTING","FLYING","CRASHED"].indexOf(s) <
                         ["WAITING","BETTING","FLYING","CRASHED"].indexOf(state);
          return (
            <div
              key={s}
              className={`h-0.5 rounded-full transition-all ${
                active ? "opacity-100" : past ? "opacity-40" : "opacity-10"
              }`}
              style={{ backgroundColor: active ? multColor : "#fff" }}
            />
          );
        })}
      </div>
    </div>
  );
}

// ─── Recent Cashouts Feed ─────────────────────────────────────────────────────

function RecentWinnersCard({ wins }: { wins: RecentWin[] }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-[#0f1218]">
      <div className="flex items-center justify-between border-b border-white/[0.05] px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-sm">🔥</span>
          <span className="text-xs font-black text-white/80">Recent Cashouts</span>
        </div>
        <span className={`h-1.5 w-1.5 rounded-full ${wins.length > 0 ? "bg-green-400 animate-pulse" : "bg-white/10"}`} />
      </div>

      <div className="divide-y divide-white/[0.04]">
        {wins.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <p className="text-[11px] italic text-white/20">Live cashouts appear here as they happen…</p>
          </div>
        ) : (
          wins.map((w) => <WinRow key={w.key} win={w} />)
        )}
      </div>
    </div>
  );
}

function WinRow({ win }: { win: RecentWin }) {
  return (
    <div className="flex items-center gap-2.5 px-3 py-2.5">
      <div
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-black text-white ${avatarCls(win.username)}`}
      >
        {(win.username ?? "?").slice(0, 2).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[11px] font-black text-white/80">
          @{win.username ?? "anonymous"}{win.auto && <span className="ml-1 text-[9px] text-blue-400">🤖</span>}
        </p>
        <p className={`text-[10px] font-bold ${cpTextCls(win.cashoutAt)}`}>
          @ {win.cashoutAt.toFixed(2)}x
        </p>
      </div>
      <span className="shrink-0 text-xs font-black text-[#31c45d]">
        +{fmtKsh(win.winAmount)}
      </span>
    </div>
  );
}

// ─── Crash History Visual ─────────────────────────────────────────────────────

function CrashHistoryCard({
  history,
  avg,
  max,
  aboveTwoPct,
}: {
  history:     HistoryRound[];
  avg:         number;
  max:         number;
  aboveTwoPct: number;
}) {
  const bars = [...history].reverse().slice(0, 20);
  const logMax = Math.log(Math.max(max, 2) + 1);

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-[#0f1218] p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-sm">📊</span>
        <span className="text-xs font-black text-white/80">Last {history.length} Rounds</span>
      </div>

      {/* Stats row */}
      <div className="mb-4 grid grid-cols-3 gap-2">
        <StatPill label="Avg" value={`${avg.toFixed(2)}x`} colorCls="text-blue-400" />
        <StatPill label="Best" value={`${max.toFixed(2)}x`} colorCls="text-purple-400" />
        <StatPill label="≥2×" value={`${aboveTwoPct}%`} colorCls="text-[#31c45d]" />
      </div>

      {/* Bar chart */}
      {bars.length > 0 ? (
        <div className="flex h-16 items-end gap-px">
          {bars.map((r, i) => {
            const h = Math.max((Math.log(r.crashPoint + 1) / logMax) * 100, 6);
            return (
              <div
                key={r.roundId}
                title={`#${r.roundNumber}: ${r.crashPoint.toFixed(2)}x`}
                className="flex-1 cursor-default rounded-sm transition-all hover:opacity-100"
                style={{
                  height:     `${h}%`,
                  background: cpHex(r.crashPoint),
                  opacity:    0.55 + (i / bars.length) * 0.45,
                }}
              />
            );
          })}
        </div>
      ) : (
        <div className="h-16 animate-pulse rounded-lg bg-white/5" />
      )}

      {/* Legend */}
      <div className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1">
        {[
          { label: "<1.5×", color: "#ef4444" },
          { label: "1.5–2×", color: "#f97316" },
          { label: "2–5×", color: "#eab308" },
          { label: "5–10×", color: "#3b82f6" },
          { label: ">10×", color: "#a855f7" },
        ].map(({ label, color }) => (
          <div key={label} className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-[2px]" style={{ background: color }} />
            <span className="text-[9px] text-white/30">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatPill({ label, value, colorCls }: { label: string; value: string; colorCls: string }) {
  return (
    <div className="rounded-xl border border-white/[0.05] bg-white/[0.03] px-2 py-2.5 text-center">
      <p className={`text-sm font-black leading-none ${colorCls}`}>{value}</p>
      <p className="mt-1 text-[9px] uppercase tracking-wide text-white/25">{label}</p>
    </div>
  );
}

// ─── How to Play ──────────────────────────────────────────────────────────────

function HowToPlayCard() {
  const steps = [
    { icon: "💸", title: "Bet during countdown", desc: "Set your stake before the BETTING timer hits zero." },
    { icon: "📈", title: "Watch the multiplier", desc: "It climbs from 1× — the longer it flies, the bigger the payout." },
    { icon: "✋", title: "Cash out before crash", desc: "Hit CASH OUT any time. Or set an auto-cashout target." },
    { icon: "🔒", title: "Provably fair", desc: "Every crash point is cryptographically verifiable — click any chip in the history strip." },
  ];
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-[#0f1218] p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-sm">❓</span>
        <span className="text-xs font-black text-white/80">How to Play</span>
      </div>
      <div className="space-y-3">
        {steps.map((s, i) => (
          <div key={i} className="flex items-start gap-3">
            <span className="mt-0.5 text-[15px] leading-none">{s.icon}</span>
            <div>
              <p className="text-[11px] font-black text-white/80">{s.title}</p>
              <p className="mt-0.5 text-[10px] leading-relaxed text-white/35">{s.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Hotstreak Banner ─────────────────────────────────────────────────────────

function HotstreakBanner({ history }: { history: HistoryRound[] }) {
  // Count how many consecutive rounds crashed below 2× (cold streak)
  let coldStreak = 0;
  for (const r of [...history].reverse()) {
    if (r.crashPoint < 2) coldStreak++;
    else break;
  }
  // Count consecutive ≥2× (hot streak)
  let hotStreak = 0;
  for (const r of [...history].reverse()) {
    if (r.crashPoint >= 2) hotStreak++;
    else break;
  }

  if (hotStreak >= 3) {
    return (
      <div className="rounded-2xl border border-orange-500/25 bg-gradient-to-r from-orange-950/40 to-[#0f1218] px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span className="text-xl">🔥</span>
          <div>
            <p className="text-xs font-black text-orange-300">{hotStreak}-round hot streak!</p>
            <p className="text-[10px] text-orange-400/60">All ≥ 2× — momentum is building</p>
          </div>
        </div>
      </div>
    );
  }
  if (coldStreak >= 4) {
    return (
      <div className="rounded-2xl border border-blue-500/20 bg-gradient-to-r from-blue-950/30 to-[#0f1218] px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span className="text-xl">❄️</span>
          <div>
            <p className="text-xs font-black text-blue-300">{coldStreak} low rounds in a row</p>
            <p className="text-[10px] text-blue-400/60">Stats vary — play responsibly</p>
          </div>
        </div>
      </div>
    );
  }
  return null;
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export function AviatorSidePanel() {
  const [recentWins,  setRecentWins]  = useState<RecentWin[]>([]);
  const [history,     setHistory]     = useState<HistoryRound[]>([]);
  const [liveCount,   setLiveCount]   = useState(0);
  const [roundState,  setRoundState]  = useState<RoundState>("WAITING");
  const [roundNumber, setRoundNumber] = useState<number | null>(null);
  const [multiplier,  setMultiplier]  = useState(1.0);

  const roundStateRef      = useRef<RoundState>("WAITING");
  const flyingStartedAtRef = useRef<string | null>(null);
  const supabase           = createClient();

  // RAF loop for flying multiplier
  useEffect(() => {
    let id: number;
    const tick = () => {
      if (roundStateRef.current === "FLYING" && flyingStartedAtRef.current) {
        const elapsed = Date.now() - new Date(flyingStartedAtRef.current).getTime();
        setMultiplier(Math.round(Math.exp(GROWTH_RATE * elapsed) * 100) / 100);
      }
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, []);

  // Fetch initial state + history
  useEffect(() => {
    fetch("/api/aviator/state")
      .then((r) => r.json())
      .then((data) => {
        if (!data.round) return;
        const s = data.round.state as RoundState;
        setRoundState(s);
        roundStateRef.current = s;
        setRoundNumber(data.round.roundNumber ?? null);
        flyingStartedAtRef.current = data.round.flyingStartedAt ?? null;
        if (s === "CRASHED") setMultiplier(data.round.crashPoint ?? 1.0);
        setLiveCount(data.bets?.length ?? 0);
      })
      .catch(() => {});

    fetch("/api/aviator/history")
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setHistory(data.slice(0, 20)); })
      .catch(() => {});
  }, []);

  // Supabase realtime
  useEffect(() => {
    const ch = supabase
      .channel("aviator")
      .on("broadcast", { event: "round:state" }, ({ payload }) => {
        const s = payload.state as RoundState;
        setRoundState(s);
        roundStateRef.current = s;
        if (s === "FLYING") {
          flyingStartedAtRef.current = payload.flyingStartedAt ?? null;
          setMultiplier(1.0);
        }
        if (s === "WAITING" || s === "BETTING") {
          setLiveCount(0);
          if (payload.roundNumber) setRoundNumber(payload.roundNumber);
        }
      })
      .on("broadcast", { event: "round:crashed" }, ({ payload }) => {
        setRoundState("CRASHED");
        roundStateRef.current = "CRASHED";
        setMultiplier(payload.crashPoint ?? 1.0);
        setTimeout(() => {
          fetch("/api/aviator/history")
            .then((r) => r.json())
            .then((data) => { if (Array.isArray(data)) setHistory(data.slice(0, 20)); })
            .catch(() => {});
        }, 800);
      })
      .on("broadcast", { event: "bet:placed" }, () => {
        setLiveCount((n) => n + 1);
      })
      .on("broadcast", { event: "bet:cashedout" }, ({ payload }) => {
        setRecentWins((prev) =>
          [
            {
              key:       payload.betId ?? String(Date.now() + Math.random()),
              username:  payload.username ?? null,
              winAmount: payload.winAmount ?? 0,
              cashoutAt: payload.cashoutAt ?? 1.0,
              auto:      payload.auto ?? false,
              ts:        Date.now(),
            },
            ...prev,
          ].slice(0, 10),
        );
      })
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Stats
  const avgCrash     = history.length > 0 ? history.reduce((s, r) => s + r.crashPoint, 0) / history.length : 0;
  const maxCrash     = history.reduce((m, r) => Math.max(m, r.crashPoint), 0);
  const aboveTwoPct  = history.length > 0 ? Math.round(history.filter((r) => r.crashPoint >= 2).length / history.length * 100) : 0;

  return (
    <div className="no-scrollbar flex h-full flex-col gap-3 overflow-y-auto bg-[#08090e] p-3">
      <LiveStatusCard
        state={roundState}
        roundNumber={roundNumber}
        multiplier={multiplier}
        liveCount={liveCount}
      />

      <HotstreakBanner history={history} />

      <RecentWinnersCard wins={recentWins} />

      <CrashHistoryCard
        history={history}
        avg={avgCrash}
        max={maxCrash}
        aboveTwoPct={aboveTwoPct}
      />

      <HowToPlayCard />
    </div>
  );
}
