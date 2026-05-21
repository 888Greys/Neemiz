"use client";

import { useState } from "react";
import type { AviatorBetPublic } from "@/lib/aviator/types";

interface MyHistoryBet {
  id:          string;
  panelIndex:  number;
  betAmount:   number;
  cashoutAt:   number | null;
  winAmount:   number | null;
  status:      string;
  placedAt:    string;
  roundNumber: number;
  crashPoint:  number;
}

interface Props {
  liveBets:    AviatorBetPublic[];
  myHistory:   MyHistoryBet[];
  userId?:     string;
}

function StatusChip({ status, cashoutAt }: { status: string; cashoutAt: number | null }) {
  if (status === "CASHEDOUT") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-500/15 px-2 py-0.5 text-[10px] font-bold text-green-400">
        ✓ {cashoutAt?.toFixed(2)}x
      </span>
    );
  }
  if (status === "LOST") {
    return (
      <span className="inline-flex items-center rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-bold text-red-400">
        ✕ Lost
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/15 px-2 py-0.5 text-[10px] font-bold text-blue-400">
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-400" />
      Flying
    </span>
  );
}

function avatar(username: string | null) {
  const name = username ?? "?";
  return name.slice(0, 2).toUpperCase();
}

function avatarColor(username: string | null) {
  const colors = [
    "bg-purple-600", "bg-blue-600", "bg-green-600",
    "bg-orange-600", "bg-pink-600", "bg-teal-600",
  ];
  const seed = (username ?? "?").charCodeAt(0);
  return colors[seed % colors.length];
}

export function AviatorLiveBets({ liveBets, myHistory, userId }: Props) {
  const [tab, setTab] = useState<"live" | "my">("live");

  return (
    <div className="flex h-full flex-col rounded-xl border border-white/10 bg-black/30">
      {/* Tab bar */}
      <div className="flex shrink-0 border-b border-white/10">
        {(["live", "my"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2.5 text-xs font-bold uppercase tracking-wide transition-colors ${
              tab === t
                ? "border-b-2 border-green-500 text-green-400"
                : "text-white/40 hover:text-white/70"
            }`}
          >
            {t === "live" ? `Live Bets (${liveBets.length})` : "My Bets"}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {tab === "live" && (
          <div className="divide-y divide-white/5">
            {liveBets.length === 0 && (
              <p className="px-4 py-8 text-center text-xs text-white/30 italic">
                No bets placed yet this round
              </p>
            )}
            {liveBets.map((bet) => (
              <div key={bet.id} className="flex items-center gap-3 px-3 py-2.5">
                {/* Avatar */}
                <div
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white ${avatarColor(bet.username)}`}
                >
                  {avatar(bet.username)}
                </div>

                {/* Username + panel */}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-white/80">
                    {bet.username ?? "Anonymous"}
                    {bet.panelIndex === 1 && (
                      <span className="ml-1 rounded bg-white/10 px-1 text-[9px] text-white/40">2</span>
                    )}
                  </p>
                  <p className="text-[10px] text-white/40">
                    KSh {bet.betAmount.toLocaleString()}
                    {bet.autoCashout && (
                      <span className="ml-1 text-yellow-500/70">@ {bet.autoCashout.toFixed(2)}x</span>
                    )}
                  </p>
                </div>

                {/* Status */}
                <StatusChip status={bet.status} cashoutAt={bet.cashoutAt} />

                {/* Win amount */}
                {bet.status === "CASHEDOUT" && bet.winAmount && (
                  <span className="shrink-0 text-[11px] font-bold text-green-400">
                    +{bet.winAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        {tab === "my" && (
          <div className="divide-y divide-white/5">
            {!userId && (
              <p className="px-4 py-8 text-center text-xs text-white/30 italic">
                Sign in to see your bet history
              </p>
            )}
            {userId && myHistory.length === 0 && (
              <p className="px-4 py-8 text-center text-xs text-white/30 italic">
                No bets yet — place your first bet!
              </p>
            )}
            {myHistory.map((bet) => (
              <div key={bet.id} className="flex items-center gap-3 px-3 py-2.5">
                {/* Round number */}
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white/5 text-[10px] font-bold text-white/40">
                  #{bet.roundNumber}
                </div>

                {/* Amount + panel */}
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-white/80">
                    KSh {bet.betAmount.toLocaleString()}
                    {bet.panelIndex === 1 && (
                      <span className="ml-1 rounded bg-white/10 px-1 text-[9px] text-white/40">Panel 2</span>
                    )}
                  </p>
                  <p className="text-[10px] text-white/40">
                    Crash: {bet.crashPoint.toFixed(2)}x
                  </p>
                </div>

                {/* Outcome */}
                <div className="text-right">
                  <StatusChip status={bet.status} cashoutAt={bet.cashoutAt} />
                  {bet.winAmount != null && (
                    <p className={`mt-0.5 text-[11px] font-bold ${bet.status === "CASHEDOUT" ? "text-green-400" : "text-red-400"}`}>
                      {bet.status === "CASHEDOUT"
                        ? `+KSh ${bet.winAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                        : `-KSh ${bet.betAmount.toLocaleString()}`}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
