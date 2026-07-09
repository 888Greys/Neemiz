"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icon";
import { useBetslip } from "@/lib/betslip-context";
import { MOCK_LIVE } from "@/lib/theoddsapi";
import type { Match } from "@/lib/theoddsapi";
import { getTeamLogo } from "@/lib/team-logos";

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

  // Clamp the rotation index when the match list shrinks (e.g. mock → fewer
  // live matches), otherwise matches[index] is undefined and the render throws.
  useEffect(() => {
    setIndex((i) => (i >= matches.length ? 0 : i));
  }, [matches.length]);

  if (matches.length === 0) return null;

  const event = matches[index] ?? matches[0];
  const homeScore = event.home?.score ?? 0;
  const awayScore = event.away?.score ?? 0;
  const homeLogo = event.home?.logo ?? getTeamLogo(event.home?.name ?? "");
  const awayLogo = event.away?.logo ?? getTeamLogo(event.away?.name ?? "");
  const leagueFlag = event.countryFlag;

  return (
    <section
      className="w-full"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="mb-3 flex items-end justify-between gap-3 px-0.5">
        <div>
          <h2 className="flex items-center gap-2 text-base font-black text-white md:text-xl">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#ff1979] opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[#ff1979]" />
            </span>
            Trending now
          </h2>
          <p className="mt-0.5 text-[12px] font-medium text-white/40">
            Live matches — tap a price to add to slip
          </p>
        </div>
        <Link
          href="/sports"
          prefetch={false}
          className="mb-0.5 flex shrink-0 items-center gap-0.5 text-[12px] font-black text-white/45 transition hover:text-white"
        >
          All sports
          <Icon name="chevron_right" className="text-[14px]" />
        </Link>
      </div>

      <div
        key={index}
        className="group relative animate-in fade-in slide-in-from-bottom-1 cursor-pointer overflow-hidden rounded-[28px] duration-300"
        onClick={() =>
          // Free-tier display fixtures may not exist in the Odds API cache —
          // send users to the sportsbook hub instead of a dead detail page.
          router.push(event.odds?.length ? `/sports/${event.id}` : "/sports")
        }
      >
        {/* Atmosphere */}
        <div className="absolute inset-0 bg-[#0e1218]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(8,124,255,0.18),transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(255,25,121,0.12),transparent_50%)]" />
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,.35) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.35) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
            maskImage: "radial-gradient(ellipse at center, black 20%, transparent 75%)",
          }}
        />
        <div className="absolute inset-0 ring-1 ring-inset ring-white/[0.08]" />

        {/* League bar */}
        <div className="relative flex items-center gap-2.5 border-b border-white/[0.06] px-4 py-3 md:px-5">
          {event.leagueLogo || leagueFlag ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={event.leagueLogo || leagueFlag}
              alt=""
              className="h-5 w-5 rounded-sm object-contain"
            />
          ) : (
            <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-violet-500/20 text-violet-300 ring-1 ring-violet-400/20">
              <Icon name="sports_soccer" fill className="text-[15px]" />
            </span>
          )}
          <span className="min-w-0 flex-1 truncate text-[11px] font-black uppercase tracking-[0.14em] text-white/50">
            {event.league}
          </span>
          {event.isLive ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#ff1979]/20 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-[#ff1979] ring-1 ring-[#ff1979]/30">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#ff1979] motion-reduce:animate-none" />
              Live · {event.period}
            </span>
          ) : (
            <span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-[10px] font-bold text-white/45 ring-1 ring-white/10">
              {event.period}
            </span>
          )}
        </div>

        {/* Match body */}
        <div className="relative px-4 py-5 md:px-6 md:py-6">
          <div className="flex items-center gap-3 md:gap-5">
            {/* Home */}
            <div className="flex min-w-0 flex-1 flex-col items-center gap-2 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.06] ring-1 ring-white/10 md:h-14 md:w-14">
                {homeLogo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={homeLogo} alt="" className="h-8 w-8 object-contain md:h-9 md:w-9" />
                ) : (
                  <Icon name="sports_soccer" className="text-[22px] text-white/30" />
                )}
              </span>
              <span className="line-clamp-2 text-[13px] font-black leading-tight text-white md:text-[15px]">
                {event.home?.name}
              </span>
            </div>

            {/* Score */}
            <div className="flex shrink-0 flex-col items-center gap-1">
              <div className="flex items-center gap-2 rounded-2xl bg-black/35 px-4 py-2.5 ring-1 ring-white/10 backdrop-blur-sm md:gap-3 md:px-5 md:py-3">
                <span className="font-mono text-3xl font-black tabular-nums text-white md:text-4xl">
                  {homeScore}
                </span>
                <span className="text-lg font-black text-white/25 md:text-xl">–</span>
                <span className="font-mono text-3xl font-black tabular-nums text-white md:text-4xl">
                  {awayScore}
                </span>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">
                Score
              </span>
            </div>

            {/* Away */}
            <div className="flex min-w-0 flex-1 flex-col items-center gap-2 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.06] ring-1 ring-white/10 md:h-14 md:w-14">
                {awayLogo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={awayLogo} alt="" className="h-8 w-8 object-contain md:h-9 md:w-9" />
                ) : (
                  <Icon name="sports_soccer" className="text-[22px] text-white/30" />
                )}
              </span>
              <span className="line-clamp-2 text-[13px] font-black leading-tight text-white md:text-[15px]">
                {event.away?.name}
              </span>
            </div>
          </div>

          {/* Odds */}
          {(event.odds?.length ?? 0) > 0 && (
            <div className="mt-5 grid grid-cols-3 gap-2 md:mt-6 md:gap-3">
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
                        matchName: `${event.home?.name ?? ""} vs ${event.away?.name ?? ""}`,
                        market: "1X2",
                        label: odd.label,
                        value: odd.value,
                      });
                    }}
                    className={`flex flex-col items-center rounded-2xl py-3 transition active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#087cff]/50 md:py-3.5 ${
                      selected
                        ? "bg-[#087cff]/25 ring-1 ring-[#087cff]/60 shadow-lg shadow-[#087cff]/15"
                        : "bg-white/[0.06] ring-1 ring-white/[0.08] hover:bg-white/[0.1] hover:ring-white/15"
                    }`}
                  >
                    <span className="text-[10px] font-bold uppercase tracking-wider text-white/40">
                      {odd.label}
                    </span>
                    <span
                      className={`mt-1 text-base font-black tabular-nums md:text-lg ${
                        selected ? "text-[#6eb6ff]" : "text-white"
                      }`}
                    >
                      {odd.value}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          <div className="mt-3 flex items-center justify-between gap-2">
            {event.extraMarkets > 0 ? (
              <span className="text-[11px] font-semibold text-white/35">
                +{event.extraMarkets} more markets
              </span>
            ) : (
              <span />
            )}
            <span className="inline-flex items-center gap-1 text-[11px] font-black text-white/50 transition group-hover:text-white">
              Open match
              <Icon name="arrow_forward" className="text-[14px] transition group-hover:translate-x-0.5" />
            </span>
          </div>
        </div>
      </div>

      {/* Dot indicators */}
      {matches.length > 1 && (
        <div className="mt-3 flex justify-center gap-1.5">
          {matches.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Match ${i + 1}`}
              onClick={() => setIndex(i)}
              className={`h-1.5 rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 ${
                i === index ? "w-5 bg-white" : "w-1.5 bg-white/20 hover:bg-white/40"
              }`}
            />
          ))}
        </div>
      )}
    </section>
  );
}
