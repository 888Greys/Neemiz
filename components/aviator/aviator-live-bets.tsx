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
  liveBets:       AviatorBetPublic[];
  myHistory:      MyHistoryBet[];
  myCurrentBets?: AviatorBetPublic[];
  userId?:        string;
}

function avatarColor(name: string | null) {
  const cs = ["bg-violet-600","bg-blue-600","bg-green-600","bg-orange-500","bg-pink-600","bg-teal-600","bg-rose-600","bg-indigo-600"];
  return cs[((name ?? "?").charCodeAt(0)) % cs.length];
}
function initials(name: string | null) { return (name ?? "?").slice(0, 2).toUpperCase(); }

function MultChip({ v }: { v: number | null }) {
  if (v === null) return <span className="text-white/20">—</span>;
  const cls = v >= 10 ? "text-purple-400" : v >= 5 ? "text-blue-400" : v >= 2 ? "text-yellow-400" : "text-white/60";
  return <span className={`font-black ${cls}`}>{v.toFixed(2)}×</span>;
}

export function AviatorLiveBets({ liveBets, myHistory, myCurrentBets = [], userId }: Props) {
  const [tab, setTab] = useState<"live" | "my" | "top">("live");

  // top = highest cashout multiplier from live bets this round
  const topBets = [...liveBets]
    .filter((b) => b.status === "CASHEDOUT")
    .sort((a, b) => (b.cashoutAt ?? 0) - (a.cashoutAt ?? 0))
    .slice(0, 20);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg bg-[#141414]">
      {/* Tab bar */}
      <div className="flex shrink-0 gap-1 border-b border-white/[0.07] bg-[#101010] p-2">
        {([
          { id: "live" as const, label: `All Bets`, count: liveBets.length },
          { id: "my"   as const, label: "My Bets",  count: myCurrentBets.length + myHistory.length },
          { id: "top"  as const, label: "Top",       count: topBets.length },
        ]).map(({ id, label, count }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-full py-1.5 text-[11px] font-black transition-colors ${
              tab === id
                ? "bg-white/10 text-white"
                : "text-white/40 hover:bg-white/5 hover:text-white/70"
            }`}
          >
            {label}
            {count > 0 && (
              <span className={`rounded-full px-1.5 py-px text-[9px] font-black ${tab === id ? "bg-[#087cff]/20 text-[#087cff]" : "bg-white/10 text-white/30"}`}>
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-[1fr_78px_56px_72px] gap-0 border-b border-white/[0.05] px-3 py-2">
        {["User", "Bet (KSh)", "@", "Win (KSh)"].map((h) => (
          <span key={h} className="text-[9px] font-black uppercase tracking-widest text-white/20 last:text-right [&:nth-child(2)]:text-right [&:nth-child(3)]:text-right">
            {h}
          </span>
        ))}
      </div>

      {/* Rows */}
      <div className="no-scrollbar min-h-0 flex-1 divide-y divide-white/[0.035] overflow-y-auto">
        {tab === "live" && (
          <>
            {liveBets.length === 0 && <EmptyRow text="No bets placed yet this round" />}
            {liveBets.map((b) => (
              <LiveRow key={b.id} bet={b} isMe={b.userId === userId} />
            ))}
          </>
        )}

        {tab === "my" && (
          <>
            {!userId && <EmptyRow text="Sign in to see your bets" />}
            {userId && myCurrentBets.length === 0 && myHistory.length === 0 && <EmptyRow text="No bets yet — place your first!" />}
            {myCurrentBets.map((b) => (
              <LiveRow key={b.id} bet={b} isMe={true} />
            ))}
            {myHistory.map((b) => (
              <HistoryRow key={b.id} bet={b} />
            ))}
          </>
        )}

        {tab === "top" && (
          <>
            {topBets.length === 0 && <EmptyRow text="No cashouts this round yet" />}
            {topBets.map((b) => (
              <LiveRow key={b.id} bet={b} isMe={b.userId === userId} />
            ))}
          </>
        )}
      </div>
    </div>
  );
}

function EmptyRow({ text }: { text: string }) {
  return (
    <div className="px-3 py-6 text-center">
      <p className="text-[11px] italic text-white/20">{text}</p>
    </div>
  );
}

function LiveRow({ bet, isMe }: { bet: AviatorBetPublic; isMe: boolean }) {
  const cashed = bet.status === "CASHEDOUT";
  const lost   = bet.status === "LOST";
  return (
    <div className={`grid grid-cols-[1fr_78px_56px_72px] items-center gap-0 px-3 py-2 ${isMe ? "bg-[#087cff]/5" : ""}`}>
      {/* User */}
      <div className="flex min-w-0 items-center gap-2">
        <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[9px] font-black text-white ${avatarColor(bet.username)}`}>
          {initials(bet.username)}
        </div>
        <span className={`truncate text-[11px] font-bold ${isMe ? "text-[#087cff]" : "text-white/70"}`}>
          {bet.username ?? "anon"}
          {bet.panelIndex === 1 && <span className="ml-1 text-[8px] text-white/25">②</span>}
        </span>
      </div>
      {/* Bet */}
      <div className="text-right">
        <span className="text-[11px] font-black text-white/80">
          {bet.betAmount.toLocaleString("en-KE")}
        </span>
      </div>
      {/* @ multiplier */}
      <div className="text-right text-[11px]">
        {cashed ? <MultChip v={bet.cashoutAt} /> : lost ? <span className="text-red-400/60 text-[10px]">lost</span> : <span className="text-[10px] text-white/25 animate-pulse">…</span>}
      </div>
      {/* Win */}
      <div className="text-right">
        {cashed && bet.winAmount != null ? (
          <span className="text-[11px] font-black text-[#31c45d]">
            {bet.winAmount.toLocaleString("en-KE", { maximumFractionDigits: 0 })}
          </span>
        ) : lost ? (
          <span className="text-[11px] font-black text-red-400/60">
            -{bet.betAmount.toLocaleString("en-KE")}
          </span>
        ) : (
          <span className="text-white/15 text-[11px]">—</span>
        )}
      </div>
    </div>
  );
}

function HistoryRow({ bet }: { bet: MyHistoryBet }) {
  const won = bet.status === "CASHEDOUT";
  return (
    <div className="grid grid-cols-[1fr_78px_56px_72px] items-center gap-0 px-3 py-2">
      {/* Round */}
      <div className="flex min-w-0 items-center gap-2">
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white/[0.05] text-[8px] font-black text-white/40">
          #{bet.roundNumber}
        </div>
        <span className="text-[10px] text-white/35">crash {bet.crashPoint.toFixed(2)}×</span>
      </div>
      {/* Bet */}
      <div className="text-right text-[11px] font-black text-white/70">
        {bet.betAmount.toLocaleString("en-KE")}
      </div>
      {/* @ */}
      <div className="text-right text-[11px]">
        <MultChip v={bet.cashoutAt} />
      </div>
      {/* Win/Loss */}
      <div className="text-right">
        {won && bet.winAmount != null ? (
          <span className="text-[11px] font-black text-[#31c45d]">
            +{bet.winAmount.toLocaleString("en-KE", { maximumFractionDigits: 0 })}
          </span>
        ) : (
          <span className="text-[11px] font-black text-red-400/60">
            -{bet.betAmount.toLocaleString("en-KE")}
          </span>
        )}
      </div>
    </div>
  );
}
