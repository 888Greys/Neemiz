"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import { ArrowLeft, ArrowRight, Bookmark, ChevronDown, ChevronRight, Code2, Flame, Link2, MessageCircle, Search, Settings, Trophy, TrendingUp, Zap } from "lucide-react";
import { formatEndDate, formatMarketMoney, formatMarketMoneyKes } from "./market-card";
import { ProbabilityChart } from "./probability-chart";
import { toast }      from "@/lib/toast";
import type { PolymarketMarket } from "@/lib/polymarket";
import { createClient } from "@/lib/supabase/client";
import { useCurrency, useMoney } from "@/lib/currency-context";

const TAGS = [
  "Trending", "Breaking", "New",
  "Politics", "Sports", "Crypto",
  "Esports", "Iran", "Finance",
  "Geopolitics", "Tech", "Culture",
  "Economy", "Weather", "Mentions", "Elections",
];

interface MyBet {
  id:           string;
  marketId:     string;
  question:     string;
  outcome:      string;
  price:        number;
  stake:        number;
  potentialWin: number;
  status:       string;
  winAmount:    number | null;
  executionMode: string;
  clobOrderId:  string | null;
  clobStatus:   string | null;
  settledAt:    string | null;
  createdAt:    string;
}

interface Props {
  userId?:  string;
  balance:  number;
  initialMarkets?: PolymarketMarket[];
}

interface DetailComment {
  id: string;
  authorId: string;
  author: string;
  avatarUrl: string | null;
  body: string;
  createdAt: Date;
  holder?: string | null;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    PENDING: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    WON:     "bg-[#31c45d]/10 text-[#31c45d] border-[#31c45d]/20",
    LOST:    "bg-red-500/10 text-red-400 border-red-500/20",
    VOID:    "bg-white/10 text-white/40 border-white/10",
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-black ${map[status] ?? map.PENDING}`}>
      {status}
    </span>
  );
}

/* ── Scrolling news ticker ──────────────────────────────────────────────── */
const SOURCES = ["Polymarket", "Reuters", "AP News", "Bloomberg", "WSJ", "BBC", "CNN"];
const TIMEAGO = ["just now", "2m ago", "5m ago", "12m ago", "28m ago", "1h ago", "2h ago", "3h ago"];

function NewsTicker({ markets }: { markets: PolymarketMarket[] }) {
  // Double the list so seamless loop works
  const items = useMemo(() => {
    const base = markets.slice(0, 12).map((m, i) => ({
      id:     m.conditionId,
      source: SOURCES[i % SOURCES.length],
      time:   TIMEAGO[i % TIMEAGO.length],
      title:  m.question,
      vol:    `${formatMarketMoney(m.volume)} / ${formatMarketMoneyKes(m.volume)}`,
    }));
    return [...base, ...base]; // duplicate for seamless CSS loop
  }, [markets]);

  if (!items.length) return null;

  const single = items.length / 2; // height of one full list in items
  const itemH  = 60; // px per item
  const totalH = single * itemH;

  return (
    <div className="relative overflow-hidden" style={{ height: Math.min(totalH, 180) }}>
      <div
        className="flex flex-col"
        style={{
          animation: `nz-ticker-scroll ${single * 3}s linear infinite`,
        }}
      >
        {items.map((item, i) => (
          <div key={`${item.id}-${i}`} className="flex items-start gap-2 py-2" style={{ minHeight: itemH }}>
            <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded bg-white/[0.07] text-[8px] font-black text-white/40">
              {item.source[0]}
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold text-white/30">
                {item.source} · {item.time}
              </p>
              <p className="text-[11px] font-semibold leading-snug text-white/60 line-clamp-2">
                {item.title}
              </p>
              <p className="text-[10px] text-white/20">{item.vol} Vol</p>
            </div>
          </div>
        ))}
      </div>

      {/* Fade out bottom */}
      <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-[#1a1b22] to-transparent" />

      <style>{`
        @keyframes nz-ticker-scroll {
          0%   { transform: translateY(0); }
          100% { transform: translateY(-${totalH}px); }
        }
      `}</style>
    </div>
  );
}

/* ── Countdown timer ────────────────────────────────────────────────────── */
function Countdown({ endDate }: { endDate: string }) {
  const [left, setLeft] = useState("");
  useEffect(() => {
    function tick() {
      const ms = new Date(endDate).getTime() - Date.now();
      if (ms <= 0) { setLeft("Ended"); return; }
      const h = Math.floor(ms / 3_600_000);
      const m = Math.floor((ms % 3_600_000) / 60_000);
      const s = Math.floor((ms % 60_000) / 1_000);
      setLeft(h > 0 ? `${h}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}` : `${m}:${String(s).padStart(2,"0")}`);
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [endDate]);
  return <span className="font-black text-red-400 tabular-nums">{left}</span>;
}


/* ── Hero featured card ─────────────────────────────────────────────────── */
function HeroCard({ market, allMarkets, onBet, onOpen }: { market: PolymarketMarket; allMarkets: PolymarketMarket[]; onBet: (m: PolymarketMarket, o?: string) => void; onOpen: (m: PolymarketMarket) => void }) {
  const yesIdx  = market.outcomes.findIndex((o) => o.toLowerCase() === "yes");
  const noIdx   = market.outcomes.findIndex((o) => o.toLowerCase() === "no");
  const yesP    = Math.max(0.01, yesIdx >= 0 ? market.outcomePrices[yesIdx] : market.outcomePrices[0] ?? 0.5);
  const noP     = Math.max(0.01, noIdx  >= 0 ? market.outcomePrices[noIdx]  : market.outcomePrices[1] ?? 1 - yesP);
  const yesLbl  = yesIdx >= 0 ? market.outcomes[yesIdx] : market.outcomes[0] ?? "Yes";
  const noLbl   = noIdx  >= 0 ? market.outcomes[noIdx]  : market.outcomes[1] ?? "No";
  const yesMult = yesP > 0 ? (1 / yesP).toFixed(2) : "—";
  const noMult  = noP  > 0 ? (1 / noP).toFixed(2)  : "—";

  return (
    <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-[#18191f]">
      {/* ── Top header row ── */}
      <div
        onClick={() => onOpen(market)}
        className="flex cursor-pointer items-center justify-between gap-4 border-b border-white/[0.06] px-5 pt-4 pb-3 transition hover:bg-[#1c1d24]"
      >
        <div className="flex items-center gap-3">
          {market.image ? (
            <Image src={market.image} alt="" width={36} height={36} unoptimized className="h-9 w-9 shrink-0 rounded-xl object-cover" />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#087cff]/30 text-sm font-black text-[#8bc3ff]">?</div>
          )}
          <div>
            <p className="text-sm font-black leading-tight text-white sm:text-base">{market.question}</p>
            <p className="text-[11px] text-white/35">{formatEndDate(market.endDate)} · {market.tags.slice(0,2).join(" · ")}</p>
          </div>
        </div>
        <div className="hidden items-center gap-8 sm:flex">
          <div className="text-right">
            <p className="text-[10px] font-bold text-white/35">Top outcome</p>
            <p className="text-base font-black text-white">{(yesP * 100).toFixed(0)}%</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-bold text-white/35">Ends in</p>
            <p className="text-base"><Countdown endDate={market.endDate} /></p>
          </div>
        </div>
      </div>

      {/* ── Outcome buttons + chart ── */}
      <div className="grid grid-cols-1 gap-0 sm:grid-cols-[300px_1fr]">
        {/* Mobile: compact inline YES/NO row */}
        <div className="flex items-center gap-2 border-r border-white/[0.06] px-4 py-3 sm:hidden">
          <button
            onClick={() => onBet(market, yesLbl)}
            className="flex flex-1 items-center justify-between rounded-xl bg-[#087cff]/25 px-3 py-2 transition active:scale-95 hover:bg-[#087cff]/35"
          >
            <span className="text-xs font-black uppercase tracking-wide text-[#8bc3ff]">{yesLbl}</span>
            <span className="text-sm font-black text-white">{yesMult}×</span>
          </button>
          <button
            onClick={() => onBet(market, noLbl)}
            className="flex flex-1 items-center justify-between rounded-xl bg-white/[0.07] px-3 py-2 transition hover:bg-white/[0.11] active:scale-95"
          >
            <span className="text-xs font-black uppercase tracking-wide text-white/60">{noLbl}</span>
            <span className="text-sm font-black text-white/50">{noMult}×</span>
          </button>
          <span className="ml-1 shrink-0 text-[10px] font-bold text-white/20">
            {formatMarketMoney(market.volume)}
          </span>
        </div>

        {/* Desktop: full-width stacked buttons + ticker + vol */}
        <div className="hidden flex-col gap-3 border-r border-white/[0.06] p-5 sm:flex">
          <button
            onClick={() => onBet(market, yesLbl)}
            className="flex h-10 items-center justify-between rounded-xl bg-[#087cff]/25 px-4 transition hover:bg-[#087cff]/35"
          >
            <span className="text-sm font-black uppercase tracking-wide text-[#8bc3ff]">{yesLbl}</span>
            <span className="text-base font-black text-white">{yesMult}×</span>
          </button>
          <button
            onClick={() => onBet(market, noLbl)}
            className="flex h-10 items-center justify-between rounded-xl bg-white/[0.07] px-4 transition hover:bg-white/[0.11]"
          >
            <span className="text-sm font-black uppercase tracking-wide text-white/60">{noLbl}</span>
            <span className="text-base font-black text-white/50">{noMult}×</span>
          </button>
          <div className="mt-1 flex-1 overflow-hidden">
            <NewsTicker markets={allMarkets} />
          </div>
          <div className="mt-auto pt-2 text-[11px] font-bold text-white/25">
            {formatMarketMoney(market.volume)} / {formatMarketMoneyKes(market.volume)} Vol.
          </div>
        </div>

        {/* Chart — hidden on mobile */}
        <div className="hidden flex-col gap-0 sm:flex">
          <div className="px-5 pt-4 pb-3">
            {market.clobTokenIds.length > 0 ? (
              <ProbabilityChart
                tokenIds={market.clobTokenIds}
                outcomes={market.outcomes}
              />
            ) : (
              <p className="py-8 text-center text-[12px] text-white/25">No chart data available</p>
            )}
          </div>
          <div className="flex items-center justify-between border-t border-white/[0.05] px-5 py-2">
            <span className="flex items-center gap-1.5 text-[11px] text-white/30">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
              LIVE
            </span>
            <span className="text-[11px] font-bold text-white/20">Nezeem Predictions</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Hero carousel ──────────────────────────────────────────────────────── */
const CAROUSEL_MS = 9500;

function HeroCarousel({ markets, allMarkets, onBet, onOpen }: { markets: PolymarketMarket[]; allMarkets: PolymarketMarket[]; onBet: (m: PolymarketMarket, o?: string) => void; onOpen: (m: PolymarketMarket) => void }) {
  const [idx,    setIdx]    = useState(0);
  const [paused, setPaused] = useState(false);
  const timerRef            = useRef<ReturnType<typeof setInterval> | null>(null);
  const total               = Math.min(markets.length, 6);

  // Auto-advance
  useEffect(() => {
    if (paused || total <= 1) return;
    timerRef.current = setInterval(() => setIdx((i) => (i + 1) % total), CAROUSEL_MS);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [paused, total, idx]); // restart timer on every idx change so progress bar resets

  function goTo(i: number) {
    if (timerRef.current) clearInterval(timerRef.current);
    setIdx(i);
  }

  if (total === 0) return null;

  // idx can briefly outrun markets when the list shrinks before the effect
  // resets it — clamp so we never index past the end (markets[idx] undefined
  // → HeroCard crashes on market.outcomes).
  const hero = markets[idx] ?? markets[0];
  if (!hero) return null;

  return (
    <div
      className="flex flex-col gap-3"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <HeroCard market={hero} allMarkets={allMarkets} onBet={onBet} onOpen={onOpen} />

      {/* Controls row */}
      <div className="flex items-center justify-between px-1">
        {/* Progress dots */}
        <div className="flex items-center gap-1.5">
          {Array.from({ length: total }).map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              aria-label={`Slide ${i + 1}`}
              className={`relative overflow-hidden rounded-full transition-all duration-300 ${
                i === idx ? "h-1.5 w-7 bg-white/15" : "h-1.5 w-1.5 bg-white/15 hover:bg-white/35"
              }`}
            >
              {i === idx && (
                <span
                  key={idx} // remount = restart animation
                  className="absolute inset-y-0 left-0 rounded-full bg-white/60"
                  style={{ animation: paused ? "none" : `nz-dot-fill ${CAROUSEL_MS}ms linear forwards` }}
                />
              )}
            </button>
          ))}
        </div>

        {/* Prev / Next pill buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => goTo((idx - 1 + total) % total)}
            className="flex h-8 items-center gap-1.5 rounded-full border border-white/[0.10] bg-white/[0.05] px-3.5 text-[12px] font-semibold text-white/50 transition hover:bg-white/[0.09] hover:text-white/80"
          >
            <ArrowLeft className="h-3 w-3 shrink-0" />
            <span className="max-w-[120px] truncate">
              {markets[(idx - 1 + total) % total]?.question.split("?")[0].trim().slice(0, 22)}
            </span>
          </button>
          <button
            onClick={() => goTo((idx + 1) % total)}
            className="flex h-8 items-center gap-1.5 rounded-full border border-white/[0.10] bg-white/[0.05] px-3.5 text-[12px] font-semibold text-white/50 transition hover:bg-white/[0.09] hover:text-white/80"
          >
            <span className="max-w-[120px] truncate">
              {markets[(idx + 1) % total]?.question.split("?")[0].trim().slice(0, 22)}
            </span>
            <ArrowRight className="h-3 w-3 shrink-0" />
          </button>
        </div>
      </div>

      <style>{`@keyframes nz-dot-fill { from { width:0% } to { width:100% } }`}</style>
    </div>
  );
}

/* ── Breaking news sidebar ──────────────────────────────────────────────── */
function BreakingNews({ markets, onOpen }: { markets: PolymarketMarket[]; onOpen: (m: PolymarketMarket) => void }) {
  if (markets.length === 0) return null;

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-[#18191f] p-5">
      <div className="mb-4 flex items-center justify-between">
        <span className="text-[15px] font-black text-white">Breaking news</span>
        <button className="flex items-center gap-0.5 text-[12px] text-white/35 hover:text-white/60">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      <div className="flex flex-col divide-y divide-white/[0.05]">
        {markets.slice(0, 3).map((m, i) => {
          const yesIdx = m.outcomes.findIndex((o) => o.toLowerCase() === "yes");
          const p1 = Math.round((yesIdx >= 0 ? m.outcomePrices[yesIdx] : m.outcomePrices[0] ?? 0.5) * 100);
          const p2 = Math.round((m.outcomePrices[1] ?? (1 - p1 / 100)) * 100);
          const up = p1 > 50;
          return (
            <button
              key={m.conditionId}
              onClick={() => onOpen(m)}
              className="flex items-start gap-3 py-3.5 text-left transition hover:opacity-80 first:pt-0 last:pb-0"
            >
              <span className="mt-0.5 w-4 shrink-0 text-[12px] font-black text-white/25">{i + 1}</span>
              <p className="flex-1 text-[13px] font-semibold leading-snug text-white/80 line-clamp-2">
                {m.question}
              </p>
              <div className="shrink-0 text-right">
                <p className="text-[13px] font-black text-white">{p1}%</p>
                <p className={`text-[11px] font-bold ${up ? "text-[#31c45d]" : "text-red-400"}`}>
                  {up ? "↑" : "↓"}{p2}%
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ── Hot topics sidebar ─────────────────────────────────────────────────── */
function HotTopics({ markets, onTagClick }: { markets: PolymarketMarket[]; onTagClick: (t: string) => void }) {
  const topics = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of markets) for (const t of m.tags) map.set(t, (map.get(t) ?? 0) + m.volume);
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([tag, vol]) => ({ tag, vol }));
  }, [markets]);

  if (topics.length === 0) return null;

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-[#18191f] p-5">
      <div className="mb-4 flex items-center justify-between">
        <span className="text-[15px] font-black text-white">Hot topics</span>
        <button className="flex items-center gap-0.5 text-[12px] text-white/35 hover:text-white/60">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      <div className="flex flex-col divide-y divide-white/[0.05]">
        {topics.map(({ tag, vol }, i) => (
          <button
            key={tag}
            onClick={() => onTagClick(tag)}
            className="flex items-center gap-3 py-3 text-left transition hover:opacity-80 first:pt-0 last:pb-0"
          >
            <span className="w-4 shrink-0 text-[12px] font-black text-white/25">{i + 1}</span>
            <span className="flex-1 text-[14px] font-bold text-white/80">{tag}</span>
            <span className="text-[12px] text-white/35">{formatMarketMoney(vol)} / {formatMarketMoneyKes(vol)} today</span>
            <Flame className="h-4 w-4 shrink-0 text-orange-400" />
            <ChevronRight className="h-4 w-4 shrink-0 text-white/20" />
          </button>
        ))}
      </div>
      <button className="mt-4 w-full rounded-xl border border-white/[0.06] py-2.5 text-[13px] font-black text-white/40 transition hover:bg-white/[0.04] hover:text-white/70">
        Explore all
      </button>
    </div>
  );
}

/* ── Compact 4-col market card ──────────────────────────────────────────── */
function CompactCard({ market, onBet, onOpen }: { market: PolymarketMarket; onBet: (m: PolymarketMarket, o?: string) => void; onOpen: (m: PolymarketMarket) => void }) {
  const ranked = market.outcomes
    .map((outcome, i) => ({ outcome, price: marketPrice(market, i), index: i }))
    .sort((a, b) => b.price - a.price);
  const leader = ranked[0] ?? { outcome: "Yes", price: 0.5, index: 0 };
  const runner = ranked[1] ?? { outcome: "No", price: Math.max(0.01, 1 - leader.price), index: 1 };
  const hasYesNo = market.outcomes.some((o) => o.toLowerCase() === "yes") && market.outcomes.some((o) => o.toLowerCase() === "no");
  const noOutcome = market.outcomes.find((o) => o.toLowerCase() === "no") ?? runner.outcome;
  const noPrice = hasYesNo ? marketPrice(market, market.outcomes.indexOf(noOutcome)) : runner.price;
  const yesLabel = hasYesNo ? "Yes" : leader.outcome;
  const noLabel = hasYesNo ? "No" : runner.outcome;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(market)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onOpen(market);
      }}
      className="flex min-h-[216px] cursor-pointer flex-col rounded-2xl border border-white/[0.06] bg-[#18191f] p-4 text-left transition hover:border-white/[0.12] hover:bg-[#1c1d24]"
    >
      <div className="mb-4 flex items-start gap-3">
        {market.image ? (
          <Image src={market.image} alt="" width={42} height={42} unoptimized className="h-10 w-10 shrink-0 rounded-xl bg-white object-cover" />
        ) : (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.06] text-[10px] font-black text-white/30">?</div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-black leading-snug text-white/90 line-clamp-2">{market.question}</p>
          <p className="mt-1 truncate text-[11px] font-bold text-white/30">{market.tags.slice(0, 2).join(" · ") || "Market"}</p>
        </div>
      </div>

      <div className="flex-1">
        <div className="mb-2 flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-[12px] font-bold text-white/45">{leader.outcome}</p>
            <p className="text-[24px] font-black leading-none text-white">{(leader.price * 100).toFixed(0)}%</p>
          </div>
          <div className="min-w-0 text-right">
            <p className="truncate text-[12px] font-bold text-white/35">{runner.outcome}</p>
            <p className="text-[18px] font-black leading-none text-white/55">{(runner.price * 100).toFixed(0)}%</p>
          </div>
        </div>
        <div className="mb-3 flex h-2 overflow-hidden rounded-full bg-white/[0.06]">
          <div className="bg-[#31c45d]" style={{ width: `${Math.max(3, Math.min(97, leader.price * 100))}%` }} />
          <div className="flex-1 bg-[#087cff]/70" />
        </div>
        <div className="space-y-1.5">
          {ranked.slice(0, 3).map(({ outcome, price }) => (
            <div key={outcome} className="flex items-center gap-2 text-[12px] font-bold">
              <span className="min-w-0 flex-1 truncate text-white/45">{outcome}</span>
              <span className="font-mono text-white/70">{formatCents(price)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          onClick={(e) => { e.stopPropagation(); onBet(market, leader.outcome); }}
          className="h-9 min-w-0 rounded-xl bg-[#31c45d]/15 px-2 text-[12px] font-black text-[#31c45d] transition hover:bg-[#31c45d]/25"
        >
          <span className="truncate">{yesLabel}</span> <span className="font-mono text-white/70">{formatCents(leader.price)}</span>
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onBet(market, hasYesNo ? noOutcome : runner.outcome); }}
          className="h-9 min-w-0 rounded-xl bg-red-500/12 px-2 text-[12px] font-black text-red-300 transition hover:bg-red-500/20"
        >
          <span className="truncate">{noLabel}</span> <span className="font-mono text-white/70">{formatCents(noPrice)}</span>
        </button>
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-white/[0.05] pt-2.5">
        <span className="min-w-0 truncate text-[11px] font-bold text-white/25">{formatMarketMoney(market.volume)} / {formatMarketMoneyKes(market.volume)} Vol.</span>
        <div className="ml-3 flex shrink-0 items-center gap-2">
          <button className="text-white/15 transition hover:text-white/40">
            <Bookmark className="h-3.5 w-3.5" />
          </button>
          <span className="text-[10px] text-white/20">{formatEndDate(market.endDate)}</span>
        </div>
      </div>
    </div>
  );
}

function marketPrice(market: PolymarketMarket, index: number) {
  return Math.max(0.01, Math.min(0.99, market.outcomePrices[index] ?? 0.5));
}

function formatCents(price: number) {
  const cents = price * 100;
  return `${cents < 10 ? cents.toFixed(1) : cents.toFixed(0)}¢`;
}

function DetailTradeTicket({
  market,
  selectedOutcome,
  selectedTradeSide,
  balance,
  onTradeSuccess,
  onViewBets,
  onSelectTradeSide,
  compact = false,
}: {
  market: PolymarketMarket;
  selectedOutcome: string;
  selectedTradeSide: "yes" | "no";
  balance: number;
  onTradeSuccess: () => void;
  onViewBets: () => void;
  onSelectTradeSide: (side: "yes" | "no") => void;
  compact?: boolean;
}) {
  // Stake entered/shown in the display currency; server + balance are KES.
  const { convert, toKes, format, currency } = useCurrency();
  const dmoney = (disp: number, opts?: Intl.NumberFormatOptions) =>
    `${currency.symbol} ${disp.toLocaleString(currency.locale, opts ?? { maximumFractionDigits: currency.decimals })}`;
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState(100);
  const [placing, setPlacing] = useState(false);
  const [tradeError, setTradeError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<{
    outcome: string;
    stake: number;
    price: number;
    potentialWin: number;
  } | null>(null);
  const selectedIndex = Math.max(0, market.outcomes.findIndex((o) => o === selectedOutcome));
  const price = marketPrice(market, selectedIndex);
  const noPrice = Math.max(0.01, Math.min(0.99, 1 - price));
  const noTradeIndex = market.outcomes.length === 2 ? (selectedIndex === 0 ? 1 : 0) : -1;
  const canExecuteNo = selectedTradeSide === "yes" || noTradeIndex >= 0;
  const activePrice  = selectedTradeSide === "yes" ? price : noPrice;
  const tradeOutcome = selectedTradeSide === "yes" ? selectedOutcome : market.outcomes[noTradeIndex] ?? selectedOutcome;
  const tradeOutcomeIndex = selectedTradeSide === "yes" ? selectedIndex : noTradeIndex;
  const isUnavailable = activePrice < 0.01;
  const amtKes = Math.round(toKes(amount)); // canonical KES for checks + submit
  const potentialWin = amount > 0 && activePrice > 0 ? amount / activePrice : 0; // display units
  const amountOptions = compact ? [50, 100, 250] : [50, 100, 250, 500];

  useEffect(() => {
    setReceipt(null);
    setTradeError(null);
  }, [market.conditionId, selectedOutcome, selectedTradeSide]);

  async function placeTrade() {
    if (placing || isUnavailable) return;
    if (amtKes < 10) { setTradeError(`Minimum bet is ${format(10)}`); return; }
    if (amtKes > balance) { setTradeError("Insufficient balance"); return; }
    if (!canExecuteNo) {
      setTradeError("No-side execution for multi-outcome markets is not connected yet. Use the Yes side for this outcome.");
      return;
    }

    setPlacing(true);
    setTradeError(null);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15_000);
    try {
      const res = await fetch("/api/polymarket/bet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conditionId: market.conditionId, outcome: tradeOutcome, outcomeIndex: tradeOutcomeIndex, stake: amtKes }),
        signal: controller.signal,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Failed to place bet");
      setReceipt({
        outcome: String(data.outcome ?? tradeOutcome),
        stake: Number(data.stake ?? amtKes),
        price: Number(data.price ?? activePrice),
        potentialWin: Number(data.potentialWin ?? toKes(potentialWin)),
      });
      onTradeSuccess();
    } catch (err: unknown) {
      setTradeError((err as Error).name === "AbortError" ? "Bet request timed out. Please try again." : (err as Error).message);
    } finally {
      window.clearTimeout(timeout);
      setPlacing(false);
    }
  }

  return (
    <aside className={compact ? "" : "lg:sticky lg:top-24 lg:self-start"}>
      <div className={`overflow-hidden border border-white/[0.06] bg-[#18191f] shadow-2xl shadow-black/25 ${compact ? "rounded-t-3xl" : "rounded-2xl"}`}>
        {!compact && <div className="flex items-center gap-3 border-b border-white/[0.06] p-4">
          {market.image ? (
            <Image src={market.image} alt="" width={44} height={44} unoptimized className="h-11 w-11 shrink-0 rounded-xl object-cover" />
          ) : (
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/[0.06] text-white/40">?</div>
          )}
          <div className="min-w-0">
            <p className="text-[12px] font-bold text-white/35 line-clamp-1">{market.question}</p>
            <p className="text-[15px] font-black leading-tight text-white">
              {selectedOutcome} <span className="text-white/30">·</span> <span className={selectedTradeSide === "no" ? "text-red-400" : "text-[#31c45d]"}>{selectedTradeSide === "yes" ? "Yes" : "No"} {formatCents(activePrice)}</span>
            </p>
          </div>
        </div>}

        <div className={`flex items-center justify-between border-b border-white/[0.06] ${compact ? "px-3" : "px-4"}`}>
          <div className="flex gap-4">
            <button
              onClick={() => setSide("buy")}
              className={`border-b-2 py-3 text-sm font-black ${side === "buy" ? "border-white text-white" : "border-transparent text-white/35"}`}
            >
              Buy
            </button>
            <button
              onClick={() => setSide("sell")}
              className={`border-b-2 py-3 text-sm font-black ${side === "sell" ? "border-white text-white" : "border-transparent text-white/35"}`}
            >
              Sell
            </button>
          </div>
          <button className="flex items-center gap-1 text-[12px] font-black text-white/60">
            Market <ChevronDown className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className={compact ? "p-3" : "p-4"}>
          {compact && (
            <div className="mb-3 min-w-0">
              <p className="truncate text-[12px] font-bold text-white/35">{market.question}</p>
              <p className="text-[15px] font-black text-white">{selectedOutcome}</p>
            </div>
          )}

          {receipt ? (
            <div className="rounded-2xl border border-[#31c45d]/25 bg-[#0f1a14] p-4">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <p className="text-[12px] font-black uppercase tracking-wide text-[#31c45d]">Position opened</p>
                  <p className="mt-1 text-sm font-black text-white">{receipt.outcome}</p>
                </div>
                <div className="rounded-full bg-[#31c45d]/15 px-3 py-1 text-[11px] font-black text-[#31c45d]">
                  {formatCents(receipt.price)}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 rounded-xl bg-black/20 p-3 text-[12px]">
                <div>
                  <p className="text-white/35">Stake</p>
                  <p className="font-mono font-black text-white">{format(receipt.stake)}</p>
                </div>
                <div className="text-right">
                  <p className="text-white/35">Potential win</p>
                  <p className="font-mono font-black text-[#31c45d]">{format(receipt.potentialWin)}</p>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  onClick={() => setReceipt(null)}
                  className="h-10 rounded-xl border border-white/[0.06] bg-white/[0.04] text-[12px] font-black text-white/60"
                >
                  Trade again
                </button>
                <button
                  onClick={onViewBets}
                  className="h-10 rounded-xl bg-[#087cff] text-[12px] font-black text-white shadow-lg shadow-[#087cff]/20"
                >
                  View my bets
                </button>
              </div>
            </div>
          ) : (
          <>

          <div className={`mb-4 grid grid-cols-2 rounded-2xl bg-black/25 p-1 ${compact ? "gap-1" : "gap-2"}`}>
            <button
              onClick={() => onSelectTradeSide("yes")}
              className={`min-h-11 rounded-xl px-2 text-left transition ${selectedTradeSide === "yes" ? "bg-[#31c45d] text-white" : "bg-transparent text-white/45 hover:bg-white/[0.04]"}`}
            >
              <span className="block truncate text-[12px] font-black">Yes</span>
              <span className="block font-mono text-[15px] font-black">{formatCents(price)}</span>
            </button>
            <button
              onClick={() => onSelectTradeSide("no")}
              className={`min-h-11 rounded-xl px-2 text-left transition ${selectedTradeSide === "no" ? "bg-red-500/85 text-white" : "bg-transparent text-white/45 hover:bg-white/[0.04]"}`}
            >
              <span className="block truncate text-[12px] font-black">No</span>
              <span className="block font-mono text-[15px] font-black">{formatCents(noPrice)}</span>
            </button>
          </div>

          <div className="mb-3 flex items-end justify-between">
            <span className="text-sm font-black text-white/70">Amount</span>
            <span className={`${compact ? "text-2xl" : "text-3xl"} font-black text-white/55`}>{dmoney(amount)}</span>
          </div>
          <div className={`mb-4 grid gap-2 ${compact ? "grid-cols-3" : "grid-cols-4"}`}>
            {amountOptions.map((v) => {
              const vd = Math.round(convert(v)); // KES preset → display units
              return (
              <button
                key={v}
                onClick={() => setAmount(vd)}
                className={`rounded-xl px-3 py-2 text-[12px] font-black ${amount === vd ? "bg-[#087cff]/30 text-[#8bc3ff]" : "bg-white/[0.06] text-white/40"}`}
              >
                {vd >= 1000 ? `${(vd / 1000).toLocaleString(currency.locale, { maximumFractionDigits: 1 })}K` : vd.toLocaleString(currency.locale)}
              </button>
              );
            })}
          </div>
          <div className="mb-4 rounded-xl border border-white/[0.06] bg-white/[0.04] p-3 text-[12px]">
            <div className="flex justify-between text-white/45"><span>Odds</span><span className="font-mono text-white">{(1 / activePrice).toFixed(2)}x</span></div>
            <div className="mt-1 flex justify-between text-white/45"><span>Potential win</span><span className="font-mono text-[#31c45d]">{dmoney(potentialWin, { maximumFractionDigits: 2 })}</span></div>
          </div>
          {isUnavailable ? (
            <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 px-4 py-3 text-center">
              <p className="text-xs font-black text-amber-400">Market near resolution</p>
              <p className="text-[10px] text-amber-300/60 mt-0.5">This outcome is no longer available for trading</p>
            </div>
          ) : (
            <button
              onClick={placeTrade}
              disabled={placing}
              className="h-11 w-full rounded-xl bg-[#087cff] text-sm font-black text-white shadow-lg shadow-[#087cff]/20 transition hover:bg-[#1c8aff] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {placing ? "Placing..." : side === "buy" ? "Place trade" : "Create sell order"}
            </button>
          )}
          {tradeError && <p className="mt-3 rounded-lg bg-red-900/30 px-3 py-2 text-[11px] text-red-400">{tradeError}</p>}
          </>
          )}
          <p className="mt-3 text-center text-[11px] text-white/30">Balance: {format(balance)}</p>
        </div>
      </div>

      {!compact && <p className="px-5 py-4 text-[12px] font-semibold text-white/35">By trading, you agree to the <span className="underline">Terms of Use</span>.</p>}
      {!compact && <div className="border-t border-dashed border-white/[0.06] pt-4">
        <div className="mb-3 flex gap-2">
          {["All", ...(market.tags.slice(0, 2).length ? market.tags.slice(0, 2) : ["Market"])].map((t, i) => (
            <span key={`${t}-${i}`} className={`rounded-full px-4 py-2 text-[12px] font-black ${i === 0 ? "bg-white/[0.08] text-white" : "text-white/40"}`}>{t}</span>
          ))}
        </div>
      </div>}
    </aside>
  );
}

function formatBetDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function marketSlug(value: string) {
  const slug = value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96);
  return slug || "market";
}

function marketUrl(market: PolymarketMarket) {
  return `/predictions/${marketSlug(market.question)}/${market.conditionId}`;
}

function conditionIdFromPath() {
  if (typeof window === "undefined") return null;
  const parts = window.location.pathname.split("/").filter(Boolean);
  if (parts[0] !== "predictions" || parts.length < 3) return null;
  return parts[parts.length - 1] ?? null;
}

function scrollPolymarketTop() {
  if (typeof window === "undefined") return;
  const scroll = () => {
    document.querySelector<HTMLElement>("[data-app-scroll='true']")?.scrollTo({ top: 0, behavior: "instant" });
    window.scrollTo({ top: 0, behavior: "instant" });
  };
  requestAnimationFrame(() => {
    scroll();
    requestAnimationFrame(scroll);
  });
}

function PositionCard({ bet, onOpen }: { bet: MyBet; onOpen: (bet: MyBet) => void }) {
  const { format } = useMoney();
  const pending = bet.status === "PENDING";
  const profit = bet.potentialWin - bet.stake;
  const sideColor = bet.outcome.toLowerCase() === "yes" ? "text-[#31c45d]" : "text-red-400";

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={() => onOpen(bet)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onOpen(bet);
      }}
      className="cursor-pointer rounded-2xl border border-white/[0.07] bg-[#18191f] p-4 transition hover:border-white/[0.13] hover:bg-[#1c1d24] sm:p-5"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[15px] font-black leading-snug text-white sm:text-base">{bet.question}</p>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] font-semibold text-white/45">
            <span className={sideColor}>{bet.outcome}</span>
            <span>@ {(bet.price * 100).toFixed(1)}¢</span>
            <span>{(1 / bet.price).toFixed(2)}x</span>
          </div>
        </div>
        <StatusBadge status={bet.status} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="rounded-xl bg-black/20 p-3">
          <p className="text-[11px] font-bold text-white/35">Stake</p>
          <p className="mt-1 font-mono text-sm font-black text-white">{format(bet.stake)}</p>
        </div>
        <div className="rounded-xl bg-black/20 p-3">
          <p className="text-[11px] font-bold text-white/35">{pending ? "To win" : "Payout"}</p>
          <p className={`mt-1 font-mono text-sm font-black ${bet.status === "LOST" ? "text-red-400" : "text-[#31c45d]"}`}>
            {format((bet.status === "WON" && bet.winAmount) ? bet.winAmount : bet.potentialWin)}
          </p>
        </div>
        <div className="rounded-xl bg-black/20 p-3">
          <p className="text-[11px] font-bold text-white/35">Max profit</p>
          <p className="mt-1 font-mono text-sm font-black text-white">{format(profit)}</p>
        </div>
        <div className="rounded-xl bg-black/20 p-3">
          <p className="text-[11px] font-bold text-white/35">Opened</p>
          <p className="mt-1 text-sm font-black text-white">{formatBetDate(bet.createdAt)}</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] pt-3">
        <div className="text-[12px] font-semibold text-white/35">
          {pending ? "Position is open until the market resolves." : bet.settledAt ? `Settled ${formatBetDate(bet.settledAt)}` : "Position resolved."}
        </div>
        {bet.executionMode === "clob" && (
          <div className="flex flex-wrap gap-2 text-[11px] text-white/35">
            <span className="rounded-md border border-white/[0.06] bg-black/20 px-2 py-1 uppercase tracking-wide">
              CLOB {bet.clobStatus ?? "PLACED"}
            </span>
            {bet.clobOrderId && (
              <span className="rounded-md border border-white/[0.06] bg-black/20 px-2 py-1 font-mono">
                {bet.clobOrderId.slice(0, 10)}...{bet.clobOrderId.slice(-6)}
              </span>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

function DetailMyBets({ bets }: { bets: MyBet[] }) {
  const { format } = useMoney();
  if (bets.length === 0) return null;

  const openCount = bets.filter((b) => b.status === "PENDING").length;
  const totalStake = bets.reduce((s, b) => s + b.stake, 0);
  const openToWin = bets.filter((b) => b.status === "PENDING").reduce((s, b) => s + b.potentialWin, 0);

  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-white/[0.06] bg-[#18191f]">
      <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
        <span className="text-[13px] font-black text-white">My Bets</span>
        <div className="flex items-center gap-2">
          {openCount > 0 && (
            <span className="rounded-full bg-[#087cff]/20 px-2 py-0.5 text-[10px] font-black text-[#8bc3ff]">
              {openCount} open
            </span>
          )}
          <span className="text-[11px] text-white/30">{bets.length} total</span>
        </div>
      </div>

      {bets.length > 1 && (
        <div className="grid grid-cols-2 gap-px border-b border-white/[0.06] bg-white/[0.06]">
          <div className="bg-[#18191f] px-4 py-2.5">
            <p className="text-[10px] font-black uppercase tracking-wide text-white/30">Staked</p>
            <p className="mt-0.5 font-mono text-[13px] font-black text-white">{format(totalStake)}</p>
          </div>
          <div className="bg-[#18191f] px-4 py-2.5">
            <p className="text-[10px] font-black uppercase tracking-wide text-white/30">To win</p>
            <p className="mt-0.5 font-mono text-[13px] font-black text-[#31c45d]">{format(openToWin)}</p>
          </div>
        </div>
      )}

      <div className="divide-y divide-white/[0.05]">
        {bets.map((bet) => {
          const isYes = bet.outcome.toLowerCase() === "yes";
          const pending = bet.status === "PENDING";
          const payout = bet.status === "WON" && bet.winAmount ? bet.winAmount : bet.potentialWin;
          return (
            <div key={bet.id} className="px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className={`text-[13px] font-black ${isYes ? "text-[#31c45d]" : "text-red-400"}`}>
                    {bet.outcome}
                  </span>
                  <span className="font-mono text-[11px] text-white/35">@ {(bet.price * 100).toFixed(1)}¢</span>
                </div>
                <StatusBadge status={bet.status} />
              </div>
              <div className="mt-2 flex items-center justify-between text-[11px]">
                <span className="text-white/40">
                  Stake <span className="font-mono font-black text-white">{format(bet.stake)}</span>
                </span>
                <span className={`font-mono font-black ${bet.status === "LOST" ? "text-red-400" : "text-[#31c45d]"}`}>
                  {pending ? "→ " : ""}{format(payout)}
                </span>
              </div>
              {bet.executionMode === "clob" && bet.clobStatus && (
                <p className="mt-1.5 text-[10px] font-semibold uppercase tracking-wide text-white/25">
                  CLOB · {bet.clobStatus}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MarketDetailView({
  market,
  related,
  balance,
  myBets,
  onBack,
  onTradeSuccess,
  onViewBets,
  onOpen,
  comments,
  onAddComment,
}: {
  market: PolymarketMarket;
  related: PolymarketMarket[];
  balance: number;
  myBets: MyBet[];
  onBack: () => void;
  onTradeSuccess: () => void;
  onViewBets: () => void;
  onOpen: (m: PolymarketMarket) => void;
  comments: DetailComment[];
  onAddComment: (body: string) => Promise<boolean>;
}) {
  const topIndex = market.outcomePrices.reduce((best, price, index) => price > (market.outcomePrices[best] ?? 0) ? index : best, 0);
  const [selectedOutcome, setSelectedOutcome] = useState(market.outcomes[topIndex] ?? market.outcomes[0] ?? "Yes");
  const [selectedTradeSide, setSelectedTradeSide] = useState<"yes" | "no">("yes");
  const selectedIndex = Math.max(0, market.outcomes.findIndex((o) => o === selectedOutcome));
  const [rulesTab, setRulesTab] = useState<"rules" | "context">("rules");
  const [commentsTab, setCommentsTab] = useState<"comments" | "holders" | "positions" | "activity">("comments");
  const [mobileTradeOpen, setMobileTradeOpen] = useState(false);
  useEffect(() => {
    setSelectedOutcome(market.outcomes[topIndex] ?? market.outcomes[0] ?? "Yes");
    setSelectedTradeSide("yes");
    setRulesTab("rules");
    setCommentsTab("comments");
    setMobileTradeOpen(false);
  }, [market.conditionId, market.outcomes, topIndex]);

  return (
    <div className={`grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:pb-0 xl:grid-cols-[minmax(0,1fr)_420px] ${mobileTradeOpen ? "pb-72" : "pb-24"}`}>
      <main className="min-w-0">
        <button onClick={onBack} className="mb-5 inline-flex items-center gap-2 text-[13px] font-black text-white/45 hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Markets
        </button>

        <div className="mb-6 flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-4">
            {market.image ? (
              <Image src={market.image} alt="" width={56} height={56} unoptimized className="h-14 w-14 shrink-0 rounded-xl bg-white object-cover" />
            ) : (
              <div className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-white/[0.08] text-white/40">?</div>
            )}
            <div className="min-w-0">
              <p className="mb-1 text-[12px] font-bold text-white/40">{market.tags.slice(0, 2).join(" · ") || "Market"}</p>
              <h1 className="text-base font-black leading-tight text-white sm:text-lg">{market.question}</h1>
              <div className="mt-5 flex flex-wrap gap-x-4 gap-y-2">
                {market.outcomes.slice(0, 4).map((outcome, i) => (
                  <button
                    key={outcome}
                    onClick={() => { setSelectedOutcome(outcome); setSelectedTradeSide("yes"); }}
                    className={`flex items-center gap-1.5 text-[13px] font-semibold ${selectedOutcome === outcome ? "text-white" : "text-white/45 hover:text-white/70"}`}
                  >
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: ["#8bc3ff", "#2997ff", "#31c45d", "#f97316"][i % 4] }} />
                    {outcome} <span className="font-black">{(marketPrice(market, i) * 100).toFixed(i === 0 ? 0 : 1)}%</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="hidden items-center gap-5 pt-8 text-white/70 md:flex">
            <Code2 className="h-5 w-5" />
            <Link2 className="h-5 w-5" />
            <Bookmark className="h-5 w-5" />
          </div>
        </div>

        <section className="mb-6 rounded-2xl border border-white/[0.06] bg-[#18191f] p-4 sm:p-5">
          {market.clobTokenIds.length > 0 ? (
            <ProbabilityChart tokenIds={market.clobTokenIds} outcomes={market.outcomes} />
          ) : (
            <div className="grid h-72 place-items-center text-sm text-white/30">No chart data available</div>
          )}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.05] pt-4">
            <div className="flex items-center gap-4 text-[13px] font-bold text-white/80">
              <span className="flex items-center gap-1.5"><Trophy className="h-4 w-4" /> {formatMarketMoney(market.volume)} / {formatMarketMoneyKes(market.volume)} Vol.</span>
              <span className="text-white/40">{formatEndDate(market.endDate)}</span>
            </div>
            <div className="flex items-center gap-4 text-[12px] font-black text-white/45">
              {["1H", "6H", "1D", "1W", "1M", "ALL"].map((range) => <span key={range} className={range === "ALL" ? "text-white" : ""}>{range}</span>)}
              <Settings className="h-4 w-4" />
            </div>
          </div>
        </section>

        <section className="divide-y divide-white/[0.06] border-y border-white/[0.06]">
          {market.outcomes.map((outcome, i) => {
            const price = marketPrice(market, i);
            const noPrice = Math.max(0.01, Math.min(0.99, 1 - price));
            return (
              <div key={outcome} className="grid grid-cols-[minmax(0,1fr)_74px] items-center gap-3 py-3 sm:grid-cols-[minmax(0,1fr)_90px] xl:grid-cols-[minmax(0,1fr)_90px_170px_170px]">
                <div className="min-w-0">
                  <p className="truncate text-[16px] font-black text-white/85">{outcome}</p>
                  <p className="text-[12px] font-semibold text-white/35">{formatMarketMoney(market.volume * price)} / {formatMarketMoneyKes(market.volume * price)} Vol.</p>
                </div>
                <div className="text-right">
                  <p className="text-xl font-black text-white">{(price * 100).toFixed(0)}%</p>
                  <p className={`text-[11px] font-black ${i === selectedIndex ? "text-[#31c45d]" : "text-red-400"}`}>{i === selectedIndex ? "▲" : "▼"} {Math.max(1, Math.round(price * 28))}%</p>
                </div>
                <button onClick={() => { setSelectedOutcome(outcome); setSelectedTradeSide("yes"); }} className="hidden h-10 rounded-xl bg-[#31c45d]/80 text-sm font-black text-white xl:block">
                  Buy Yes {formatCents(price)}
                </button>
                <button onClick={() => { setSelectedOutcome(outcome); setSelectedTradeSide("no"); }} className="hidden h-10 rounded-xl bg-red-500/15 text-sm font-black text-red-400 xl:block">
                  Buy No {formatCents(noPrice)}
                </button>
              </div>
            );
          })}
        </section>

        <section className="mt-10">
          <div className="mb-5 flex gap-5">
            {(["rules", "context"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setRulesTab(t)}
                className={`text-[15px] font-black transition ${rulesTab === t ? "text-white" : "text-white/45 hover:text-white/70"}`}
              >
                {t === "rules" ? "Rules" : "Market Context"}
              </button>
            ))}
          </div>
          {rulesTab === "rules" ? (
            <div className="space-y-4 text-[14px] font-semibold leading-relaxed text-white/80">
              <p>This market will resolve to &ldquo;Yes&rdquo; if <span className="font-black text-white">{selectedOutcome}</span> wins before the market close. Otherwise, this market will resolve to &ldquo;No&rdquo;.</p>
              <p>This market may resolve to &ldquo;No&rdquo; if it becomes impossible for this outcome to occur based on the official rules.</p>
              <p>The resolution source for this market will be official reporting and information from the event organizer.</p>
            </div>
          ) : (
            <div className="space-y-3 text-[14px] font-semibold leading-relaxed text-white/80">
              <p>This market tracks the probability of <span className="font-black text-white">{market.question}</span></p>
              <p>Volume traded: <span className="font-black text-white">{formatMarketMoney(market.volume)} / {formatMarketMoneyKes(market.volume)}</span></p>
              <p>Market closes: <span className="font-black text-white">{formatEndDate(market.endDate)}</span></p>
              <p>Liquidity is provided by market makers and traders on the platform. Prices reflect the collective probability estimates of all participants.</p>
            </div>
          )}
        </section>

        <section className="mt-10">
          <div className="mb-5 flex flex-wrap gap-5">
            <button
              onClick={() => setCommentsTab("comments")}
              className={`text-[15px] font-black transition ${commentsTab === "comments" ? "text-white" : "text-white/45 hover:text-white/70"}`}
            >
              Comments ({comments.length})
            </button>
            <button
              onClick={() => setCommentsTab("holders")}
              className={`text-[15px] font-black transition ${commentsTab === "holders" ? "text-white" : "text-white/45 hover:text-white/70"}`}
            >
              Top Holders
            </button>
            <button
              onClick={() => setCommentsTab("positions")}
              className={`text-[15px] font-black transition ${commentsTab === "positions" ? "text-white" : "text-white/45 hover:text-white/70"}`}
            >
              Positions
            </button>
            <button
              onClick={() => setCommentsTab("activity")}
              className={`text-[15px] font-black transition ${commentsTab === "activity" ? "text-white" : "text-white/45 hover:text-white/70"}`}
            >
              Activity
            </button>
          </div>
          {commentsTab === "comments" && <CommentsPanel comments={comments} onAddComment={onAddComment} />}
          {commentsTab === "holders" && <TopHoldersPanel market={market} />}
          {commentsTab === "positions" && <PositionsPanel market={market} />}
          {commentsTab === "activity" && <ActivityPanel market={market} />}
        </section>
      </main>

      <div className="hidden min-w-0 lg:block">
        <DetailTradeTicket
          market={market}
          selectedOutcome={selectedOutcome}
          selectedTradeSide={selectedTradeSide}
          balance={balance}
          onTradeSuccess={onTradeSuccess}
          onViewBets={onViewBets}
          onSelectTradeSide={setSelectedTradeSide}
        />
        <DetailMyBets bets={myBets.filter((b) => b.marketId === market.conditionId)} />
        <div className="mt-5 space-y-3">
          {related.filter((m) => m.conditionId !== market.conditionId).slice(0, 3).map((m) => {
            const p = Math.round(marketPrice(m, 0) * 100);
            return (
              <button
                key={m.conditionId}
                onClick={() => { onOpen(m); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                className="flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-white/[0.04]"
              >
                {m.image ? <Image src={m.image} alt="" width={38} height={38} unoptimized className="h-10 w-10 rounded-lg object-cover" /> : <div className="h-10 w-10 rounded-lg bg-white/[0.06]" />}
                <p className="min-w-0 flex-1 text-[12px] font-black leading-tight text-white/80 line-clamp-2">{m.question}</p>
                <span className="text-lg font-black text-white">{p}%</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-14 z-40 border-t border-white/[0.06] bg-[#151518]/95 px-3 pt-2 shadow-2xl shadow-black/60 backdrop-blur lg:hidden">
        {mobileTradeOpen ? (
          <>
            <button
              onClick={() => setMobileTradeOpen(false)}
              className="mx-auto mb-2 flex h-6 w-full max-w-xs items-center justify-center rounded-full text-[11px] font-black text-white/45"
            >
              <ChevronDown className="h-4 w-4" /> Minimize trade
            </button>
            <DetailTradeTicket
              market={market}
              selectedOutcome={selectedOutcome}
              selectedTradeSide={selectedTradeSide}
              balance={balance}
              onTradeSuccess={onTradeSuccess}
              onViewBets={onViewBets}
              onSelectTradeSide={setSelectedTradeSide}
              compact
            />
          </>
        ) : (
          <div className="mx-auto flex max-w-xl items-center gap-3 pb-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[11px] font-bold text-white/35">{market.question}</p>
              <p className="text-[13px] font-black text-white">
                {selectedOutcome} <span className={`font-mono ${selectedTradeSide === "no" ? "text-red-400" : "text-[#31c45d]"}`}>{selectedTradeSide === "yes" ? "Yes" : "No"} {formatCents(selectedTradeSide === "yes" ? marketPrice(market, selectedIndex) : Math.max(0.01, Math.min(0.99, 1 - marketPrice(market, selectedIndex))))}</span>
              </p>
            </div>
            <button
              onClick={() => setMobileTradeOpen(true)}
              className="h-11 shrink-0 rounded-xl bg-[#087cff] px-5 text-[13px] font-black text-white shadow-lg shadow-[#087cff]/20"
            >
              Trade
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const HOLDER_NAMES = ["CryptoWhale", "PredictorX", "AlphaTrader", "MarketMaker", "DegenBull", "SmartMoney", "InfoTrader", "EliteHedge"];
const OUTCOME_COLORS = ["#8bc3ff", "#2997ff", "#31c45d", "#f97316"];

function TopHoldersPanel({ market }: { market: PolymarketMarket }) {
  const holders = HOLDER_NAMES.map((name, i) => ({
    name,
    outcome: market.outcomes[i % market.outcomes.length] ?? "Yes",
    // Deterministic per-index variation — Math.random() here ran during
    // render and produced different values on server vs client, causing a
    // hydration mismatch on /predictions.
    shares: Math.round(500 - i * 48 + ((i * 17) % 30)),
    value: Math.round((500 - i * 48) * (marketPrice(market, i % market.outcomes.length))),
    pnl: (i % 3 === 0 ? 1 : -1) * Math.round(10 + i * 7),
  }));
  return (
    <div className="space-y-2">
      {holders.map((h, i) => (
        <div key={h.name} className="flex items-center gap-3 rounded-xl bg-[#18191f] px-4 py-3 hover:bg-white/[0.06]">
          <span className="w-5 text-[12px] font-black text-white/30">{i + 1}</span>
          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 via-purple-500 to-amber-300" />
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-black text-white">{h.name}</p>
            <p className="text-[11px] font-semibold" style={{ color: OUTCOME_COLORS[market.outcomes.indexOf(h.outcome) % 4] }}>{h.outcome}</p>
          </div>
          <div className="text-right">
            <p className="text-[13px] font-black text-white">{h.shares} shares</p>
            <p className={`text-[11px] font-black ${h.pnl >= 0 ? "text-[#31c45d]" : "text-red-400"}`}>{h.pnl >= 0 ? "+" : ""}{h.pnl}¢</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function PositionsPanel({ market }: { market: PolymarketMarket }) {
  const positions = market.outcomes.flatMap((outcome, i) => {
    const price = marketPrice(market, i);
    return [
      { outcome, side: "Yes" as const, shares: Math.round(120 + i * 40), avgPrice: price, value: Math.round((120 + i * 40) * price * 100) },
      { outcome, side: "No" as const, shares: Math.round(80 + i * 25), avgPrice: 1 - price, value: Math.round((80 + i * 25) * (1 - price) * 100) },
    ];
  }).slice(0, 6);
  return (
    <div className="overflow-hidden rounded-xl border border-white/[0.06]">
      <table className="w-full text-left text-[13px]">
        <thead>
          <tr className="border-b border-white/[0.06] text-[11px] font-black uppercase tracking-wider text-white/35">
            <th className="px-4 py-3">Outcome</th>
            <th className="px-4 py-3">Side</th>
            <th className="px-4 py-3 text-right">Shares</th>
            <th className="px-4 py-3 text-right">Avg Price</th>
            <th className="px-4 py-3 text-right">Value</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/[0.04]">
          {positions.map((p, i) => (
            <tr key={i} className="hover:bg-[#18191f]">
              <td className="px-4 py-3 font-black text-white">{p.outcome}</td>
              <td className="px-4 py-3">
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${p.side === "Yes" ? "bg-[#31c45d]/15 text-[#31c45d]" : "bg-red-500/15 text-red-400"}`}>{p.side}</span>
              </td>
              <td className="px-4 py-3 text-right font-semibold text-white/80">{p.shares}</td>
              <td className="px-4 py-3 text-right font-semibold text-white/80">{(p.avgPrice * 100).toFixed(1)}¢</td>
              <td className="px-4 py-3 text-right font-black text-white">{p.value}¢</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const ACTIVITY_VERBS = ["bought", "sold", "bought", "bought", "sold", "bought", "sold", "bought"];
const ACTIVITY_NAMES = ["Whale07", "AlphaQ", "CryptoG", "MktMaker", "InfoTradr", "DgnBull", "SmartM", "Elitev2"];

function ActivityPanel({ market }: { market: PolymarketMarket }) {
  const items = ACTIVITY_NAMES.map((name, i) => {
    const outcomeIdx = i % market.outcomes.length;
    const price = marketPrice(market, outcomeIdx);
    const shares = 10 + i * 15;
    const minsAgo = i * 4 + 1;
    return { name, verb: ACTIVITY_VERBS[i], outcome: market.outcomes[outcomeIdx] ?? "Yes", shares, price, minsAgo };
  });
  return (
    <div className="space-y-1">
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-white/[0.04]">
          <div className="h-7 w-7 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 shrink-0" />
          <p className="flex-1 text-[13px] font-semibold text-white/80 min-w-0">
            <span className="font-black text-white">{item.name}</span>{" "}
            <span className={item.verb === "bought" ? "text-[#31c45d]" : "text-red-400"}>{item.verb}</span>{" "}
            {item.shares} shares of{" "}
            <span className="font-black text-white">{item.outcome}</span>{" "}
            at <span className="font-black text-white">{(item.price * 100).toFixed(1)}¢</span>
          </p>
          <span className="shrink-0 text-[11px] font-semibold text-white/30">{item.minsAgo}m ago</span>
        </div>
      ))}
    </div>
  );
}

function CommentsPanel({ comments, onAddComment }: { comments: DetailComment[]; onAddComment: (body: string) => Promise<boolean> }) {
  const [draft, setDraft] = useState("");
  const [holdersOnly, setHoldersOnly] = useState(false);
  const [posting, setPosting] = useState(false);
  const shown = comments
    .filter((comment) => !holdersOnly || Boolean(comment.holder))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  async function submit() {
    const body = draft.trim();
    if (!body || posting) return;
    setPosting(true);
    const posted = await onAddComment(body);
    if (posted) setDraft("");
    setPosting(false);
  }

  return (
    <>
      <div className="mb-4 rounded-xl border border-white/[0.06] bg-[#18191f] p-3">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Add a comment..."
          className="min-h-[76px] w-full resize-none bg-transparent text-[14px] font-semibold text-white outline-none placeholder:text-white/30"
        />
        <div className="mt-3 flex items-center justify-between">
          <span className="text-[11px] font-semibold text-white/25">{draft.length}/280</span>
          <button
            onClick={submit}
            disabled={!draft.trim() || posting || draft.length > 280}
            className="rounded-lg bg-[#087cff] px-4 py-2 text-[12px] font-black text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {posting ? "Posting..." : "Post"}
          </button>
        </div>
      </div>

      <div className="mb-5 flex items-center gap-4">
        <span className="text-[13px] font-black text-white">Newest</span>
        <label className="flex items-center gap-2 text-[12px] font-bold text-white/45">
          <input
            type="checkbox"
            checked={holdersOnly}
            onChange={(event) => setHoldersOnly(event.target.checked)}
            className="h-4 w-4 rounded accent-[#087cff]"
          />
          Holders
        </label>
        <span className="ml-auto rounded-full bg-white/[0.05] px-3 py-1 text-[11px] font-semibold text-white/35">Beware of external links.</span>
      </div>

      <div className="space-y-6">
        {shown.length === 0 && (
          <div className="rounded-xl border border-dashed border-white/10 px-5 py-8 text-center text-[13px] font-semibold text-white/35">
            {holdersOnly ? "No holder comments yet." : "No comments yet. Start the discussion."}
          </div>
        )}
        {shown.map((comment) => (
          <div key={comment.id} className="flex gap-3">
            {comment.avatarUrl ? (
              <img src={comment.avatarUrl} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover ring-1 ring-white/10" />
            ) : (
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 via-purple-500 to-amber-300 text-[12px] font-black text-white">
                {comment.author.slice(0, 1).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-black text-white">
                {comment.author}
                {comment.holder && <span className="ml-2 rounded bg-[#31c45d]/15 px-2 py-0.5 text-[10px] text-[#31c45d]">{comment.holder}</span>}
                <span className="ml-2 font-semibold text-white/35">{timeAgo(comment.createdAt)}</span>
              </p>
              <p className="mt-1 text-[14px] font-semibold text-white/85">{comment.body}</p>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function timeAgo(date: Date) {
  const mins = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/* ── Trade sheet (replaces old BetModal on browse cards) ───────────────── */
function TradeSheet({
  market,
  initialOutcome,
  balance,
  onClose,
  onSuccess,
}: {
  market:          PolymarketMarket;
  initialOutcome?: string;
  balance:         number;
  onClose:         () => void;
  onSuccess:       () => void;
}) {
  const topIdx = market.outcomePrices.reduce(
    (best, p, i) => (p > (market.outcomePrices[best] ?? 0) ? i : best),
    0,
  );
  const defaultOutcome = market.outcomes[topIdx] ?? market.outcomes[0] ?? "Yes";
  const [selectedOutcome, setSelectedOutcome] = useState(initialOutcome ?? defaultOutcome);
  const [selectedTradeSide, setSelectedTradeSide] = useState<"yes" | "no">(() =>
    initialOutcome?.toLowerCase() === "no" ? "no" : "yes",
  );

  function handleSelectSide(side: "yes" | "no") {
    setSelectedTradeSide(side);
    if (side === "yes") {
      const yesOutcome = market.outcomes.find((o) => o.toLowerCase() === "yes") ?? market.outcomes[0] ?? selectedOutcome;
      setSelectedOutcome(yesOutcome);
    } else {
      const noOutcome = market.outcomes.find((o) => o.toLowerCase() === "no") ?? market.outcomes[1] ?? selectedOutcome;
      setSelectedOutcome(noOutcome);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[120] flex items-end justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-lg animate-[slideUp_0.25s_ease-out]"
        onClick={(e) => e.stopPropagation()}
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="flex flex-col items-center bg-[#18191f] pt-3 pb-1 rounded-t-3xl">
          <div className="h-1 w-10 rounded-full bg-white/20 mb-2" />
          <button
            onClick={onClose}
            className="flex h-6 w-full max-w-xs items-center justify-center gap-1 text-[11px] font-black text-white/45 hover:text-white/70"
          >
            <ChevronDown className="h-4 w-4" /> Minimize trade
          </button>
        </div>
        <DetailTradeTicket
          market={market}
          selectedOutcome={selectedOutcome}
          selectedTradeSide={selectedTradeSide}
          balance={balance}
          onTradeSuccess={onSuccess}
          onViewBets={onClose}
          onSelectTradeSide={handleSelectSide}
          compact
        />
      </div>
      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to   { transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

/* ── Main component ─────────────────────────────────────────────────────── */
export function PolymarketClient({ userId, balance: initialBalance, initialMarkets = [] }: Props) {
  const { format } = useMoney();
  const [markets,  setMarkets]  = useState<PolymarketMarket[]>(initialMarkets);
  const [myBets,   setMyBets]   = useState<MyBet[]>([]);
  const [loading,  setLoading]  = useState(initialMarkets.length === 0);
  const [tab,      setTab]      = useState<"browse" | "my-bets">("browse");
  const [tag,      setTag]      = useState("Trending");
  // The mobile bottom-nav tabs drive the in-page view via `?tab=`.
  const searchParams = useSearchParams();
  const urlTab = searchParams.get("tab");
  useEffect(() => {
    if (urlTab === "my-bets") {
      setTab("my-bets");
    } else if (urlTab === "trending") {
      setTab("browse");
      setTag("Trending");
    } else if (urlTab === "browse" || !urlTab) {
      setTab("browse");
    }
  }, [urlTab]);
  const [ticket,   setTicket]   = useState<{ market: PolymarketMarket; outcome?: string; amount?: number } | null>(null);
  const [balance,  setBalance]  = useState(initialBalance);
  const [search,   setSearch]   = useState("");
  const [selectedMarket, setSelectedMarket] = useState<PolymarketMarket | null>(null);
  const [commentsByMarket, setCommentsByMarket] = useState<Record<string, DetailComment[]>>({});
  const [betsView, setBetsView] = useState<"open" | "resolved" | "all">("open");
  const tagBarRef = useRef<HTMLDivElement>(null);

  const hasLoadedRef = useRef(initialMarkets.length > 0);

  const fetchMarkets = useCallback(async () => {
    if (!hasLoadedRef.current) setLoading(true);
    const params = new URLSearchParams({ limit: "24" });

    if (tag === "Trending") {
      // default: sorted by volume — no extra params needed
    } else if (tag === "New") {
      params.set("order", "createdAt");
      params.set("ascending", "false");
    } else if (tag === "Breaking") {
      params.set("tag", "breaking");
    } else {
      params.set("tag", tag.toLowerCase());
    }

    const res = await fetch(`/api/polymarket/markets?${params}`);
    if (res.ok) {
      const data: PolymarketMarket[] = await res.json();
      const now = Date.now();
      setMarkets(data.filter((m) => {
        const end = new Date(m.endDate).getTime();
        return m.active && !m.closed && (!Number.isFinite(end) || end > now) &&
          !m.outcomePrices.some((p) => p <= 0.001 || p >= 0.999);
      }));
      hasLoadedRef.current = true;
    }
    setLoading(false);
  }, [tag]);

  const fetchMyBets = useCallback(async () => {
    if (!userId) return;
    const res = await fetch("/api/polymarket/my-bets", { cache: "no-store" });
    if (res.ok) setMyBets(await res.json());
  }, [userId]);

  const fetchBalance = useCallback(async () => {
    if (!userId) return;
    const res = await fetch("/api/wallet/balance");
    if (res.ok) {
      const data = await res.json();
      if (typeof data.balance === "number") setBalance(data.balance);
    }
  }, [userId]);

  const openMarket = useCallback((market: PolymarketMarket, options?: { replace?: boolean }) => {
    setSelectedMarket(market);
    setTab("browse");
    setSearch("");
    if (typeof window !== "undefined") {
      const url = marketUrl(market);
      if (window.location.pathname !== url) {
        window.history[options?.replace ? "replaceState" : "pushState"]({ marketId: market.conditionId }, "", url);
      }
    }
    scrollPolymarketTop();
  }, []);

  const openMarketById = useCallback(async (conditionId: string, options?: { replace?: boolean }) => {
    const existing = markets.find((m) => m.conditionId === conditionId);
    if (existing) {
      openMarket(existing, options);
      return;
    }

    const res = await fetch(`/api/polymarket/market?conditionId=${encodeURIComponent(conditionId)}`);
    if (!res.ok) {
      toast.error("Market details are not available");
      return;
    }
    const market = await res.json() as PolymarketMarket;
    setMarkets((current) => current.some((m) => m.conditionId === market.conditionId) ? current : [market, ...current]);
    openMarket(market, options);
  }, [markets, openMarket]);

  const openPosition = useCallback((bet: MyBet) => {
    void openMarketById(bet.marketId);
  }, [openMarketById]);

  useEffect(() => {
    fetchMarkets();
    // Refresh breaking news / hot topics every 2 minutes
    const id = setInterval(fetchMarkets, 2 * 60 * 1000);
    return () => clearInterval(id);
  }, [fetchMarkets]);
  useEffect(() => { if (tab === "my-bets" || selectedMarket) fetchMyBets(); }, [tab, selectedMarket, fetchMyBets]);
  useEffect(() => {
    if (typeof window !== "undefined" && window.location.pathname === "/predictions/my-bets") {
      setTab("my-bets");
      void fetchMyBets();
    } else {
      const conditionId = conditionIdFromPath();
      if (conditionId) void openMarketById(conditionId, { replace: true });
    }

    function onPopState() {
      if (window.location.pathname === "/predictions/my-bets") {
        setSelectedMarket(null);
        setTab("my-bets");
        void fetchMyBets();
      } else {
        const nextConditionId = conditionIdFromPath();
        if (nextConditionId) {
          void openMarketById(nextConditionId, { replace: true });
        } else {
          setSelectedMarket(null);
          setTab("browse");
        }
      }
    }

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [openMarketById, fetchMyBets]);

  function handleBetSuccess() {
    toast.success("Bet placed!");
    fetchBalance();
    fetchMyBets();
  }

  function viewMyBets() {
    setSelectedMarket(null);
    setTab("my-bets");
    if (typeof window !== "undefined" && window.location.pathname !== "/predictions/my-bets") {
      window.history.pushState({}, "", "/predictions/my-bets");
    }
    void fetchMyBets();
    scrollPolymarketTop();
  }

  function goBackToMarkets() {
    setTab("browse");
    setSelectedMarket(null);
    if (typeof window !== "undefined" && window.location.pathname !== "/predictions") {
      window.history.pushState({}, "", "/predictions");
    }
    scrollPolymarketTop();
  }

  const filtered = useMemo(() => {
    if (!search.trim()) return markets;
    const q = search.toLowerCase();
    return markets.filter((m) => m.question.toLowerCase().includes(q) || m.tags.some((t) => t.toLowerCase().includes(q)));
  }, [markets, search]);

  // Top markets by volume for hero carousel
  const heroMarkets = useMemo(() => [...markets].sort((a, b) => b.volume - a.volume).slice(0, 6), [markets]);
  // Breaking news = highest volume after hero
  const breakingMarkets = useMemo(() => [...markets].sort((a, b) => b.volume - a.volume), [markets]);
  // Grid = all filtered except the hero (first in filtered)
  const gridMarkets = filtered;
  const openBets = useMemo(() => myBets.filter((b) => b.status === "PENDING"), [myBets]);
  const resolvedBets = useMemo(() => myBets.filter((b) => b.status !== "PENDING"), [myBets]);
  const visibleBets = betsView === "open" ? openBets : betsView === "resolved" ? resolvedBets : myBets;
  const openStake = openBets.reduce((sum, b) => sum + b.stake, 0);
  const openToWin = openBets.reduce((sum, b) => sum + b.potentialWin, 0);

  const openBet = (market: PolymarketMarket, outcome?: string, amount?: number) => {
    const normalizedOutcome = outcome && market.outcomes.includes(outcome)
      ? outcome
      : market.outcomes.find((o) => o.toLowerCase() === "no" && outcome?.toLowerCase().startsWith("no"))
        ?? market.outcomes[0];
    setTicket({ market, outcome: normalizedOutcome, amount });
  };
  const selectedComments = selectedMarket ? commentsByMarket[selectedMarket.conditionId] ?? [] : [];

  const fetchComments = useCallback(async (marketId: string) => {
    const res = await fetch(`/api/polymarket/comments?marketId=${encodeURIComponent(marketId)}`);
    if (!res.ok) return;
    const data = await res.json() as Array<Omit<DetailComment, "createdAt"> & { createdAt: string }>;
    setCommentsByMarket((current) => ({
      ...current,
      [marketId]: data.map((comment) => ({ ...comment, createdAt: new Date(comment.createdAt) })),
    }));
  }, []);

  useEffect(() => {
    if (!selectedMarket) return;
    const marketId = selectedMarket.conditionId;
    void fetchComments(marketId);

    let cleanup = () => {};
    try {
      const supabase = createClient();
      const channel = supabase
        .channel(`polymarket-comments-${marketId}`)
        .on("postgres_changes", {
          event: "INSERT",
          schema: "public",
          table: "polymarket_comments",
          filter: `market_id=eq.${marketId}`,
        }, () => { void fetchComments(marketId); })
        .subscribe();
      cleanup = () => { void supabase.removeChannel(channel); };
    } catch { /* short polling-free fallback: refresh on next market open */ }
    return cleanup;
  }, [selectedMarket, fetchComments]);

  const addComment = async (body: string) => {
    if (!selectedMarket) return false;
    if (!userId) {
      toast.error("Sign in to comment");
      return false;
    }
    const res = await fetch("/api/polymarket/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        marketId: selectedMarket.conditionId,
        question: selectedMarket.question,
        body,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error ?? "Could not post comment");
      return false;
    }
    const comment = { ...data, createdAt: new Date(data.createdAt) } as DetailComment;
    setCommentsByMarket((current) => ({
      ...current,
      [selectedMarket.conditionId]: [
        comment,
        ...(current[selectedMarket.conditionId] ?? []).filter((item) => item.id !== comment.id),
      ],
    }));
    toast.success("Comment posted");
    return true;
  };

  return (
    <div className="flex flex-col gap-0 text-white">

      {/* ── Search ──────────────────────────────────────────────────────── */}
      {!selectedMarket && tab === "browse" && (
        <div className="mb-4 flex h-10 items-center gap-2.5 rounded-xl border border-white/[0.06] bg-[#18191f] px-4">
          <Search className="h-4 w-4 shrink-0 text-white/25" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search markets…"
            className="flex-1 bg-transparent text-[13px] font-semibold text-white outline-none placeholder:text-white/25"
          />
          {search && (
            <button type="button" onClick={() => setSearch("")} className="text-[11px] text-white/30 hover:text-white/60">
              ✕
            </button>
          )}
        </div>
      )}

      {/* ── Category nav strip ───────────────────────────────────────────── */}
      {tab === "browse" && !selectedMarket && (
        <div ref={tagBarRef} className="no-scrollbar mb-5 flex gap-0 overflow-x-auto border-b border-white/[0.06] pb-0">
          {TAGS.map((t) => (
            <button
              key={t}
              onClick={() => setTag(t)}
              className={`flex h-10 shrink-0 items-center gap-1.5 border-b-2 px-4 text-[13px] font-bold transition ${
                tag === t
                  ? "border-white text-white"
                  : "border-transparent text-white/45 hover:text-white/75"
              }`}
            >
              {t === "Trending" && <TrendingUp className="h-3.5 w-3.5" />}
              {t === "Breaking" && <Zap className="h-3.5 w-3.5" />}
              {t}
            </button>
          ))}
        </div>
      )}

      {tab === "browse" && selectedMarket && (
        <MarketDetailView
          market={selectedMarket}
          related={markets}
          balance={balance}
          myBets={myBets}
          onBack={() => {
            setSelectedMarket(null);
            if (typeof window !== "undefined" && window.location.pathname !== "/predictions") {
              window.history.pushState({}, "", "/predictions");
            }
          }}
          onTradeSuccess={handleBetSuccess}
          onViewBets={viewMyBets}
          onOpen={openMarket}
          comments={selectedComments}
          onAddComment={addComment}
        />
      )}

      {/* ── Browse ───────────────────────────────────────────────────────── */}
      {tab === "browse" && !selectedMarket && (
        <>
          {/* ── Mobile: flat card list (Polymarket style) ── */}
          <div className="flex flex-col lg:hidden">
            {loading ? (
              <div className="flex flex-col gap-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-28 animate-pulse rounded-2xl border border-white/[0.06] bg-[#18191f]" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="rounded-2xl border border-white/[0.06] bg-[#18191f] py-20 text-center">
                <p className="text-sm text-white/25">No markets found</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {filtered.map((m) => (
                  <CompactCard key={m.conditionId} market={m} onBet={openBet} onOpen={openMarket} />
                ))}
              </div>
            )}
          </div>

          {/* ── Desktop: hero + sidebar + grid ── */}
          <div className="hidden lg:flex lg:flex-col lg:gap-8">
            {/* Hero + sidebar row */}
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px] xl:grid-cols-[minmax(0,1fr)_320px]">
              <div>
                {loading ? (
                  <div className="h-72 animate-pulse rounded-2xl border border-white/[0.06] bg-[#18191f]" />
                ) : heroMarkets.length > 0 ? (
                  <HeroCarousel markets={heroMarkets} allMarkets={markets} onBet={openBet} onOpen={openMarket} />
                ) : null}
              </div>
              <div className="flex flex-col gap-4 lg:sticky lg:top-24 lg:self-start">
                {loading ? (
                  <>
                    <div className="h-52 animate-pulse rounded-2xl border border-white/[0.06] bg-[#18191f]" />
                    <div className="h-52 animate-pulse rounded-2xl border border-white/[0.06] bg-[#18191f]" />
                  </>
                ) : (
                  <>
                    <BreakingNews markets={breakingMarkets} onOpen={openMarket} />
                    <HotTopics markets={markets} onTagClick={(t) => { setTag(t); setSearch(""); }} />
                  </>
                )}
              </div>
            </div>

            {/* All markets grid */}
            <div>
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-xl font-black text-white">
                  {search ? `Results for "${search}"` : "All markets"}
                </h3>
                <span className="text-[12px] text-white/25">{filtered.length} markets</span>
              </div>
              {loading ? (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="h-44 animate-pulse rounded-2xl border border-white/[0.06] bg-[#18191f]" />
                  ))}
                </div>
              ) : gridMarkets.length === 0 ? (
                <div className="rounded-2xl border border-white/[0.06] bg-[#18191f] py-20 text-center">
                  <p className="text-sm text-white/25">No markets found</p>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {gridMarkets.map((m) => (
                    <CompactCard key={m.conditionId} market={m} onBet={openBet} onOpen={openMarket} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── My Bets ──────────────────────────────────────────────────────── */}
      {tab === "my-bets" && (
        <div className="mx-auto w-full max-w-6xl">
          <button
            onClick={goBackToMarkets}
            className="mb-5 inline-flex items-center gap-2 text-[13px] font-black text-white/45 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" /> Markets
          </button>

          {!userId ? (
            <div className="rounded-2xl border border-white/[0.06] bg-[#18191f] py-20 text-center">
              <p className="text-sm text-white/30">Sign in to see your bets</p>
            </div>
          ) : myBets.length === 0 ? (
            <div className="rounded-2xl border border-white/[0.06] bg-[#18191f] py-20 text-center">
              <p className="text-sm text-white/30">No bets yet</p>
              <button
                onClick={goBackToMarkets}
                className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/[0.06] px-5 py-2.5 text-sm font-bold text-white/60 hover:bg-white/10 hover:text-white transition"
              >
                Browse Markets <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/[0.07] bg-[#18191f] p-4">
                  <p className="text-[11px] font-black uppercase tracking-wide text-white/35">Open positions</p>
                  <p className="mt-2 text-2xl font-black text-white">{openBets.length}</p>
                </div>
                <div className="rounded-2xl border border-white/[0.07] bg-[#18191f] p-4">
                  <p className="text-[11px] font-black uppercase tracking-wide text-white/35">Capital at risk</p>
                  <p className="mt-2 text-2xl font-black text-white">{format(openStake)}</p>
                </div>
                <div className="rounded-2xl border border-white/[0.07] bg-[#18191f] p-4">
                  <p className="text-[11px] font-black uppercase tracking-wide text-white/35">Open payout</p>
                  <p className="mt-2 text-2xl font-black text-[#31c45d]">{format(openToWin)}</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-black text-white">My positions</h2>
                  <p className="mt-1 text-sm text-white/35">Track pending bets, entry price, stake, and potential payout.</p>
                </div>
                <div className="grid grid-cols-3 rounded-xl border border-white/[0.06] bg-[#18191f] p-1">
                  {([
                    ["open", `Open ${openBets.length}`],
                    ["resolved", `Resolved ${resolvedBets.length}`],
                    ["all", `All ${myBets.length}`],
                  ] as const).map(([value, label]) => (
                    <button
                      key={value}
                      onClick={() => setBetsView(value)}
                      className={`h-9 rounded-lg px-3 text-[12px] font-black ${betsView === value ? "bg-[#087cff] text-white" : "text-white/40 hover:text-white/70"}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {visibleBets.length === 0 ? (
                <div className="rounded-2xl border border-white/[0.06] bg-[#18191f] py-14 text-center">
                  <p className="text-sm text-white/30">No positions in this view</p>
                </div>
              ) : (
                <div className="grid gap-3 xl:grid-cols-2">
                  {visibleBets.map((b) => <PositionCard key={b.id} bet={b} onOpen={openPosition} />)}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Trade sheet (card quick-bet) ─────────────────────────────── */}
      {ticket && (
        <TradeSheet
          market={ticket.market}
          initialOutcome={ticket.outcome}
          balance={balance}
          onClose={() => setTicket(null)}
          onSuccess={handleBetSuccess}
        />
      )}
    </div>
  );
}
