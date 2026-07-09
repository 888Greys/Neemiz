import { AppShell } from "@/components/app-shell";
import { SportsBetSlip } from "@/components/sports-bet-slip";
import { type MatchEvent, type LineupEntry, type Match } from "@/lib/theoddsapi";
import { readFixtureDetail } from "@/lib/fixtures-cache";
import { getDisplayFixture } from "@/lib/apisports";
import { MarketsSection } from "@/components/markets-section";
import { FixtureExtras } from "@/components/fixture-extras";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getTeamLogo } from "@/lib/team-logos";

type Props = { params: { fixtureId: string } };

function TeamCrest({ name, logo, size = 36 }: { name: string; logo?: string; size?: number }) {
  if (logo) {
    return (
      <Image
        src={logo}
        alt=""
        width={size}
        height={size}
        className="shrink-0 object-contain"
        style={{ width: size, height: size }}
        unoptimized
      />
    );
  }
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full bg-white/[0.08] font-black tracking-wide text-white/55 ring-1 ring-white/10"
      style={{ width: size, height: size, fontSize: size * 0.32 }}
    >
      {name
        .split(/\s+/)
        .slice(0, 2)
        .map((w) => w[0])
        .join("")
        .toUpperCase()}
    </span>
  );
}

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
      <div className="sticky top-0 z-30 flex items-center gap-3 border-b border-white/10 bg-[#0e0f14]/95 px-3 py-2.5 backdrop-blur-md">
        <Link
          href="/sports"
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
              {m.isLive ? m.period : kickoff}
              <span className="text-slate-700"> · </span>
              ID {String(m.id).slice(-4)}
            </p>
          </div>
        </div>
      </div>

      {/* Compact scoreboard — same language as list cards */}
      <div className="sticky top-[52px] z-20 border-b border-white/[0.06] bg-[#141820]/95 px-4 py-3.5 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <TeamCrest name={m.home.name} logo={homeLogo} size={36} />
            <span className="min-w-0 flex-1 truncate text-[14px] font-black text-white">{m.home.name}</span>
            {(m.isLive || m.home.score !== null) && (
              <span className="font-mono text-[20px] font-black tabular-nums text-white">
                {m.home.score ?? 0}
              </span>
            )}
          </div>

          <div className="flex shrink-0 flex-col items-center gap-1 px-1">
            {m.isLive ? (
              <span className="inline-flex items-center gap-1 rounded bg-[#ff1979]/15 px-1.5 py-0.5 text-[9px] font-black uppercase text-[#ff1979]">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#ff1979]" />
                {m.period}
              </span>
            ) : m.home.score !== null ? (
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">FT</span>
            ) : (
              <span className="text-[11px] font-black text-slate-600">VS</span>
            )}
          </div>

          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            {(m.isLive || m.away.score !== null) && (
              <span className="font-mono text-[20px] font-black tabular-nums text-white">
                {m.away.score ?? 0}
              </span>
            )}
            <span className="min-w-0 flex-1 truncate text-right text-[14px] font-black text-white">
              {m.away.name}
            </span>
            <TeamCrest name={m.away.name} logo={awayLogo} size={36} />
          </div>
        </div>

        {(homePeriodScores[0] !== null || homePeriodScores[1] !== null) && (
          <div className="mx-auto mt-2.5 flex max-w-xs justify-center gap-6 text-[11px] font-bold text-slate-500">
            <span>
              1H {homePeriodScores[0] ?? "-"}–{awayPeriodScores[0] ?? "-"}
            </span>
            <span>
              2H {homePeriodScores[1] ?? "-"}–{awayPeriodScores[1] ?? "-"}
            </span>
          </div>
        )}
      </div>

      <div className="mx-auto w-full max-w-3xl pb-28">
        {displayOnly && (
          <div className="mx-3 mt-3 rounded-xl bg-amber-500/10 px-4 py-3 text-[12px] font-medium text-amber-200/90 ring-1 ring-amber-400/20">
            Live score from free feed. Betting markets appear when this fixture is in the odds cache.
            <Link href="/sports?tab=Live" prefetch={false} className="mt-1 block font-black text-[#6eb6ff]">
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
            <div className="mx-3 mt-6 rounded-xl bg-[#1c2433] py-12 text-center">
              <p className="text-[13px] font-bold text-slate-400">Markets unavailable for this fixture</p>
              <Link
                href="/sports"
                prefetch={false}
                className="mt-3 inline-block text-[12px] font-black text-[#087cff]"
              >
                Back to sports
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
