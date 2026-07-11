import React from "react";
import { AppShell } from "@/components/app-shell";
import { SportsBetSlip } from "@/components/sports-bet-slip";
import { MatchRow, LeagueGroupHeader } from "@/components/sports-match-row";
import { Icon } from "@/components/icon";
import { CircleDot } from "lucide-react";
import { type Match, listActiveLeagues } from "@/lib/theoddsapi";
import { readLivescores, readUpcoming } from "@/lib/fixtures-cache";
import {
  getDisplaySportsbookFeed,
  mergeOddsOntoDisplay,
} from "@/lib/apisports";
import { attachMatchLogos } from "@/lib/team-logos";
import { getLeagueLogo } from "@/lib/league-logos";
import {
  SPORT_NAV,
  sportNavFromSlug,
  sportSlugFromKey,
  matchBelongsToSport,
  resolveSportSlug,
  DEFAULT_SPORT_SLUG,
  type SportNav,
} from "@/lib/sport-nav";
import Image from "next/image";
import Link from "next/link";
import { SportsLiveRefresh } from "@/components/sports-live-refresh";

type Props = {
  searchParams: { sport?: string; league?: string; q?: string; tab?: string };
};

const LEAGUE_PRIORITY = [
  "Premier League",
  "EPL",
  "FIFA World Cup",
  "World Cup",
  "La Liga",
  "Bundesliga",
  "Serie A",
  "Ligue 1",
  "Championship",
  "Champions League",
  "Europa League",
  "MLS",
  "Liga MX",
  "Brazil Série A",
];

function leagueRank(name: string): number {
  const n = name.toLowerCase();
  const i = LEAGUE_PRIORITY.findIndex(
    (p) => n === p.toLowerCase() || n.includes(p.toLowerCase()) || p.toLowerCase().includes(n),
  );
  return i === -1 ? 500 + name.charCodeAt(0) : i;
}

function groupByLeague(matches: Match[]) {
  return matches.reduce<Record<string, { meta: Match; fixtures: Match[] }>>((acc, m) => {
    if (!acc[m.league]) acc[m.league] = { meta: m, fixtures: [] };
    acc[m.league].fixtures.push(m);
    return acc;
  }, {});
}

function orderedLeagueGroups(matches: Match[]) {
  const groups = groupByLeague(matches);
  return Object.entries(groups)
    .map(([league, g]) => ({
      league,
      meta: g.meta,
      fixtures: [...g.fixtures].sort(
        (a, b) => new Date(a.startingAt || 0).getTime() - new Date(b.startingAt || 0).getTime(),
      ),
    }))
    .sort((a, b) => leagueRank(a.league) - leagueRank(b.league) || a.league.localeCompare(b.league));
}

function withLeagueCrest(m: Match): Match {
  return { ...m, leagueLogo: m.leagueLogo ?? getLeagueLogo(m.league) };
}

function filterQ(matches: Match[], q: string) {
  if (!q) return matches;
  const needle = q.toLowerCase();
  return matches.filter(
    (m) =>
      m.home.name.toLowerCase().includes(needle) ||
      m.away.name.toLowerCase().includes(needle) ||
      m.league.toLowerCase().includes(needle),
  );
}

function mergeByEventId(primary: Match[], extra: Match[]): Match[] {
  const seen = new Set(primary.map((m) => m.eventId || String(m.id)));
  const out = [...primary];
  for (const m of extra) {
    const key = m.eventId || String(m.id);
    if (seen.has(key)) continue;
    const pair = `${m.home.name}|${m.away.name}`.toLowerCase();
    if (out.some((x) => `${x.home.name}|${x.away.name}`.toLowerCase() === pair)) continue;
    seen.add(key);
    out.push(m);
  }
  return out;
}

function hasListOdds(m: Match) {
  return (
    m.odds.length > 0 ||
    (m.listMarkets?.threeWay.length ?? 0) > 0 ||
    (m.listMarkets?.overUnder.length ?? 0) > 0
  );
}

function enrichLogos(oddsMatches: Match[], display: Match[]): Match[] {
  if (display.length === 0) return oddsMatches;
  const key = (m: Match) =>
    `${m.home.name.trim().toLowerCase()}|${m.away.name.trim().toLowerCase()}`;
  const byTeams = new Map(display.map((m) => [key(m), m]));
  return oddsMatches.map((m) => {
    const hit =
      byTeams.get(key(m)) ??
      byTeams.get(`${m.away.name.trim().toLowerCase()}|${m.home.name.trim().toLowerCase()}`);
    if (!hit) return m;
    return {
      ...m,
      leagueLogo: m.leagueLogo ?? hit.leagueLogo,
      countryFlag: m.countryFlag ?? hit.countryFlag,
      home: {
        ...m.home,
        logo: hit.home.logo ?? m.home.logo,
        score: m.home.score ?? hit.home.score,
      },
      away: {
        ...m.away,
        logo: hit.away.logo ?? m.away.logo,
        score: m.away.score ?? hit.away.score,
      },
    };
  });
}

function hrefSports(opts: { sport?: string; league?: string; q?: string; tab?: string }) {
  const p = new URLSearchParams();
  if (opts.sport && opts.sport !== DEFAULT_SPORT_SLUG) p.set("sport", opts.sport);
  if (opts.sport === "all") p.set("sport", "all");
  if (opts.league) p.set("league", opts.league);
  if (opts.q) p.set("q", opts.q);
  if (opts.tab === "live" || opts.tab === "Live") p.set("tab", "live");
  const qs = p.toString();
  return qs ? `/sports?${qs}` : "/sports";
}

function isLiveTab(tab?: string) {
  return (tab ?? "").toLowerCase() === "live";
}

export default async function SportsPage({ searchParams }: Props) {
  const sportSlug = resolveSportSlug(searchParams.sport);
  const sportFilter: SportNav | null =
    sportSlug === "all" ? null : sportNavFromSlug(sportSlug) ?? sportNavFromSlug(DEFAULT_SPORT_SLUG);
  const leagueFilter = searchParams.league ?? "";
  const q = (searchParams.q ?? "").trim();
  const liveOnly = isLiveTab(searchParams.tab);

  const [display, cachedLive, cachedUpcoming, apiLeagues] = await Promise.all([
    getDisplaySportsbookFeed({ liveLimit: 40, upcomingLimit: 80 }),
    process.env.ODDS_API_KEY ? readLivescores(120) : Promise.resolve([] as Match[]),
    process.env.ODDS_API_KEY ? readUpcoming(250) : Promise.resolve([] as Match[]),
    process.env.ODDS_API_KEY ? listActiveLeagues() : Promise.resolve([]),
  ]);

  const oddsPool = [...cachedLive, ...cachedUpcoming];
  const oddsLive = enrichLogos(cachedLive, display.live);
  const oddsUpcoming = enrichLogos(cachedUpcoming, display.upcoming);

  const displayLiveOdds = mergeOddsOntoDisplay(display.live, oddsPool).filter(hasListOdds);
  const displayUpcomingOdds = mergeOddsOntoDisplay(display.upcoming, oddsPool).filter(hasListOdds);

  let liveMatches = mergeByEventId(oddsLive, displayLiveOdds).map(withLeagueCrest);
  let upcomingMatches = mergeByEventId(oddsUpcoming, displayUpcomingOdds).map(withLeagueCrest);
  [liveMatches, upcomingMatches] = await Promise.all([
    attachMatchLogos(liveMatches, 64),
    attachMatchLogos(upcomingMatches, 96),
  ]);

  const allMatches = [...liveMatches, ...upcomingMatches];

  // Always show Football first, then other sports that have data.
  const sportsWithData = (() => {
    const counts = new Map<string, number>();
    for (const m of allMatches) {
      const slug = sportSlugFromKey(m.sportKey);
      if (!slug) continue;
      counts.set(slug, (counts.get(slug) ?? 0) + 1);
    }
    for (const l of apiLeagues) {
      const slug = sportSlugFromKey(l.key);
      if (slug && !counts.has(slug)) counts.set(slug, 0);
    }
    // Football always listed even if cache empty
    if (!counts.has("football")) counts.set("football", 0);
    return SPORT_NAV.filter((s) => counts.has(s.slug)).map((s) => ({
      ...s,
      count: counts.get(s.slug) ?? 0,
    }));
  })();

  const filterSport = (matches: Match[], nav: SportNav | null) =>
    nav ? matches.filter((m) => matchBelongsToSport(m.sportKey, nav)) : matches;

  const filterLeague = (matches: Match[]) =>
    leagueFilter
      ? matches.filter((m) => m.league.toLowerCase().includes(leagueFilter.toLowerCase()))
      : matches;

  let scopedLive = filterLeague(filterSport(liveMatches, sportFilter));
  let scopedUpcoming = filterLeague(filterSport(upcomingMatches, sportFilter));
  if (liveOnly) scopedUpcoming = [];

  const filteredLive = filterQ(scopedLive, q);
  const filteredUpcoming = liveOnly ? [] : filterQ(scopedUpcoming, q);

  const liveGroups = orderedLeagueGroups(filteredLive);
  const upcomingGroups = orderedLeagueGroups(filteredUpcoming);

  const displayLive = liveGroups.flatMap((g) => g.fixtures);
  const displayUpcoming = upcomingGroups.flatMap((g) => g.fixtures);

  const leagueStrip: { label: string; logo?: string }[] = (() => {
    if (!sportFilter) return [];
    const seen = new Set<string>();
    const out: { label: string; logo?: string }[] = [];
    const push = (label: string, logo?: string) => {
      if (!label || seen.has(label)) return;
      seen.add(label);
      out.push({ label, logo: logo ?? getLeagueLogo(label) });
    };
    push("All leagues");
    const inSport = allMatches.filter((m) => matchBelongsToSport(m.sportKey, sportFilter));
    for (const g of orderedLeagueGroups(inSport)) push(g.league, g.meta.leagueLogo);
    for (const l of apiLeagues) {
      if (!matchBelongsToSport(l.key, sportFilter)) continue;
      push(l.title, getLeagueLogo(l.title));
    }
    return out;
  })();

  const currentSportParam = sportSlug === "all" ? "all" : sportFilter?.slug;

  return (
    <AppShell rightPanel={<SportsBetSlip />}>
      <SportsLiveRefresh
        active={displayLive.length > 0 || liveOnly}
        initialIds={displayLive.map((m) => m.id)}
      />
      {/* Sticky: sports strip + professional search */}
      <div className="sticky top-0 z-30 border-b border-white/[0.06] bg-[#151518]/95 backdrop-blur-md">
        <div className="flex gap-2 overflow-x-auto no-scrollbar px-3 pt-2.5">
          <Link
            href={hrefSports({ sport: "all", q: q || undefined, tab: liveOnly ? "live" : undefined })}
            prefetch={false}
            className={`flex shrink-0 flex-col items-center gap-1 rounded-xl px-1 py-0.5 transition ${
              sportSlug === "all" ? "bg-white/[0.04]" : "hover:bg-white/[0.04]"
            }`}
          >
            <span
              className={`flex h-9 w-9 items-center justify-center rounded-full ring-1 ${
                sportSlug === "all" ? "ring-[#087cff] bg-[#087cff]/10" : "ring-white/[0.06] bg-white/[0.06]"
              }`}
            >
              <Icon
                name="apps"
                className={`text-[18px] ${sportSlug === "all" ? "text-[#6eb6ff]" : "text-slate-400"}`}
              />
            </span>
            <span
              className={`w-12 truncate text-center text-[9px] font-bold ${
                sportSlug === "all" ? "text-[#087cff]" : "text-slate-500"
              }`}
            >
              All
            </span>
          </Link>

          {sportsWithData.map((s) => {
            const active = sportFilter?.slug === s.slug;
            return (
              <Link
                key={s.slug}
                href={hrefSports({ sport: s.slug, q: q || undefined, tab: liveOnly ? "live" : undefined })}
                prefetch={false}
                className={`flex shrink-0 flex-col items-center gap-1 rounded-xl px-1 py-0.5 transition ${
                  active ? "bg-white/[0.04]" : "hover:bg-white/[0.04]"
                }`}
              >
                <span
                  className={`flex h-9 w-9 items-center justify-center rounded-full ring-1 ${
                    active
                      ? "ring-[#087cff] bg-[#087cff]/10"
                      : "ring-white/[0.06] bg-white/[0.06]"
                  }`}
                >
                  <span className="text-[20px] leading-none" aria-hidden>
                    {s.glyph}
                  </span>
                </span>
                <span
                  className={`w-14 truncate text-center text-[9px] font-bold leading-tight ${
                    active ? "text-[#087cff]" : "text-slate-500"
                  }`}
                  title={s.label}
                >
                  {s.label}
                </span>
              </Link>
            );
          })}
        </div>

        <form action="/sports" method="get" className="px-3 py-2.5">
          {currentSportParam && currentSportParam !== DEFAULT_SPORT_SLUG && (
            <input type="hidden" name="sport" value={currentSportParam} />
          )}
          {currentSportParam === "all" && <input type="hidden" name="sport" value="all" />}
          {leagueFilter && <input type="hidden" name="league" value={leagueFilter} />}
          {liveOnly && <input type="hidden" name="tab" value="live" />}
          <label className="flex h-10 w-full items-center gap-2.5 rounded-xl bg-white/[0.04] px-3.5 ring-1 ring-white/[0.06] transition focus-within:ring-[#087cff]/45">
            <Icon name="search" className="shrink-0 text-[20px] text-slate-500" />
            <input
              name="q"
              defaultValue={q}
              placeholder="Search teams or leagues"
              className="min-w-0 flex-1 bg-transparent text-[13px] font-medium text-white outline-none placeholder:text-slate-500"
            />
            {q ? (
              <Link
                href={hrefSports({
                  sport: currentSportParam === DEFAULT_SPORT_SLUG ? undefined : currentSportParam,
                  league: leagueFilter || undefined,
                  tab: liveOnly ? "live" : undefined,
                })}
                prefetch={false}
                className="shrink-0 text-[11px] font-black text-slate-400 transition hover:text-white"
              >
                Clear
              </Link>
            ) : null}
          </label>
        </form>
      </div>

      {/* Leagues for selected sport */}
      {sportFilter && leagueStrip.length > 0 && (
        <div className="border-b border-white/[0.06] bg-[#151518] px-3 py-2.5">
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            {leagueStrip.map((item) => {
              const isAll = item.label === "All leagues";
              const isActive = isAll
                ? !leagueFilter
                : leagueFilter === item.label ||
                  (!!leagueFilter && item.label.toLowerCase().includes(leagueFilter.toLowerCase()));
              const href = hrefSports({
                sport: sportFilter.slug,
                league: isAll || isActive ? undefined : item.label,
                q: q || undefined,
                tab: liveOnly ? "live" : undefined,
              });
              return (
                <Link
                  key={item.label}
                  href={href}
                  prefetch={false}
                  className={`flex shrink-0 flex-col items-center gap-1 rounded-xl px-1.5 py-1 transition ${
                    isActive ? "bg-white/[0.04]" : "hover:bg-white/[0.04]"
                  }`}
                >
                  <span
                    className={`flex h-9 w-9 items-center justify-center overflow-hidden rounded-full p-1.5 ring-1 ${
                      isActive ? "ring-[#087cff] bg-[#087cff]/10" : "ring-white/[0.06] bg-white/[0.06]"
                    }`}
                  >
                    {isAll ? (
                      <Icon
                        name="grid_view"
                        className={`text-[18px] ${isActive ? "text-[#6eb6ff]" : "text-slate-400"}`}
                      />
                    ) : item.logo ? (
                      <Image
                        src={item.logo}
                        alt=""
                        width={28}
                        height={28}
                        className="h-full w-full object-contain"
                        unoptimized
                      />
                    ) : (
                      <span className="text-[12px] font-black text-slate-300">{item.label.charAt(0)}</span>
                    )}
                  </span>
                  <span
                    className={`w-14 truncate text-center text-[9px] font-bold leading-tight ${
                      isActive ? "text-[#087cff]" : "text-slate-500"
                    }`}
                    title={item.label}
                  >
                    {isAll ? "All" : item.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      <div className="min-h-screen bg-[#151518] pb-28">
        {/* All / Live — wallet-style underline tabs */}
        <div className="flex items-center gap-6 border-b border-white/[0.06] px-3 sm:px-4">
          <Link
            href={hrefSports({
              sport: currentSportParam === DEFAULT_SPORT_SLUG ? undefined : currentSportParam,
              league: leagueFilter || undefined,
              q: q || undefined,
            })}
            prefetch={false}
            className={`relative py-2.5 text-[12px] font-black transition ${
              !liveOnly ? "text-white" : "text-slate-500 hover:text-white"
            }`}
          >
            All
            {!liveOnly && (
              <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-[#087cff]" />
            )}
          </Link>
          <Link
            href={hrefSports({
              sport: currentSportParam === DEFAULT_SPORT_SLUG ? undefined : currentSportParam,
              league: leagueFilter || undefined,
              q: q || undefined,
              tab: "live",
            })}
            prefetch={false}
            className={`relative inline-flex items-center gap-1.5 py-2.5 text-[12px] font-black transition ${
              liveOnly ? "text-[#ff1979]" : "text-slate-500 hover:text-white"
            }`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            Live
            {liveOnly && (
              <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-[#ff1979]" />
            )}
          </Link>
        </div>

        {displayLive.length > 0 && (
          <section className="pt-1">
            <div className="flex items-center gap-2 px-3 py-2.5 sm:px-4">
              <h2 className="flex items-center gap-2 text-[13px] font-black text-white">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#ff1979] opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-[#ff1979]" />
                </span>
                Live
                <span className="text-[11px] font-semibold text-slate-500">{displayLive.length}</span>
              </h2>
            </div>
            {liveGroups.map(({ league, meta, fixtures }) => (
              <div key={`live-${league}`}>
                <LeagueGroupHeader
                  league={league}
                  country={meta.country}
                  countryFlag={meta.countryFlag}
                  leagueLogo={meta.leagueLogo}
                  count={fixtures.length}
                />
                {fixtures.map((m) => (
                  <MatchRow key={m.id} match={m} />
                ))}
              </div>
            ))}
          </section>
        )}

        {displayUpcoming.length > 0 && (
          <section className={displayLive.length > 0 ? "mt-2" : "pt-1"}>
            <div className="px-3 py-2.5 sm:px-4">
              <h2 className="text-[13px] font-black text-white">Upcoming</h2>
            </div>
            {upcomingGroups.map(({ league, meta, fixtures }) => (
              <div key={`up-${league}`}>
                <LeagueGroupHeader
                  league={league}
                  country={meta.country}
                  countryFlag={meta.countryFlag}
                  leagueLogo={meta.leagueLogo}
                  count={fixtures.length}
                />
                {fixtures.map((m) => (
                  <MatchRow key={m.id} match={m} />
                ))}
              </div>
            ))}
          </section>
        )}

        {displayLive.length === 0 && displayUpcoming.length === 0 && (
          <div className="flex flex-col items-center justify-center px-6 py-24 text-center">
            <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white/[0.06]">
              <CircleDot size={36} className="text-slate-500" />
            </span>
            <p className="text-sm font-black text-white">
              {liveOnly
                ? "No live events right now"
                : q || leagueFilter
                  ? "No events match"
                  : "No fixtures right now"}
            </p>
            <p className="mt-1 max-w-sm text-[13px] text-slate-500">
              {liveOnly
                ? "Check back soon, or browse upcoming fixtures."
                : q || leagueFilter
                  ? "Try another league or clear search"
                  : "Check another sport or come back when games are listed."}
            </p>
            {(q || leagueFilter || liveOnly) && (
              <Link
                href={hrefSports({ sport: sportFilter?.slug ?? DEFAULT_SPORT_SLUG })}
                prefetch={false}
                className="mt-5 rounded-xl bg-[#087cff] px-5 py-2.5 text-[13px] font-black text-white"
              >
                {liveOnly ? "Show all fixtures" : "Clear filters"}
              </Link>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
