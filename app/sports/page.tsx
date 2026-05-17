import React from "react";
import { AppShell } from "@/components/app-shell";
import { SportsBetSlip } from "@/components/sports-bet-slip";
import { SportPromoBanner } from "@/components/sports-promo-banner";
import {
  Search,
  Flame,
  TrendingUp,
  Radio,
  Trophy,
  ChevronRight,
  ChevronLeft,
  Clock,
  Tv2,
  CircleDot,
} from "lucide-react";
import {
  getLivescores,
  getUpcomingFixtures,
  MOCK_LIVE,
  MOCK_UPCOMING,
  type Match,
} from "@/lib/sportmonks";
import Image from "next/image";
import Link from "next/link";

const TABS = ["Top", "Live", "Esports", "Sports", "Markets"] as const;
type Tab = (typeof TABS)[number];

const WVL = "https://cdn.worldvectorlogo.com/logos";

const LEAGUE_STRIP = [
  // Football
  { label: "Conf.\nCup CAF",   img: "https://pub-5677b2f8e2e544688a1b6e1d1071f970.r2.dev/leagues/caf.avif" },
  { label: "Premier\nLeague",  img: "https://pub-5677b2f8e2e544688a1b6e1d1071f970.r2.dev/leagues/premier.avif" },
  { label: "LaLiga",           img: "https://pub-5677b2f8e2e544688a1b6e1d1071f970.r2.dev/leagues/laliga.avif" },
  { label: "Bundesliga",       img: "https://pub-5677b2f8e2e544688a1b6e1d1071f970.r2.dev/leagues/bundesliga.avif" },
  { label: "Serie A",          img: "https://pub-5677b2f8e2e544688a1b6e1d1071f970.r2.dev/leagues/seriea.avif" },
  { label: "Ligue 1",          img: "https://pub-5677b2f8e2e544688a1b6e1d1071f970.r2.dev/leagues/ligue1.avif" },
  { label: "FA Cup",           img: "https://pub-5677b2f8e2e544688a1b6e1d1071f970.r2.dev/leagues/facup.avif" },
  // Basketball / other sports
  { label: "NBA",              img: "https://pub-5677b2f8e2e544688a1b6e1d1071f970.r2.dev/leagues/nba-logo.webp" },
  { label: "NHL",              img: "https://pub-5677b2f8e2e544688a1b6e1d1071f970.r2.dev/leagues/nhl.avif" },
  { label: "KHL",              img: "https://pub-5677b2f8e2e544688a1b6e1d1071f970.r2.dev/leagues/khl.avif" },
  { label: "WNBA",             img: "https://pub-5677b2f8e2e544688a1b6e1d1071f970.r2.dev/leagues/wnba.avif" },
  // Esports (worldvectorlogo)
  { label: "CS2",              img: `${WVL}/counter-strike-global-offensive-2.svg` },
  { label: "Valorant",         img: `${WVL}/valorant-logo.svg` },
  { label: "Rainbow\nSix",     img: `${WVL}/rainbow-six-siege-logo.svg` },
  { label: "Call of\nDuty",    img: `${WVL}/call-of-duty.svg` },
  { label: "League of\nLegends", img: `${WVL}/league-of-legends.svg` },
  // Other
  { label: "Markets", icon: "trending_up" },
];

type Props = { searchParams: { tab?: string } };

export default async function SportsPage({ searchParams }: Props) {
  const activeTab = (searchParams.tab ?? "Top") as Tab;

  const hasToken = Boolean(process.env.SPORTS_MONK_API);

  const [liveMatches, upcomingMatches] = hasToken
    ? await Promise.all([getLivescores(), getUpcomingFixtures()])
    : [MOCK_LIVE, MOCK_UPCOMING];

  // Group upcoming by league
  const leagueGroups = upcomingMatches.reduce<Record<string, { meta: Match; fixtures: Match[] }>>(
    (acc, m) => {
      if (!acc[m.league]) acc[m.league] = { meta: m, fixtures: [] };
      acc[m.league].fixtures.push(m);
      return acc;
    },
    {},
  );

  const showLive = activeTab === "Live" || activeTab === "Top";
  const showUpcoming = activeTab !== "Live" && activeTab !== "Esports" && activeTab !== "Markets";
  const displayLive = showLive ? (activeTab === "Top" ? liveMatches.slice(0, 6) : liveMatches) : [];

  return (
    <AppShell rightPanel={<SportsBetSlip />} mainBg="bg-[#f4f6fa]">
      {/* ── Sub-tab bar ── */}
      <div className="sticky top-0 z-30 flex items-center gap-2 border-b border-slate-200 bg-white px-3 py-2.5">
        <div className="flex flex-1 gap-1 overflow-x-auto no-scrollbar">
          {TABS.map((tab) => (
            <Link
              key={tab}
              href={`/sports?tab=${tab}`}
              className={`shrink-0 rounded-xl px-4 py-2 text-sm font-black transition-all ${
                tab === activeTab
                  ? "bg-[#087cff] text-white shadow-[0_4px_14px_rgba(8,124,255,.25)]"
                  : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
              }`}
            >
              {tab}
            </Link>
          ))}
        </div>
        <button className="shrink-0 flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200 transition" type="button" aria-label="Search">
          <Search size={20} />
        </button>
      </div>

      {/* ── Promo banner ── */}
      <SportPromoBanner />

      {/* ── League strip ── */}
      <div className="border-b border-slate-200 bg-white px-3 py-3">
        <div className="flex gap-3 overflow-x-auto no-scrollbar">
          {LEAGUE_STRIP.map((item) => (
            <button key={item.label} type="button" className="flex shrink-0 flex-col items-center gap-1.5 rounded-xl p-1.5 transition hover:bg-slate-50">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 ring-1 ring-slate-200 overflow-hidden">
                {"img" in item && item.img ? (
                  <Image src={item.img} alt={item.label} width={56} height={56} className="h-full w-full object-cover" />
                ) : (
                  <TrendingUp size={28} className="text-slate-500" />
                )}
              </span>
              <span className="w-14 whitespace-pre-line text-center text-[9px] font-bold leading-tight text-slate-500">{item.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="bg-[#f4f6fa] px-3 py-4 space-y-6 min-h-screen">
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
              <span className="text-base font-black text-[#1a1a2e]">{leagueName}</span>
              {meta.country && <span className="text-sm text-slate-400">· {meta.country}</span>}
              <span className="ml-auto text-xs font-bold text-slate-400">{fixtures.length} matches</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {fixtures.map((m) => <MatchCard key={m.id} match={m} />)}
            </div>
          </section>
        ))}

        {/* ── Empty state ── */}
        {displayLive.length === 0 && (!showUpcoming || Object.keys(leagueGroups).length === 0) && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
              <CircleDot size={36} className="text-slate-400" />
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
        <span className="text-base font-black text-[#1a1a2e]">{title}</span>
      </div>
      <div className="flex items-center gap-1">
        <Link
          href={href}
          className="flex items-center gap-1 rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-600 transition hover:bg-slate-200"
        >
          {label}
          <ChevronRight size={16} />
        </Link>
        <button
          type="button"
          className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-500 transition hover:bg-slate-200"
        >
          <ChevronLeft size={18} />
        </button>
        <button
          type="button"
          className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-500 transition hover:bg-slate-200"
        >
          <ChevronRight size={18} />
        </button>
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
    <div className="flex flex-col overflow-hidden rounded-2xl bg-white ring-1 ring-black/[0.08] transition hover:shadow-md hover:ring-black/[0.15]">
      {/* ── Clickable top section → match detail ── */}
      <Link href={`/sports/${m.id}`} className="block">
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
            <div className="truncate text-[13px] font-black text-[#1a1a2e]">{m.league}</div>
            {m.country && <div className="text-[11px] text-slate-400">{m.country}</div>}
          </div>
          <ChevronRight size={14} className="shrink-0 text-slate-300" />
        </div>

        {/* ── Live badge / upcoming time ── */}
        <div className="flex items-center gap-2 px-3.5 pb-2.5">
          {m.isLive ? (
            <span className="flex items-center gap-1.5 rounded-full bg-[#fff0f0] px-2.5 py-1 text-[11px] font-black text-red-500">
              <LiveWaveIcon />
              {m.period}
            </span>
          ) : (
            <span className="flex items-center gap-1.5 rounded-full bg-[#f0f4ff] px-2.5 py-1 text-[11px] font-black text-[#4a6cf7]">
              <Clock size={13} />
              {m.period}
              {dateStr && <span className="font-normal text-slate-400"> · {dateStr}</span>}
            </span>
          )}
          <span className="flex items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-black text-slate-400">
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
      <div className="border-t border-slate-100 px-3.5 py-3">
        <div className="mb-2 text-[10px] font-bold text-slate-400">Full time result</div>
        <div className="flex items-center gap-1.5">
          {m.odds.length > 0 ? (
            <>
              {m.odds.map((o) => (
                <OddButton key={o.label} label={o.label} value={o.value} />
              ))}
              {m.extraMarkets > 0 && (
                <button
                  type="button"
                  className="ml-auto shrink-0 rounded-xl bg-slate-100 px-2.5 py-2 text-[11px] font-black text-slate-500 transition hover:bg-slate-200"
                >
                  +{m.extraMarkets}
                </button>
              )}
            </>
          ) : (
            <span className="text-[11px] text-slate-400">Odds unavailable</span>
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
      <span className="min-w-0 flex-1 truncate text-[13px] font-bold text-[#1a1a2e]">
        {participant.name}
      </span>
      {participant.score !== null && (
        <span className="shrink-0 min-w-[20px] text-right text-[13px] font-black text-[#1a1a2e]">
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

function OddButton({ label, value }: { label: string; value: string }) {
  return (
    <button
      type="button"
      className="group flex flex-1 items-center justify-between gap-1.5 rounded-xl bg-slate-100 px-2.5 py-2 transition hover:bg-[#e8f0fe]"
    >
      <span className="text-[11px] font-bold text-slate-400 group-hover:text-[#4a6cf7]">
        {label}
      </span>
      <span className="text-[13px] font-black text-[#2ecc71] group-hover:text-[#4a6cf7]">
        {value}
      </span>
    </button>
  );
}
