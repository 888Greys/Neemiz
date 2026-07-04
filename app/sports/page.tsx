import React from "react";
import { AppShell } from "@/components/app-shell";
import { SportsBetSlip } from "@/components/sports-bet-slip";
import { SportPromoBanner } from "@/components/sports-promo-banner";
import {
  Search,
  Flame,
  Radio,
  ChevronRight,
  ChevronLeft,
  Clock,
  Tv2,
  CircleDot,
} from "lucide-react";
import { MOCK_LIVE, MOCK_UPCOMING, type Match } from "@/lib/theoddsapi";
import { readLivescores, readUpcoming } from "@/lib/fixtures-cache";
import Image from "next/image";
import Link from "next/link";
import { OddButton } from "@/components/odd-button";

const TABS = ["Top", "Live", "Esports", "Sports", "Markets"] as const;
type Tab = (typeof TABS)[number];

type Props = { searchParams: { tab?: string; league?: string } };

export default async function SportsPage({ searchParams }: Props) {
  const activeTab = (searchParams.tab ?? "Top") as Tab;
  const leagueFilter = searchParams.league ?? "";

  const hasToken = Boolean(process.env.ODDS_API_KEY);
  const liveLimit = activeTab === "Live" ? 30 : activeTab === "Top" ? 6 : 0;
  const upcomingLimit = activeTab === "Sports" ? 48 : activeTab === "Top" ? 24 : 0;

  // Read from the server-side cache (populated by the refresh-fixtures cron) —
  // zero Odds API credits per page load. Fall back to mocks when there's no key
  // or the cache hasn't been warmed yet.
  let [liveMatches, upcomingMatches] = hasToken
    ? await Promise.all([
        liveLimit > 0 ? readLivescores(liveLimit) : Promise.resolve([]),
        upcomingLimit > 0 ? readUpcoming(upcomingLimit) : Promise.resolve([]),
      ])
    : [MOCK_LIVE, MOCK_UPCOMING];
  if ((activeTab === "Top" || activeTab === "Sports") && liveMatches.length === 0 && upcomingMatches.length === 0) {
    liveMatches = MOCK_LIVE;
    upcomingMatches = MOCK_UPCOMING;
  }

  const filterMatches = (matches: Match[]) =>
    leagueFilter
      ? matches.filter((m) => m.league.toLowerCase().includes(leagueFilter.toLowerCase()))
      : matches;

  const showLive = activeTab === "Live" || activeTab === "Top";
  const showUpcoming = activeTab !== "Live" && activeTab !== "Esports" && activeTab !== "Markets";
  const displayLive = showLive
    ? filterMatches(activeTab === "Top" ? liveMatches.slice(0, 6) : liveMatches)
    : [];
  const filteredUpcoming = filterMatches(upcomingMatches);

  // Group upcoming by league
  const leagueGroups = filteredUpcoming.reduce<Record<string, { meta: Match; fixtures: Match[] }>>(
    (acc, m) => {
      if (!acc[m.league]) acc[m.league] = { meta: m, fixtures: [] };
      acc[m.league].fixtures.push(m);
      return acc;
    },
    {},
  );

  // League filter strip — built from the leagues the API actually returned, so
  // it only shows what's currently in season (no hardcoded off-season list).
  const leagueStrip: { label: string; flag?: string }[] = (() => {
    const seen = new Set<string>();
    const out: { label: string; flag?: string }[] = [];
    for (const m of [...liveMatches, ...upcomingMatches]) {
      if (m.league && !seen.has(m.league)) {
        seen.add(m.league);
        out.push({ label: m.league, flag: m.countryFlag });
      }
    }
    return out;
  })();

  return (
    <AppShell rightPanel={<SportsBetSlip />}>
      {/* ── Sub-tab bar ── */}
      <div className="sticky top-0 z-30 flex items-center gap-2 border-b border-white/10 bg-[#111113] px-3 py-2.5">
        <div className="flex flex-1 gap-1 overflow-x-auto no-scrollbar">
          {TABS.map((tab) => (
            <Link
              key={tab}
              href={`/sports?tab=${tab}`}
              prefetch={false}
              className={`shrink-0 rounded-xl px-3 py-2.5 sm:px-4 text-sm font-black transition-all ${
                tab === activeTab
                  ? "bg-[#087cff] text-white shadow-[0_4px_14px_rgba(8,124,255,.25)]"
                  : "text-slate-400 hover:bg-white/[0.06] hover:text-white"
              }`}
            >
              {tab}
            </Link>
          ))}
        </div>
        <button className="shrink-0 flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.06] text-slate-400 hover:bg-white/[0.09] transition" type="button" aria-label="Search">
          <Search size={20} />
        </button>
      </div>

      {/* ── Promo banner ── */}
      <SportPromoBanner />

      {/* ── League strip ── */}
      <div className="border-b border-white/10 bg-[#111113] px-3 py-2">
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {leagueStrip.length === 0 ? (
            <span className="px-2 py-3 text-xs text-slate-500">No leagues in season right now</span>
          ) : leagueStrip.map((item) => {
            const isActive = leagueFilter === item.label;
            const href = isActive
              ? `/sports?tab=${activeTab}`
              : `/sports?tab=${activeTab}&league=${encodeURIComponent(item.label)}`;
            return (
              <Link key={item.label} href={href} prefetch={false} className={`flex shrink-0 flex-col items-center gap-1 rounded-xl p-1 transition hover:bg-white/[0.05] ${isActive ? "bg-white/[0.08]" : ""}`}>
                <span className={`flex h-10 w-10 items-center justify-center rounded-full overflow-hidden ring-1 ${isActive ? "ring-[#087cff] bg-[#087cff]/10" : "ring-white/[0.1] bg-white/[0.07]"}`}>
                  {item.flag ? (
                    <Image src={item.flag} alt={item.label} width={40} height={40} className="h-full w-full object-cover" unoptimized />
                  ) : (
                    <span className="text-[13px] font-black text-slate-300">{item.label.charAt(0)}</span>
                  )}
                </span>
                <span className={`w-12 truncate text-center text-[8px] font-bold leading-tight ${isActive ? "text-[#087cff]" : "text-slate-500"}`} title={item.label}>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>

      <div className="bg-background px-3 py-4 space-y-6 min-h-screen">
        {/* ── Live ── */}
        {displayLive.length > 0 && (
          <section>
            <SectionHeader title="Live Now" icon={Radio} href="/sports?tab=Live" />
            <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {displayLive.map((m) => <MatchCard key={m.id} match={m} />)}
            </div>
          </section>
        )}

        {/* ── Upcoming grouped by league ── */}
        {showUpcoming && Object.entries(leagueGroups).map(([leagueName, { meta, fixtures }]) => (
          <section key={leagueName}>
            {/* League header */}
            <div className="mb-3 flex items-center gap-2.5">
              {meta.countryFlag && (
                <Image src={meta.countryFlag} alt={meta.country} width={22} height={22} className="h-[22px] w-[22px] rounded-sm object-cover" unoptimized />
              )}
              {meta.leagueLogo && (
                <Image src={meta.leagueLogo} alt={leagueName} width={22} height={22} className="h-[22px] w-[22px] object-contain" unoptimized />
              )}
              <span className="text-base font-black text-white">{leagueName}</span>
              {meta.country && <span className="text-sm text-slate-400">· {meta.country}</span>}
              <span className="ml-auto text-xs font-bold text-slate-500">{fixtures.length} matches</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {fixtures.map((m) => <MatchCard key={m.id} match={m} />)}
            </div>
          </section>
        ))}

        {/* ── Empty state ── */}
        {displayLive.length === 0 && (!showUpcoming || Object.keys(leagueGroups).length === 0) && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white/[0.06]">
              <CircleDot size={36} className="text-slate-500" />
            </span>
            <p className="text-sm text-slate-400">No events available right now</p>
          </div>
        )}
      </div>
    </AppShell>
  );
}

// ── Section header ──────────────────────────────────────────────────────────

function SectionHeader({
  icon: IconComp,
  title,
  href,
  label = "View all",
}: {
  icon: React.ElementType;
  title: string;
  href: string;
  label?: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#087cff]/10">
          <IconComp size={16} className="text-[#087cff]" />
        </span>
        <span className="text-base font-black text-white">{title}</span>
      </div>
      <div className="flex items-center gap-1">
        <Link
          href={href}
          prefetch={false}
          className="flex items-center gap-1 rounded-xl bg-white/[0.07] px-3 py-1.5 text-xs font-black text-slate-300 transition hover:bg-white/[0.12]"
        >
          {label}
          <ChevronRight size={16} />
        </Link>
        <div className="hidden sm:flex items-center gap-1">
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/[0.07] text-slate-400 transition hover:bg-white/[0.12]"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/[0.07] text-slate-400 transition hover:bg-white/[0.12]"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Match card ───────────────────────────────────────────────────────────────

function MatchCard({ match: m }: { match: Match }) {
  const dateStr = m.startingAt
    ? new Date(m.startingAt).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    : null;

  return (
    <div className="flex flex-col overflow-hidden rounded-2xl bg-[#16171d] ring-1 ring-white/[0.07] transition hover:ring-white/[0.14] hover:bg-[#1a1b22]">
      {/* ── Clickable top section → match detail ── */}
      <Link href={`/sports/${m.id}`} prefetch={false} className="block">
        {/* ── Header: country flag + league logo + name ── */}
        <div className="flex items-center gap-2 px-3.5 pt-3 pb-2">
          <div className="flex shrink-0 items-center gap-1">
            {m.countryFlag ? (
              <Image src={m.countryFlag} alt={m.country} width={20} height={20} className="h-5 w-5 rounded-sm object-cover" unoptimized />
            ) : (
              <Flame size={16} className="text-orange-500" />
            )}
            {m.leagueLogo && (
              <Image src={m.leagueLogo} alt={m.league} width={20} height={20} className="h-5 w-5 object-contain" unoptimized />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-black text-white">{m.league}</div>
            {m.country && <div className="text-[11px] text-slate-400">{m.country}</div>}
          </div>
          <ChevronRight size={14} className="shrink-0 text-slate-600" />
        </div>

        {/* ── Live badge / upcoming time ── */}
        <div className="flex items-center gap-2 px-3.5 pb-2.5">
          {m.isLive ? (
            <span className="flex items-center gap-1.5 rounded-full bg-red-500/15 px-2.5 py-1 text-[11px] font-black text-red-400">
              <LiveWaveIcon />
              {m.period}
            </span>
          ) : (
            <span className="flex items-center gap-1.5 rounded-full bg-[#087cff]/12 px-2.5 py-1 text-[11px] font-black text-[#087cff]">
              <Clock size={13} />
              {m.period}
              {dateStr && <span className="font-normal text-slate-500"> · {dateStr}</span>}
            </span>
          )}
          <span className="flex items-center gap-1 rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-black text-slate-500">
            <Tv2 size={12} />
            TV
          </span>
        </div>

        {/* ── Teams ── */}
        <div className="space-y-2 px-3.5 pb-3">
          <TeamRow participant={m.home} />
          <TeamRow participant={m.away} />
        </div>
      </Link>

      {/* ── Odds footer ── */}
      <div className="border-t border-white/[0.07] px-3.5 py-3">
        <div className="mb-2 text-[10px] font-bold text-slate-500">Full time result</div>
        <div className="flex items-center gap-1.5">
          {m.odds.length > 0 ? (
            <>
              {m.odds.map((o) => (
                <OddButton
                  key={o.label}
                  bet={{
                    id: `${m.id}-${o.label}`,
                    matchName: `${m.home.name} vs ${m.away.name}`,
                    market: "Full time result",
                    label: o.label,
                    value: o.value,
                  }}
                />
              ))}
              {m.extraMarkets > 0 && (
                <button
                  type="button"
                  className="ml-auto shrink-0 rounded-xl bg-white/[0.07] px-2.5 py-2 text-[11px] font-black text-slate-400 transition hover:bg-white/[0.12]"
                >
                  +{m.extraMarkets}
                </button>
              )}
            </>
          ) : (
            <span className="text-[11px] text-slate-500">Odds unavailable</span>
          )}
        </div>
      </div>
    </div>
  );
}

function LiveWaveIcon() {
  return (
    <svg viewBox="0 0 16 10" className="h-3 w-4 fill-current" aria-hidden="true">
      <path d="M0 5h1.5a.5.5 0 0 1 .5.5v1a.5.5 0 0 0 1 0V2a.5.5 0 0 1 1 0v6.5a.5.5 0 0 0 1 0V1a.5.5 0 0 1 1 0v8a.5.5 0 0 0 1 0V3a.5.5 0 0 1 1 0v4a.5.5 0 0 0 1 0V4a.5.5 0 0 1 1 0v2h1.5" strokeWidth="0" />
    </svg>
  );
}

function TeamRow({
  participant,
}: {
  participant: { name: string; logo?: string; score: number | null };
}) {
  return (
    <div className="flex items-center gap-2.5">
      {participant.logo ? (
        <Image
          src={participant.logo}
          alt={participant.name}
          width={24}
          height={24}
          className="h-6 w-6 shrink-0 object-contain"
          unoptimized
        />
      ) : (
        <TeamAvatar name={participant.name} />
      )}
      <span className="min-w-0 flex-1 truncate text-[13px] font-bold text-white">
        {participant.name}
      </span>
      {participant.score !== null && (
        <span className="shrink-0 min-w-[20px] text-right text-[13px] font-black text-white">
          {participant.score}
        </span>
      )}
    </div>
  );
}

const AVATAR_COLORS = [
  "#e63946","#f4a261","#2a9d8f","#457b9d","#6d6875",
  "#8338ec","#fb5607","#3a86ff","#06d6a0","#ef233c",
];

function TeamAvatar({ name }: { name: string }) {
  const idx = name.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_COLORS.length;
  const bg = AVATAR_COLORS[idx];
  return (
    <span
      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-black text-white"
      style={{ backgroundColor: bg }}
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

