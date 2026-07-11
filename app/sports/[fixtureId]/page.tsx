import { AppShell } from "@/components/app-shell";
import { SportsBetSlip } from "@/components/sports-bet-slip";
import { type MatchEvent, type LineupEntry, type Match } from "@/lib/theoddsapi";
import { readFixtureDetail } from "@/lib/fixtures-cache";
import { getDisplayFixture } from "@/lib/apisports";
import { MarketsSection } from "@/components/markets-section";
import { FixtureExtras } from "@/components/fixture-extras";
import { LiveFixtureRefresh } from "@/components/live-fixture-refresh";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getTeamLogo } from "@/lib/team-logos";

type Props = { params: { fixtureId: string } };

export default async function FixtureDetailPage({ params }: Props) {
  const id = Number(params.fixtureId);
  if (isNaN(id)) notFound();

  // Cache / display only — never call Odds API on page views (4k+ users).
  const detail = await readFixtureDetail(id);
  let match: Match | null = detail?.match ?? null;
  let markets = detail?.markets ?? [];
  let events: MatchEvent[] = detail?.events ?? [];
  let stats = detail?.stats ?? [];
  let homeLineup: LineupEntry[] = detail?.homeLineup ?? [];
  let awayLineup: LineupEntry[] = detail?.awayLineup ?? [];
  let homeParticipantId = detail?.homeParticipantId ?? 0;
  let homePeriodScores = detail?.homePeriodScores ?? [null, null];
  let awayPeriodScores = detail?.awayPeriodScores ?? [null, null];
  let displayOnly = false;

  if (!match) {
    const display = await getDisplayFixture(id);
    if (!display) notFound();
    match = display;
    displayOnly = true;
  }

  const m = match;
  const homeLogo = m.home.logo ?? getTeamLogo(m.home.name);
  const awayLogo = m.away.logo ?? getTeamLogo(m.away.name);

  const kickoff = m.startingAt
    ? new Date(m.startingAt).toLocaleString("en-GB", {
        weekday: "short",
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Africa/Nairobi",
      })
    : m.period;

  return (
    <AppShell rightPanel={<SportsBetSlip />}>
      {/* Sticky header */}
      <div className="sticky top-0 z-30 flex items-center gap-3 border-b border-white/[0.06] bg-[#151518]/95 px-3 py-2.5 backdrop-blur-md">
        <Link
          href={m.isLive ? "/sports?tab=live" : "/sports"}
          prefetch={false}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.07] text-slate-300 transition hover:bg-white/[0.12]"
        >
          <ChevronLeft size={20} />
        </Link>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {m.countryFlag && (
            <Image
              src={m.countryFlag}
              alt=""
              width={18}
              height={18}
              className="h-[18px] w-[18px] shrink-0 rounded-sm object-cover"
              unoptimized
            />
          )}
          {m.leagueLogo && (
            <Image
              src={m.leagueLogo}
              alt=""
              width={18}
              height={18}
              className="h-[18px] w-[18px] shrink-0 object-contain"
              unoptimized
            />
          )}
          <div className="min-w-0">
            <p className="truncate text-[13px] font-black text-white">{m.league}</p>
            <p className="truncate text-[10px] font-bold text-slate-500">
              {m.isLive
                ? m.period && m.period.toLowerCase() !== "live"
                  ? m.period
                  : "Live"
                : kickoff}
            </p>
          </div>
        </div>
      </div>

      <LiveFixtureRefresh
        active={m.isLive}
        fixtureId={id}
        initial={{
          homeName: m.home.name,
          awayName: m.away.name,
          homeLogo,
          awayLogo,
          homeScore: m.home.score,
          awayScore: m.away.score,
          period: m.period,
          isLive: m.isLive,
          homePeriodScores,
          awayPeriodScores,
        }}
      />

      <div className="mx-auto w-full max-w-3xl pb-28">
        {displayOnly && (
          <div className="mx-3 mt-3 rounded-xl bg-amber-500/10 px-4 py-3 text-[12px] font-medium text-amber-200/90 ring-1 ring-amber-400/20">
            Score is from the free live feed. Betting markets for this fixture aren’t available yet — try another live match.
            <Link href="/sports?tab=live" prefetch={false} className="mt-1.5 block font-black text-[#6eb6ff]">
              Browse live markets →
            </Link>
          </div>
        )}

        {markets.length > 0 ? (
          <MarketsSection
            markets={markets}
            fixtureId={id}
            matchName={`${m.home.name} vs ${m.away.name}`}
            homeName={m.home.name}
            awayName={m.away.name}
          />
        ) : (
          !displayOnly && (
            <div className="mx-3 mt-6 rounded-xl bg-white/[0.04] px-4 py-12 text-center ring-1 ring-white/[0.06]">
              <p className="text-[14px] font-black text-white">No markets on this fixture</p>
              <p className="mx-auto mt-2 max-w-sm text-[12px] font-medium leading-relaxed text-slate-400">
                Odds may still be loading, or this match isn’t priced yet. Jump into live games that already have markets.
              </p>
              <Link
                href="/sports?tab=live"
                prefetch={false}
                className="mt-4 inline-block rounded-lg bg-[#087cff] px-4 py-2.5 text-[12px] font-black text-white transition hover:bg-[#0a6ef0]"
              >
                Browse live markets
              </Link>
            </div>
          )
        )}

        <div className="px-3 pt-3">
          <FixtureExtras
            events={events}
            stats={stats}
            homeLineup={homeLineup}
            awayLineup={awayLineup}
            homeName={m.home.name}
            awayName={m.away.name}
            homeLogo={homeLogo}
            awayLogo={awayLogo}
            homeParticipantId={homeParticipantId}
          />
        </div>
      </div>
    </AppShell>
  );
}
