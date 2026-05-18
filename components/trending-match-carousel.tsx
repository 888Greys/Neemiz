"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { liveEvents } from "@/lib/mock-data";
import { Icon } from "@/components/icon";
import { useBetslip } from "@/lib/betslip-context";

const SPORT_ICONS: Record<string, string> = {
  "Premier League": "sports_soccer",
  "La Liga": "sports_soccer",
  "Serie A": "sports_soccer",
  "NBA": "sports_basketball",
};

export function TrendingMatchCarousel() {
  const [index, setIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const { toggleBet, hasBet } = useBetslip();
  const router = useRouter();

  useEffect(() => {
    if (isHovered) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % liveEvents.length), 5000);
    return () => clearInterval(t);
  }, [isHovered]);

  const event = liveEvents[index];
  const icon = SPORT_ICONS[event.league] ?? "emoji_events";

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
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#ff1979] animate-live-dot" />
          </span>
          Trending Now
        </h2>
        <Link href="/sports" className="flex items-center gap-0.5 text-[11px] font-black text-slate-500 transition hover:text-white">
          All sports <Icon name="chevron_right" className="text-[14px]" />
        </Link>
      </div>

      <div
        key={index}
        className="block animate-in fade-in slide-in-from-bottom-1 duration-300 rounded-2xl bg-[#16171d] ring-1 ring-white/[0.07] overflow-hidden cursor-pointer"
        onClick={() => router.push("/sports")}
      >
        {/* League bar */}
        <div className="flex items-center gap-2 border-b border-white/[0.05] px-4 py-2.5">
          <Icon name={icon} fill className="text-[15px] text-slate-500" />
          <span className="flex-1 text-[10px] font-black uppercase tracking-wider text-slate-500">{event.league}</span>
          <span className="rounded-full bg-[#ff1979]/15 px-2 py-0.5 text-[9px] font-black text-[#ff1979]">
            LIVE · {event.time}
          </span>
        </div>

        {/* Match */}
        <div className="px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            {/* Home */}
            <span className="flex-1 text-sm font-black text-white">{event.home}</span>

            {/* Score */}
            <div className="flex items-center gap-1.5 rounded-xl bg-white/[0.05] px-3 py-1.5">
              <span className="font-mono text-base font-black text-white tabular-nums">{event.score}</span>
            </div>

            {/* Away */}
            <span className="flex-1 text-right text-sm font-black text-white">{event.away}</span>
          </div>

          {/* Odds row */}
          <div className="mt-4 grid grid-cols-3 gap-2">
            {["1", "X", "2"].map((label, i) => {
              const betId = `trending-${event.home}-${event.away}-${label}`;
              const selected = hasBet(betId);
              return (
                <button
                  key={label}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleBet({
                      id: betId,
                      matchName: `${event.home} vs ${event.away}`,
                      market: "1X2",
                      label,
                      value: String(event.odds[i] ?? "—"),
                    });
                  }}
                  className={`flex flex-col items-center rounded-xl py-2.5 transition active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#087cff]/50 ${
                    selected
                      ? "bg-[#087cff]/20 ring-1 ring-[#087cff]/50"
                      : "bg-white/[0.05] hover:bg-white/[0.09]"
                  }`}
                >
                  <span className="text-[9px] font-bold text-slate-500">{label}</span>
                  <span className={`mt-0.5 text-sm font-black ${selected ? "text-[#087cff]" : "text-white"}`}>
                    {event.odds[i] ?? "—"}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-2.5 text-right text-[10px] text-slate-600">{event.markets} more markets</div>
        </div>
      </div>

      {/* Dot indicators */}
      <div className="mt-2.5 flex justify-center gap-1.5">
        {liveEvents.map((_, i) => (
          <button
            key={i}
            type="button"
            aria-label={`Match ${i + 1}`}
            onClick={() => setIndex(i)}
            className={`h-1.5 rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 ${i === index ? "w-5 bg-white" : "w-1.5 bg-white/20"}`}
          />
        ))}
      </div>
    </section>
  );
}
