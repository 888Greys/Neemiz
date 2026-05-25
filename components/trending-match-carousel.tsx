"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icon";
import { useBetslip } from "@/lib/betslip-context";
import { MOCK_LIVE } from "@/lib/sportmonks";
import type { Match } from "@/lib/sportmonks";

export function TrendingMatchCarousel() {
  const [matches, setMatches] = useState<Match[]>(MOCK_LIVE.slice(0, 8));
  const [index, setIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const { toggleBet, hasBet } = useBetslip();
  const router = useRouter();

  const fetchMatches = useCallback(async () => {
    try {
      const res = await fetch("/api/sports/live");
      if (res.ok) {
        const data: Match[] = await res.json();
        if (data.length > 0) setMatches(data);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchMatches();
    const refresh = setInterval(fetchMatches, 30_000);
    return () => clearInterval(refresh);
  }, [fetchMatches]);

  useEffect(() => {
    if (isHovered || matches.length <= 1) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % matches.length), 5000);
    return () => clearInterval(t);
  }, [isHovered, matches.length]);

  if (matches.length === 0) return null;

  const event = matches[index];
  const homeScore = event.home.score ?? 0;
  const awayScore = event.away.score ?? 0;

  return (
    <section
      className="px-3"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="mb-2 flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 text-sm font-black">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#ff1979] opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#ff1979]" />
          </span>
          Trending Now
        </h2>
        <Link href="/sports" className="flex items-center gap-0.5 text-[11px] font-black text-slate-500 transition hover:text-white">
          All sports <Icon name="chevron_right" className="text-[14px]" />
        </Link>
      </div>

      <div
        key={index}
        className="animate-in fade-in slide-in-from-bottom-1 block cursor-pointer overflow-hidden rounded-2xl bg-[#16171d] ring-1 ring-white/[0.07] duration-300"
        onClick={() => router.push(`/sports/${event.id}`)}
      >
        {/* League bar */}
        <div className="flex items-center gap-2 border-b border-white/[0.05] px-4 py-2.5">
          {event.leagueLogo ? (
            <img src={event.leagueLogo} alt="" className="h-4 w-4 rounded-sm object-contain" />
          ) : (
            <Icon name="sports_soccer" fill className="text-[15px] text-slate-500" />
          )}
          <span className="flex-1 truncate text-[10px] font-black uppercase tracking-wider text-slate-500">
            {event.league}
          </span>
          {event.isLive ? (
            <span className="rounded-full bg-[#ff1979]/15 px-2 py-0.5 text-[9px] font-black text-[#ff1979]">
              LIVE · {event.period}
            </span>
          ) : (
            <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[9px] font-bold text-slate-500">
              {event.period}
            </span>
          )}
        </div>

        {/* Match */}
        <div className="px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-1 items-center gap-2 min-w-0">
              {event.home.logo && (
                <img src={event.home.logo} alt="" className="h-6 w-6 shrink-0 object-contain" />
              )}
              <span className="truncate text-sm font-black text-white">{event.home.name}</span>
            </div>

            <div className="flex shrink-0 items-center gap-1.5 rounded-xl bg-white/[0.05] px-3 py-1.5">
              <span className="font-mono text-base font-black text-white tabular-nums">
                {homeScore} - {awayScore}
              </span>
            </div>

            <div className="flex flex-1 items-center justify-end gap-2 min-w-0">
              <span className="truncate text-right text-sm font-black text-white">{event.away.name}</span>
              {event.away.logo && (
                <img src={event.away.logo} alt="" className="h-6 w-6 shrink-0 object-contain" />
              )}
            </div>
          </div>

          {/* Odds */}
          {event.odds.length > 0 && (
            <div className="mt-4 grid grid-cols-3 gap-2">
              {event.odds.slice(0, 3).map((odd) => {
                const betId = `trending-${event.id}-${odd.label}`;
                const selected = hasBet(betId);
                return (
                  <button
                    key={odd.label}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleBet({
                        id: betId,
                        matchName: `${event.home.name} vs ${event.away.name}`,
                        market: "1X2",
                        label: odd.label,
                        value: odd.value,
                      });
                    }}
                    className={`flex flex-col items-center rounded-xl py-2.5 transition active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#087cff]/50 ${
                      selected
                        ? "bg-[#087cff]/20 ring-1 ring-[#087cff]/50"
                        : "bg-white/[0.05] hover:bg-white/[0.09]"
                    }`}
                  >
                    <span className="text-[9px] font-bold text-slate-500">{odd.label}</span>
                    <span className={`mt-0.5 text-sm font-black ${selected ? "text-[#087cff]" : "text-white"}`}>
                      {odd.value}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {event.extraMarkets > 0 && (
            <div className="mt-2.5 text-right text-[10px] text-slate-600">+{event.extraMarkets} more markets</div>
          )}
        </div>
      </div>

      {/* Dot indicators */}
      {matches.length > 1 && (
        <div className="mt-2.5 flex justify-center gap-1.5">
          {matches.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Match ${i + 1}`}
              onClick={() => setIndex(i)}
              className={`h-1.5 rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 ${
                i === index ? "w-5 bg-white" : "w-1.5 bg-white/20"
              }`}
            />
          ))}
        </div>
      )}
    </section>
  );
}
