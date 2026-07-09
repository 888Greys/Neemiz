"use client";

import Link from "next/link";
import Image from "next/image";
import type { ListOdd, Match } from "@/lib/theoddsapi";
import { useBetslip } from "@/lib/betslip-context";
import { getTeamLogo } from "@/lib/team-logos";
import { getLeagueLogo } from "@/lib/league-logos";
import { Icon } from "@/components/icon";

function TeamCrest({ name, logo }: { name: string; logo?: string }) {
  const src = logo || getTeamLogo(name);
  if (src) {
    return (
      <Image
        src={src}
        alt=""
        width={28}
        height={28}
        className="h-7 w-7 shrink-0 object-contain"
        unoptimized
      />
    );
  }
  // Soft monogram — not a loud letter circle
  return (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/[0.08] text-[10px] font-black tracking-wide text-white/55 ring-1 ring-white/10">
      {name
        .split(/\s+/)
        .slice(0, 2)
        .map((w) => w[0])
        .join("")
        .toUpperCase()}
    </span>
  );
}

function MarketOddBtn({
  odd,
  matchId,
  matchName,
  market,
}: {
  odd: ListOdd;
  matchId: number;
  matchName: string;
  market: string;
}) {
  const { toggleBet, hasBet } = useBetslip();
  const id = `${matchId}-${market}-${odd.key}`.replace(/\s+/g, "_");
  const active = hasBet(id);

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        toggleBet({ id, matchName, market, label: odd.label, value: odd.value });
      }}
      className={`flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-2.5 transition active:scale-[0.97] ${
        active
          ? "bg-[#087cff] text-white shadow-md shadow-[#087cff]/25"
          : "bg-[#1c2433] text-white hover:bg-[#243044]"
      }`}
    >
      <span className={`max-w-full truncate text-[9px] font-bold uppercase tracking-wide ${active ? "text-white/80" : "text-slate-400"}`}>
        {odd.label}
      </span>
      <span className="text-[15px] font-black tabular-nums leading-none">{odd.value}</span>
    </button>
  );
}

function MarketBlock({
  title,
  odds,
  matchId,
  matchName,
  market,
  cols = 3,
}: {
  title: string;
  odds: ListOdd[];
  matchId: number;
  matchName: string;
  market: string;
  cols?: 2 | 3;
}) {
  if (odds.length === 0) return null;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between px-0.5">
        <span className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">{title}</span>
      </div>
      <div className={`grid gap-1 ${cols === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
        {odds.map((o) => (
          <MarketOddBtn key={o.key} odd={o} matchId={matchId} matchName={matchName} market={market} />
        ))}
      </div>
    </div>
  );
}

/** Derive SportPesa-style list markets when API only gave 1X2. */
function ensureListMarkets(m: Match) {
  if (m.listMarkets && (m.listMarkets.threeWay.length || m.listMarkets.overUnder.length)) {
    return m.listMarkets;
  }
  const threeWay = m.odds.map((o) => ({
    key: o.label,
    label: o.label === "1" ? m.home.name : o.label === "2" ? m.away.name : "DRAW",
    value: o.value,
  }));
  const o1 = parseFloat(m.odds.find((o) => o.label === "1")?.value ?? "");
  const ox = parseFloat(m.odds.find((o) => o.label === "X")?.value ?? "");
  const o2 = parseFloat(m.odds.find((o) => o.label === "2")?.value ?? "");
  let doubleChance: ListOdd[] = [];
  if (o1 > 1 && ox > 1 && o2 > 1) {
    const p1 = 1 / o1;
    const px = 1 / ox;
    const p2 = 1 / o2;
    const sum = p1 + px + p2;
    const n1 = p1 / sum;
    const nx = px / sum;
    const n2 = p2 / sum;
    const f = (p: number) => Math.max(1.01, 1 / p).toFixed(2);
    doubleChance = [
      { key: "1X", label: "1 OR X", value: f(n1 + nx) },
      { key: "X2", label: "X OR 2", value: f(nx + n2) },
      { key: "12", label: "1 OR 2", value: f(n1 + n2) },
    ];
  }
  return { threeWay, doubleChance, overUnder: [] as ListOdd[], btts: [] as ListOdd[] };
}

const MAX_VISIBLE_ODDS = 6;

type VisibleBlock = { title: string; market: string; odds: ListOdd[]; cols: 2 | 3 };

/** Cap card to 6 odds: 3-Way first, then Double Chance, then O/U / BTTS. */
function pickVisibleBlocks(markets: ReturnType<typeof ensureListMarkets>): {
  blocks: VisibleBlock[];
  shown: number;
  hiddenOdds: number;
} {
  const queue: VisibleBlock[] = [
    { title: "3 Way", market: "3 Way", odds: markets.threeWay, cols: 3 },
    { title: "Double Chance", market: "Double Chance", odds: markets.doubleChance, cols: 3 },
    { title: "Over/Under", market: "Over/Under", odds: markets.overUnder, cols: 2 },
    { title: "Both Teams Score", market: "BTTS", odds: markets.btts, cols: 2 },
  ].filter((b) => b.odds.length > 0);

  const totalOdds = queue.reduce((n, b) => n + b.odds.length, 0);
  const blocks: VisibleBlock[] = [];
  let budget = MAX_VISIBLE_ODDS;

  for (const b of queue) {
    if (budget <= 0) break;
    const take = b.odds.slice(0, budget);
    if (take.length === 0) continue;
    blocks.push({ ...b, odds: take, cols: take.length === 2 ? 2 : 3 });
    budget -= take.length;
  }

  const shown = MAX_VISIBLE_ODDS - budget;
  return { blocks, shown, hiddenOdds: Math.max(0, totalOdds - shown) };
}

/** SportPesa-style match card: teams + up to 6 odds, then +N more. */
export function MatchRow({ match: m }: { match: Match }) {
  const detailHref = `/sports/${m.id}`;
  const matchName = `${m.home.name} vs ${m.away.name}`;
  const markets = ensureListMarkets(m);
  const { blocks, shown } = pickVisibleBlocks(markets);
  const listGroups = [
    markets.threeWay,
    markets.doubleChance,
    markets.overUnder,
    markets.btts,
  ].filter((g) => g.length > 0).length;
  // Per-match +N from fixture data; never use the 6-odd leftover (that made every card +2).
  const moreCount =
    m.extraMarkets > 0 ? m.extraMarkets : Math.max(0, listGroups - blocks.length);

  const when = m.startingAt
    ? new Date(m.startingAt).toLocaleString("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Africa/Nairobi",
      })
    : m.period;

  return (
    <article className="border-b border-white/[0.06] bg-[#141820] px-3 py-3 sm:px-4">
      {/* Meta row */}
      <div className="mb-2.5 flex items-center gap-2 text-[11px]">
        {m.isLive ? (
          <span className="inline-flex items-center gap-1 rounded bg-[#ff1979]/15 px-1.5 py-0.5 text-[10px] font-black uppercase text-[#ff1979]">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#ff1979]" />
            {m.period}
          </span>
        ) : (
          <span className="font-bold text-slate-500">{when}</span>
        )}
        <span className="text-slate-700">|</span>
        <span className="font-bold text-slate-600">ID: {String(m.id).slice(-4)}</span>
      </div>

      {/* Teams */}
      <Link href={detailHref} prefetch={false} className="mb-3 block space-y-2">
        <div className="flex items-center gap-2.5">
          <TeamCrest name={m.home.name} logo={m.home.logo} />
          <span className="min-w-0 flex-1 truncate text-[14px] font-black text-white">{m.home.name}</span>
          {(m.isLive || m.home.score !== null) && (
            <span className="font-mono text-[15px] font-black tabular-nums text-white">{m.home.score ?? 0}</span>
          )}
        </div>
        <div className="flex items-center gap-2.5">
          <TeamCrest name={m.away.name} logo={m.away.logo} />
          <span className="min-w-0 flex-1 truncate text-[14px] font-black text-white">{m.away.name}</span>
          {(m.isLive || m.away.score !== null) && (
            <span className="font-mono text-[15px] font-black tabular-nums text-white">{m.away.score ?? 0}</span>
          )}
        </div>
      </Link>

      {/* Max 6 odds on the card */}
      {shown > 0 ? (
        <div className="space-y-2.5">
          {blocks.map((b) => (
            <MarketBlock
              key={b.market}
              title={b.title}
              odds={b.odds}
              matchId={m.id}
              matchName={matchName}
              market={b.market}
              cols={b.cols}
            />
          ))}
          {moreCount > 0 && (
            <Link
              href={detailHref}
              prefetch={false}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-white/[0.04] py-2.5 text-[12px] font-black text-[#6eb6ff] ring-1 ring-white/[0.06] transition hover:bg-white/[0.07] hover:text-white"
            >
              +{moreCount} more markets
              <Icon name="chevron_right" className="text-[14px]" />
            </Link>
          )}
        </div>
      ) : (
        <Link
          href={detailHref}
          prefetch={false}
          className="flex w-full items-center justify-center rounded-xl bg-[#1c2433] py-3 text-[12px] font-black text-slate-300 transition hover:bg-[#243044]"
        >
          Open markets
        </Link>
      )}
    </article>
  );
}

export function LeagueGroupHeader({
  league,
  country,
  countryFlag,
  leagueLogo,
  count,
}: {
  league: string;
  country?: string;
  countryFlag?: string;
  leagueLogo?: string;
  count: number;
}) {
  const crest = leagueLogo || getLeagueLogo(league);
  return (
    <div className="sticky top-[108px] z-20 flex items-center gap-2 border-b border-white/[0.06] bg-[#0e0f14]/95 px-3 py-2.5 backdrop-blur-sm sm:px-4">
      {crest ? (
        <Image src={crest} alt="" width={20} height={20} className="h-5 w-5 object-contain" unoptimized />
      ) : countryFlag ? (
        <Image src={countryFlag} alt="" width={18} height={18} className="h-[18px] w-[18px] rounded-sm object-cover" unoptimized />
      ) : null}
      <span className="min-w-0 flex-1 truncate text-[13px] font-black text-white">{league}</span>
      {country && <span className="hidden text-[11px] text-slate-500 sm:inline">{country}</span>}
      <span className="text-[11px] font-bold text-slate-600">{count}</span>
    </div>
  );
}
