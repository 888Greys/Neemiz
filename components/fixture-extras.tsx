"use client";

import { useState } from "react";
import Image from "next/image";
import type { MatchEvent, MatchStat, LineupEntry } from "@/lib/theoddsapi";

type Props = {
  events: MatchEvent[];
  stats: MatchStat[];
  homeLineup: LineupEntry[];
  awayLineup: LineupEntry[];
  homeName: string;
  awayName: string;
  homeLogo?: string;
  awayLogo?: string;
  homeParticipantId: number;
};

const TABS = [
  { key: "events", label: "Events" },
  { key: "stats", label: "Stats" },
  { key: "lineups", label: "Lineups" },
] as const;

type Tab = (typeof TABS)[number]["key"];

const EVENT_META: Record<number, { icon: string; color: string }> = {
  14: { icon: "⚽", color: "text-emerald-400" },
  15: { icon: "⚽", color: "text-orange-400" },
  16: { icon: "🟥", color: "text-red-400" },
  17: { icon: "🟨🟥", color: "text-red-400" },
  18: { icon: "🔄", color: "text-blue-400" },
  19: { icon: "🟨", color: "text-yellow-400" },
};

/** Secondary match info as tabs so markets stay primary. */
export function FixtureExtras({
  events,
  stats,
  homeLineup,
  awayLineup,
  homeName,
  awayName,
  homeLogo,
  awayLogo,
  homeParticipantId,
}: Props) {
  const hasAny = events.length > 0 || stats.length > 0 || homeLineup.length > 0 || awayLineup.length > 0;
  const [tab, setTab] = useState<Tab>(
    events.length > 0 ? "events" : stats.length > 0 ? "stats" : "lineups",
  );

  if (!hasAny) return null;

  return (
    <div className="overflow-hidden rounded-xl bg-white/[0.03] ring-1 ring-white/[0.06]">
      <div className="flex gap-1 border-b border-white/[0.06] px-2 py-2">
        {TABS.map((t) => {
          const empty =
            (t.key === "events" && events.length === 0) ||
            (t.key === "stats" && stats.length === 0) ||
            (t.key === "lineups" && homeLineup.length === 0 && awayLineup.length === 0);
          if (empty) return null;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`rounded-lg px-3 py-1.5 text-[12px] font-black transition ${
                tab === t.key ? "bg-[#087cff] text-white" : "text-slate-500 hover:text-white"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "events" && (
        <div className="divide-y divide-white/[0.06] px-4 pb-2">
          {events.map((ev) => {
            const meta = EVENT_META[ev.type_id] ?? { icon: "•", color: "text-slate-400" };
            const isHome = ev.participant_id === homeParticipantId;
            const minute = `${ev.minute}${ev.extra_minute ? `+${ev.extra_minute}` : ""}'`;
            const isSub = ev.type_id === 18;
            return (
              <div key={ev.id} className={`flex items-start gap-3 py-2.5 ${isHome ? "" : "flex-row-reverse"}`}>
                <span className="w-10 shrink-0 text-center text-[11px] font-black tabular-nums text-slate-500">{minute}</span>
                <span className="shrink-0 text-[16px] leading-none">{meta.icon}</span>
                <div className={`min-w-0 flex-1 ${isHome ? "" : "text-right"}`}>
                  <div className="truncate text-[13px] font-black text-white">
                    {isSub ? ev.related_player_name ?? ev.player_name : ev.player_name}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === "stats" && (
        <div className="space-y-3 px-4 py-3">
          {stats.map((s) => {
            const h = s.home ?? 0;
            const a = s.away ?? 0;
            const total = h + a;
            const homeWidth = total > 0 ? Math.round((h / total) * 100) : 50;
            return (
              <div key={s.name}>
                <div className="mb-1 flex items-center justify-between text-[12px]">
                  <span className="font-black tabular-nums text-white">{h}</span>
                  <span className="font-bold text-slate-400">{s.name}</span>
                  <span className="font-black tabular-nums text-white">{a}</span>
                </div>
                <div className="flex h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
                  <div className="rounded-full bg-[#087cff]" style={{ width: `${homeWidth}%` }} />
                  <div className="rounded-full bg-[#e63946]" style={{ width: `${100 - homeWidth}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === "lineups" && (
        <div className="grid grid-cols-2 divide-x divide-white/[0.06] px-0 pb-4">
          <LineupCol title={homeName} logo={homeLogo} players={homeLineup} />
          <LineupCol title={awayName} logo={awayLogo} players={awayLineup} />
        </div>
      )}
    </div>
  );
}

function LineupCol({ title, logo, players }: { title: string; logo?: string; players: LineupEntry[] }) {
  const starters = players.filter((p) => !p.on_bench);
  const bench = players.filter((p) => p.on_bench);
  return (
    <div className="px-3 pt-2">
      <div className="mb-2 flex items-center gap-1.5">
        {logo && <Image src={logo} alt="" width={16} height={16} className="h-4 w-4 object-contain" unoptimized />}
        <span className="truncate text-[11px] font-black uppercase text-slate-500">{title}</span>
      </div>
      {starters.map((p) => (
        <div key={p.player_id} className="flex items-center gap-1.5 py-1">
          <span className="w-5 shrink-0 text-right text-[10px] font-bold tabular-nums text-slate-500">
            {p.jersey_number ?? ""}
          </span>
          <span className="min-w-0 truncate text-[12px] font-bold text-white">{p.player_name}</span>
        </div>
      ))}
      {bench.length > 0 && (
        <>
          <div className="my-1.5 text-[10px] font-bold uppercase text-slate-500">Bench</div>
          {bench.map((p) => (
            <div key={p.player_id} className="flex items-center gap-1.5 py-1 opacity-50">
              <span className="w-5 shrink-0 text-right text-[10px] font-bold tabular-nums text-slate-500">
                {p.jersey_number ?? ""}
              </span>
              <span className="min-w-0 truncate text-[12px] font-bold text-white">{p.player_name}</span>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
