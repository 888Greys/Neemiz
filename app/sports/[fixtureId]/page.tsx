import { AppShell } from "@/components/app-shell";
import { SportsBetSlip } from "@/components/sports-bet-slip";
import { getFixtureDetail, type MatchEvent, type LineupEntry } from "@/lib/sportmonks";
import { MarketsSection } from "@/components/markets-section";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Clock, Radio } from "lucide-react";

type Props = { params: { fixtureId: string } };

export default async function FixtureDetailPage({ params }: Props) {
  const id = Number(params.fixtureId);
  if (isNaN(id)) notFound();

  const detail = await getFixtureDetail(id);
  if (!detail) notFound();

  const { match: m, homeParticipantId, events, stats, homeLineup, awayLineup, homePeriodScores, awayPeriodScores, markets } = detail;

  return (
    <AppShell rightPanel={<SportsBetSlip />} mainBg="bg-[#f4f6fa]">
      {/* ── Back bar ── */}
      <div className="sticky top-0 z-30 flex items-center gap-3 border-b border-slate-200 bg-white px-3 py-2.5">
        <Link href="/sports" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 transition hover:bg-slate-200">
          <ChevronLeft size={20} />
        </Link>
        <div className="flex items-center gap-2 min-w-0">
          {m.countryFlag && (
            <Image src={m.countryFlag} alt={m.country} width={18} height={18} className="h-[18px] w-[18px] shrink-0 rounded-sm object-cover" unoptimized />
          )}
          {m.leagueLogo && (
            <Image src={m.leagueLogo} alt={m.league} width={18} height={18} className="h-[18px] w-[18px] shrink-0 object-contain" unoptimized />
          )}
          <span className="truncate text-[13px] font-black text-[#1a1a2e]">{m.league}</span>
          {m.country && <span className="shrink-0 text-[13px] text-slate-400">· {m.country}</span>}
        </div>
      </div>

      <div className="mx-auto w-full max-w-3xl space-y-3 px-3 py-4 pb-10">
        {/* ── Match header ── */}
        <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-black/[0.08]">
          <div className="px-5 pt-5 pb-4">
            {/* Teams + score */}
            <div className="flex items-center gap-3">
              {/* Home */}
              <div className="flex flex-1 flex-col items-center gap-2">
                <TeamLogo logo={m.home.logo} name={m.home.name} size={52} />
                <span className="text-center text-[13px] font-black text-[#1a1a2e] leading-tight">{m.home.name}</span>
              </div>

              {/* Score / time */}
              <div className="flex flex-col items-center gap-1 px-2">
                {m.isLive || m.home.score !== null ? (
                  <div className="flex items-center gap-2 text-[36px] font-black text-[#1a1a2e] leading-none tabular-nums">
                    <span>{m.home.score ?? 0}</span>
                    <span className="text-slate-300">:</span>
                    <span>{m.away.score ?? 0}</span>
                  </div>
                ) : (
                  <div className="text-[28px] font-black text-[#1a1a2e]">vs</div>
                )}
                {/* Period badge */}
                <span className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-black ${
                  m.isLive ? "bg-red-50 text-red-500" : "bg-slate-100 text-slate-500"
                }`}>
                  {m.isLive && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />}
                  {m.isLive ? <Radio size={11} /> : <Clock size={11} />}
                  {m.period}
                </span>
              </div>

              {/* Away */}
              <div className="flex flex-1 flex-col items-center gap-2">
                <TeamLogo logo={m.away.logo} name={m.away.name} size={52} />
                <span className="text-center text-[13px] font-black text-[#1a1a2e] leading-tight">{m.away.name}</span>
              </div>
            </div>

            {/* Half scores */}
            {(homePeriodScores[0] !== null || homePeriodScores[1] !== null) && (
              <div className="mt-4 rounded-xl bg-slate-50 px-4 py-2.5">
                <div className="grid grid-cols-[1fr_auto_auto] gap-x-6 text-[12px]">
                  <div />
                  <span className="text-center font-bold text-slate-400">1H</span>
                  <span className="text-center font-bold text-slate-400">2H</span>

                  <span className="font-bold text-[#1a1a2e] truncate">{m.home.name}</span>
                  <span className="text-center font-black text-[#1a1a2e]">{homePeriodScores[0] ?? "-"}</span>
                  <span className="text-center font-black text-[#1a1a2e]">{homePeriodScores[1] ?? "-"}</span>

                  <span className="font-bold text-[#1a1a2e] truncate">{m.away.name}</span>
                  <span className="text-center font-black text-[#1a1a2e]">{awayPeriodScores[0] ?? "-"}</span>
                  <span className="text-center font-black text-[#1a1a2e]">{awayPeriodScores[1] ?? "-"}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Betting markets ── */}
        {markets.length > 0 && <MarketsSection markets={markets} />}

        {/* ── Events timeline ── */}
        {events.length > 0 && (
          <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-black/[0.08]">
            <SectionTitle label="Match Events" />
            <div className="divide-y divide-slate-100 px-4 pb-2">
              {events.map((ev) => (
                <EventRow key={ev.id} event={ev} isHome={ev.participant_id === homeParticipantId} />
              ))}
            </div>
          </div>
        )}

        {/* ── Statistics ── */}
        {stats.length > 0 && (
          <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-black/[0.08]">
            <SectionTitle label="Match Statistics" />
            <div className="space-y-3 px-4 pb-4">
              {stats.map((s) => (
                <StatBar key={s.name} stat={s} />
              ))}
            </div>
          </div>
        )}

        {/* ── Lineups ── */}
        {(homeLineup.length > 0 || awayLineup.length > 0) && (
          <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-black/[0.08]">
            <SectionTitle label="Lineups" />
            <div className="grid grid-cols-2 divide-x divide-slate-100 px-0 pb-4">
              <LineupColumn title={m.home.name} logo={m.home.logo} players={homeLineup} />
              <LineupColumn title={m.away.name} logo={m.away.logo} players={awayLineup} />
            </div>
          </div>
        )}

        {/* Empty state if no extra data */}
        {events.length === 0 && stats.length === 0 && homeLineup.length === 0 && (
          <div className="rounded-2xl bg-white ring-1 ring-black/[0.08] py-16 text-center">
            <p className="text-sm text-slate-400">Match data will appear once the game starts</p>
          </div>
        )}
      </div>
    </AppShell>
  );
}

// ── Section title ──────────────────────────────────────────────────────────────

function SectionTitle({ label }: { label: string }) {
  return (
    <div className="px-4 py-3 border-b border-slate-100">
      <span className="text-[13px] font-black text-[#1a1a2e] uppercase tracking-wide">{label}</span>
    </div>
  );
}

// ── Team logo ─────────────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  "#e63946","#f4a261","#2a9d8f","#457b9d","#6d6875",
  "#8338ec","#fb5607","#3a86ff","#06d6a0","#ef233c",
];

function TeamLogo({ logo, name, size }: { logo?: string; name: string; size: number }) {
  if (logo) {
    return (
      <Image src={logo} alt={name} width={size} height={size}
        className="object-contain" style={{ width: size, height: size }} unoptimized />
    );
  }
  const idx = name.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_COLORS.length;
  return (
    <span className="flex shrink-0 items-center justify-center rounded-full text-white font-black"
      style={{ width: size, height: size, fontSize: size * 0.38, backgroundColor: AVATAR_COLORS[idx] }}>
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

// ── Event row ─────────────────────────────────────────────────────────────────

const EVENT_META: Record<number, { icon: string; color: string; label: string }> = {
  14: { icon: "⚽", color: "text-emerald-600", label: "Goal" },
  15: { icon: "⚽", color: "text-orange-500", label: "Own Goal" },
  16: { icon: "🟥", color: "text-red-600", label: "Red Card" },
  17: { icon: "🟨🟥", color: "text-red-500", label: "2nd Yellow" },
  18: { icon: "🔄", color: "text-blue-500", label: "Substitution" },
  19: { icon: "🟨", color: "text-yellow-500", label: "Yellow Card" },
};

function EventRow({ event: ev, isHome }: { event: MatchEvent; isHome: boolean }) {
  const meta = EVENT_META[ev.type_id] ?? { icon: "•", color: "text-slate-400", label: "" };
  const minute = `${ev.minute}${ev.extra_minute ? `+${ev.extra_minute}` : ""}'`;
  const isSub = ev.type_id === 18;

  return (
    <div className={`flex items-start gap-3 py-2.5 ${isHome ? "flex-row" : "flex-row-reverse"}`}>
      {/* Minute */}
      <span className="w-10 shrink-0 text-[11px] font-black text-slate-400 tabular-nums pt-0.5 text-center">{minute}</span>

      {/* Icon */}
      <span className="shrink-0 text-[16px] leading-none pt-0.5">{meta.icon}</span>

      {/* Player names */}
      <div className={`flex-1 min-w-0 ${isHome ? "" : "text-right"}`}>
        <div className="text-[13px] font-black text-[#1a1a2e] truncate">
          {isSub ? ev.related_player_name ?? ev.player_name : ev.player_name}
          {ev.result && <span className="ml-1.5 text-[11px] font-bold text-slate-400">({ev.result})</span>}
        </div>
        {isSub && ev.related_player_name && (
          <div className="text-[11px] text-slate-400 truncate">↑ {ev.player_name}</div>
        )}
        {!isSub && ev.info && (
          <div className="text-[11px] text-slate-400 truncate">{ev.info}</div>
        )}
      </div>
    </div>
  );
}

// ── Stat bar ─────────────────────────────────────────────────────────────────

function StatBar({ stat }: { stat: { name: string; home: number | null; away: number | null } }) {
  const h = stat.home ?? 0;
  const a = stat.away ?? 0;
  const total = h + a;
  const homeWidth = total > 0 ? Math.round((h / total) * 100) : 50;
  const awayWidth = 100 - homeWidth;

  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[12px]">
        <span className="font-black text-[#1a1a2e] tabular-nums">{h}</span>
        <span className="font-bold text-slate-400">{stat.name}</span>
        <span className="font-black text-[#1a1a2e] tabular-nums">{a}</span>
      </div>
      <div className="flex h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div className="rounded-full bg-[#087cff] transition-all" style={{ width: `${homeWidth}%` }} />
        <div className="rounded-full bg-[#e63946] transition-all" style={{ width: `${awayWidth}%` }} />
      </div>
    </div>
  );
}

// ── Lineup column ─────────────────────────────────────────────────────────────

function LineupColumn({ title, logo, players }: { title: string; logo?: string; players: LineupEntry[] }) {
  const starters = players.filter((p) => !p.on_bench);
  const bench = players.filter((p) => p.on_bench);

  return (
    <div className="px-3 pt-2">
      <div className="mb-2 flex items-center gap-1.5">
        {logo && <Image src={logo} alt={title} width={16} height={16} className="h-4 w-4 object-contain" unoptimized />}
        <span className="truncate text-[11px] font-black text-slate-500 uppercase">{title}</span>
      </div>

      {starters.map((p) => (
        <PlayerRow key={p.player_id} player={p} />
      ))}

      {bench.length > 0 && (
        <>
          <div className="my-1.5 text-[10px] font-bold text-slate-400 uppercase">Bench</div>
          {bench.map((p) => (
            <PlayerRow key={p.player_id} player={p} dim />
          ))}
        </>
      )}
    </div>
  );
}

function PlayerRow({ player: p, dim = false }: { player: LineupEntry; dim?: boolean }) {
  return (
    <div className={`flex items-center gap-1.5 py-1 ${dim ? "opacity-60" : ""}`}>
      <span className="w-5 shrink-0 text-right text-[10px] font-bold text-slate-400 tabular-nums">
        {p.jersey_number ?? ""}
      </span>
      <span className="min-w-0 truncate text-[12px] font-bold text-[#1a1a2e]">{p.player_name}</span>
    </div>
  );
}
