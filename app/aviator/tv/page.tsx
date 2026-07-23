"use client";

import { useEffect, useState, useRef } from "react";
import { AviatorCanvas } from "@/components/aviator/aviator-canvas";
import { Icon } from "@/components/icon";
import type { AviatorRoundState, AviatorRound } from "@/lib/aviator/types";

const WS_URL = process.env.NEXT_PUBLIC_AVIATOR_WS_URL ?? "wss://aviator.nezeem.com/ws";

interface HistoryRound {
  roundId: string;
  roundNumber: number;
  crashPoint: number;
}

function mapStatus(s: string): AviatorRoundState {
  if (s === "RUNNING") return "FLYING";
  if (s === "CRASHED") return "CRASHED";
  if (s === "BETTING") return "BETTING";
  return "WAITING";
}

export default function AviatorTvPage() {
  const [round, setRound] = useState<AviatorRound | null>(null);
  const [multiplier, setMultiplier] = useState(1.0);
  const [history, setHistory] = useState<HistoryRound[]>([]);
  const [soundOn, setSoundOn] = useState(true);

  const activeRef = useRef(true);

  // Poll state / connect WS for TV display
  useEffect(() => {
    activeRef.current = true;
    let ws: WebSocket | null = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;

    async function fetchState() {
      try {
        const res = await fetch("/api/aviator/state");
        if (!res.ok) return;
        const data = await res.json();
        if (data.round && activeRef.current) {
          setRound(data.round);
          if (data.history && Array.isArray(data.history)) {
            setHistory(data.history.slice(-20));
          }
        }
      } catch {
        /* non-critical */
      }
    }

    fetchState();
    pollTimer = setInterval(fetchState, 1500);

    try {
      ws = new WebSocket(WS_URL);
      ws.onmessage = (evt) => {
        if (!activeRef.current) return;
        try {
          const msg = JSON.parse(evt.data);
          if (msg.type === "tick" && typeof msg.multiplier === "number") {
            setMultiplier(msg.multiplier);
          } else if (msg.type === "round_start") {
            setMultiplier(1.0);
            fetchState();
          } else if (msg.type === "crash") {
            fetchState();
          }
        } catch {
          /* non-critical */
        }
      };
    } catch {
      /* fallback to polling */
    }

    return () => {
      activeRef.current = false;
      if (pollTimer) clearInterval(pollTimer);
      if (ws) ws.close();
    };
  }, []);

  const state = round ? mapStatus(round.state) : "WAITING";
  const crashPoint = round?.crashPoint ? Number(round.crashPoint) : undefined;

  return (
    <main className="relative w-screen h-screen bg-[#090a0d] text-white overflow-hidden select-none flex flex-col font-sans">
      {/* Top Header Bar for TV */}
      <header className="h-16 px-6 bg-[#12141a]/95 border-b border-white/10 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="h-4 w-4 rounded-full bg-red-600 animate-pulse" />
            <span className="font-black tracking-wider text-xl uppercase bg-gradient-to-r from-red-500 to-amber-400 bg-clip-text text-transparent">
              AVIATOR RETAIL TV
            </span>
          </div>
          <span className="rounded bg-red-600/20 px-2.5 py-1 text-xs font-bold text-red-400 border border-red-500/30">
            SHOP DISPLAY MODE
          </span>
        </div>

        {/* History Pills Strip */}
        <div className="hidden md:flex items-center gap-1.5 overflow-x-auto max-w-[50vw] px-2 py-1">
          {history.slice(-12).map((h, i) => {
            const val = h.crashPoint;
            const isHigh = val >= 2.0;
            const isMega = val >= 10.0;
            return (
              <span
                key={h.roundId || i}
                className={`px-2.5 py-0.5 rounded-full text-xs font-bold shrink-0 border ${
                  isMega
                    ? "bg-purple-600/20 border-purple-500 text-purple-300"
                    : isHigh
                    ? "bg-emerald-600/20 border-emerald-500 text-emerald-300"
                    : "bg-blue-600/20 border-blue-500 text-blue-300"
                }`}
              >
                {val.toFixed(2)}x
              </span>
            );
          })}
        </div>

        <div className="flex items-center gap-4 text-sm font-semibold text-slate-300">
          <span>Round #{round?.roundNumber ?? "---"}</span>
          <button
            type="button"
            onClick={() => setSoundOn(!soundOn)}
            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition"
          >
            <Icon name={soundOn ? "volume_up" : "volume_off"} className="text-xl" />
          </button>
        </div>
      </header>

      {/* Main Full-Screen Canvas Area */}
      <section className="relative flex-1 min-h-0 bg-[#0d0e12]">
        <AviatorCanvas
          state={state}
          multiplier={multiplier}
          crashPoint={crashPoint}
          bettingEndsAt={round?.bettingEndsAt}
          flyingStartedAt={round?.flyingStartedAt}
        />

        {/* Overlaid TV Multiplier Font */}
        {state === "FLYING" && (
          <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center z-20">
            <div className="text-8xl sm:text-[140px] font-black tracking-tight text-white drop-shadow-[0_10px_30px_rgba(0,0,0,0.8)] font-mono">
              {multiplier.toFixed(2)}x
            </div>
          </div>
        )}

        {state === "CRASHED" && (
          <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center z-20 bg-red-950/30 backdrop-blur-[2px]">
            <div className="text-4xl sm:text-6xl font-black text-red-500 uppercase tracking-widest mb-2">
              FLEW AWAY!
            </div>
            <div className="text-6xl sm:text-9xl font-black text-red-400 font-mono">
              @{crashPoint ? crashPoint.toFixed(2) : multiplier.toFixed(2)}x
            </div>
          </div>
        )}

        {state === "WAITING" && (
          <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center z-20">
            <div className="text-3xl sm:text-5xl font-black text-amber-400 uppercase tracking-wider animate-pulse">
              WAITING FOR NEXT ROUND...
            </div>
          </div>
        )}
      </section>

      {/* Ticker Footer */}
      <footer className="h-10 px-6 bg-[#0a0b0e] border-t border-white/5 flex items-center justify-between text-xs text-slate-400 font-medium">
        <div>PLACE BETS AT THE CASHIER COUNTER BEFORE TAKE-OFF</div>
        <div>STAKE RESPONSIBLY | OFFICIAL SHOP TERMINAL</div>
      </footer>
    </main>
  );
}
