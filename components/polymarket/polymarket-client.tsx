"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Image from "next/image";
import { ArrowLeft, ArrowRight, Bookmark, ChevronRight, Flame, Search, TrendingUp, Zap } from "lucide-react";
import { formatEndDate, formatMarketMoney } from "./market-card";
import { ProbabilityChart } from "./probability-chart";
import { BetModal }   from "./bet-modal";
import { toast }      from "@/lib/toast";
import type { PolymarketMarket } from "@/lib/polymarket";

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
  settledAt:    string | null;
  createdAt:    string;
}

interface Props {
  userId?:  string;
  balance:  number;
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
function HeroCard({ market, onBet }: { market: PolymarketMarket; onBet: (m: PolymarketMarket, o?: string) => void }) {
  const yesIdx  = market.outcomes.findIndex((o) => o.toLowerCase() === "yes");
  const noIdx   = market.outcomes.findIndex((o) => o.toLowerCase() === "no");
  const yesP    = Math.max(0.01, yesIdx >= 0 ? market.outcomePrices[yesIdx] : market.outcomePrices[0] ?? 0.5);
  const noP     = Math.max(0.01, noIdx  >= 0 ? market.outcomePrices[noIdx]  : market.outcomePrices[1] ?? 1 - yesP);
  const yesLbl  = yesIdx >= 0 ? market.outcomes[yesIdx] : market.outcomes[0] ?? "Yes";
  const noLbl   = noIdx  >= 0 ? market.outcomes[noIdx]  : market.outcomes[1] ?? "No";
  const yesMult = yesP > 0 ? (1 / yesP).toFixed(2) : "—";
  const noMult  = noP  > 0 ? (1 / noP).toFixed(2)  : "—";

  return (
    <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#1a1b22]">
      {/* ── Top header row ── */}
      <div className="flex items-center justify-between gap-4 border-b border-white/[0.06] px-5 pt-4 pb-3">
        <div className="flex items-center gap-3">
          {market.image ? (
            <Image src={market.image} alt="" width={44} height={44} unoptimized className="h-11 w-11 shrink-0 rounded-xl object-cover" />
          ) : (
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500 text-xl font-black text-white">?</div>
          )}
          <div>
            <p className="text-lg font-black leading-tight text-white">{market.question}</p>
            <p className="text-[11px] text-white/35">{formatEndDate(market.endDate)} · {market.tags.slice(0,2).join(" · ")}</p>
          </div>
        </div>
        <div className="hidden items-center gap-8 sm:flex">
          <div className="text-right">
            <p className="text-[11px] font-bold text-white/35">Top outcome</p>
            <p className="text-xl font-black text-white">{(yesP * 100).toFixed(0)}%</p>
          </div>
          <div className="text-right">
            <p className="text-[11px] font-bold text-white/35">Ends in</p>
            <p className="text-xl"><Countdown endDate={market.endDate} /></p>
          </div>
        </div>
      </div>

      {/* ── Outcome buttons + chart ── */}
      <div className="grid grid-cols-1 gap-0 sm:grid-cols-[300px_1fr]">
        {/* Left: buttons + stats */}
        <div className="flex flex-col gap-3 border-r border-white/[0.06] p-5">
          <button
            onClick={() => onBet(market, yesLbl)}
            className="flex h-14 items-center justify-between rounded-xl px-5 transition"
            style={{ background: "rgba(133,77,14,0.55)" }}
          >
            <span className="text-sm font-black uppercase tracking-wide text-amber-300">{yesLbl}</span>
            <span className="text-lg font-black text-white">{yesMult}×</span>
          </button>
          <button
            onClick={() => onBet(market, noLbl)}
            className="flex h-14 items-center justify-between rounded-xl bg-white/[0.07] px-5 transition hover:bg-white/[0.11]"
          >
            <span className="text-sm font-black uppercase tracking-wide text-white/60">{noLbl}</span>
            <span className="text-lg font-black text-white/50">{noMult}×</span>
          </button>

          {/* mini chat / activity feed placeholder */}
          <div className="mt-1 flex flex-col gap-2.5 overflow-hidden">
            {[
              { user: "Trader_A",   msg: "Watching this closely today" },
              { user: "CryptoFan",  msg: "The momentum looks strong here" },
              { user: "Analyst_K",  msg: "Could swing either way honestly" },
            ].map(({ user, msg }) => (
              <div key={user} className="flex items-start gap-2">
                <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/[0.08] text-[8px] font-black text-white/40">
                  {user[0]}
                </div>
                <div>
                  <p className="text-[11px] font-bold text-white/60">{user}</p>
                  <p className="text-[11px] leading-snug text-white/30 line-clamp-1">{msg}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-auto pt-2 text-[11px] font-bold text-white/25">
            {formatMarketMoney(market.volume)} Vol.
          </div>
        </div>

        {/* Right: real probability chart */}
        <div className="flex flex-col gap-0">
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

/* ── Hero carousel (wraps multiple hero markets) ───────────────────────── */
function HeroCarousel({ markets, onBet }: { markets: PolymarketMarket[]; onBet: (m: PolymarketMarket, o?: string) => void }) {
  const [idx, setIdx] = useState(0);
  const total = Math.min(markets.length, 6);

  if (total === 0) return null;
  const cur = markets[idx];

  return (
    <div className="flex flex-col gap-3">
      <HeroCard market={cur} onBet={onBet} />
      {/* Dot nav + prev/next */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-1.5">
          {Array.from({ length: total }).map((_, i) => (
            <button
              key={i}
              onClick={() => setIdx(i)}
              className={`rounded-full transition-all ${i === idx ? "w-6 h-1.5 bg-white/60" : "w-1.5 h-1.5 bg-white/20 hover:bg-white/40"}`}
            />
          ))}
        </div>
        <div className="flex items-center gap-2">
          {idx > 0 && (
            <button
              onClick={() => setIdx(i => Math.max(0, i - 1))}
              className="flex h-8 items-center gap-1.5 rounded-full border border-white/[0.08] px-3 text-[12px] font-bold text-white/40 hover:bg-white/[0.05] hover:text-white/70"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              {markets[idx - 1]?.question.slice(0, 20)}…
            </button>
          )}
          {idx < total - 1 && (
            <button
              onClick={() => setIdx(i => Math.min(total - 1, i + 1))}
              className="flex h-8 items-center gap-1.5 rounded-full border border-white/[0.08] px-3 text-[12px] font-bold text-white/40 hover:bg-white/[0.05] hover:text-white/70"
            >
              {markets[idx + 1]?.question.slice(0, 20)}…
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Breaking news sidebar ──────────────────────────────────────────────── */
function BreakingNews({ markets, onBet }: { markets: PolymarketMarket[]; onBet: (m: PolymarketMarket, o?: string) => void }) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-[#1a1b22] p-5">
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
              onClick={() => onBet(m)}
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
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([tag, vol]) => ({ tag, vol }));
  }, [markets]);

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-[#1a1b22] p-5">
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
            <span className="text-[12px] text-white/35">{formatMarketMoney(vol)} today</span>
            <Flame className="h-4 w-4 shrink-0 text-orange-400" />
            <ChevronRight className="h-4 w-4 shrink-0 text-white/20" />
          </button>
        ))}
      </div>
      <button className="mt-4 w-full rounded-xl border border-white/[0.08] py-2.5 text-[13px] font-black text-white/40 transition hover:bg-white/[0.04] hover:text-white/70">
        Explore all
      </button>
    </div>
  );
}

/* ── Compact 4-col market card ──────────────────────────────────────────── */
function CompactCard({ market, onBet }: { market: PolymarketMarket; onBet: (m: PolymarketMarket, o?: string) => void }) {
  const outcomes = market.outcomes.slice(0, 3);
  const prices   = market.outcomePrices;

  return (
    <div className="flex flex-col rounded-2xl border border-white/[0.07] bg-[#1a1b22] p-4 transition hover:border-white/[0.14] hover:bg-[#1f2029]">
      {/* Header */}
      <div className="mb-3 flex items-start gap-2.5">
        {market.image ? (
          <Image src={market.image} alt="" width={36} height={36} unoptimized className="h-9 w-9 shrink-0 rounded-lg object-cover" />
        ) : (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] text-[10px] font-black text-white/30">?</div>
        )}
        <p className="text-[13px] font-semibold leading-snug text-white/85 line-clamp-2">{market.question}</p>
      </div>

      {/* Outcome rows */}
      <div className="flex flex-col gap-1.5 flex-1">
        {outcomes.map((outcome, i) => {
          const p = Math.round((prices[i] ?? 0.5) * 100);
          return (
            <div key={`${outcome}-${i}`} className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate text-[12px] text-white/50">{outcome}</span>
              <span className="w-9 shrink-0 text-right text-[12px] font-black text-white/70">{p}%</span>
              <button
                onClick={() => onBet(market, outcome)}
                className="h-6 rounded-md bg-[#31c45d]/15 px-2 text-[11px] font-black text-[#31c45d] transition hover:bg-[#31c45d]/25"
              >
                Yes
              </button>
              <button
                onClick={() => onBet(market, `No — ${outcome}`)}
                className="h-6 rounded-md bg-red-500/15 px-2 text-[11px] font-black text-red-400 transition hover:bg-red-500/25"
              >
                No
              </button>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="mt-3 flex items-center justify-between border-t border-white/[0.05] pt-2.5">
        <span className="text-[11px] font-bold text-white/25">{formatMarketMoney(market.volume)} Vol.</span>
        <div className="flex items-center gap-2">
          <button className="text-white/15 hover:text-white/40 transition">
            <Bookmark className="h-3.5 w-3.5" />
          </button>
          <span className="text-[10px] text-white/20">{formatEndDate(market.endDate)}</span>
        </div>
      </div>
    </div>
  );
}

/* ── Main component ─────────────────────────────────────────────────────── */
export function PolymarketClient({ userId, balance: initialBalance }: Props) {
  const [markets,  setMarkets]  = useState<PolymarketMarket[]>([]);
  const [myBets,   setMyBets]   = useState<MyBet[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [tab,      setTab]      = useState<"browse" | "my-bets">("browse");
  const [tag,      setTag]      = useState("Trending");
  const [ticket,   setTicket]   = useState<{ market: PolymarketMarket; outcome?: string } | null>(null);
  const [balance,  setBalance]  = useState(initialBalance);
  const [search,   setSearch]   = useState("");
  const tagBarRef = useRef<HTMLDivElement>(null);

  const fetchMarkets = useCallback(async () => {
    setLoading(true);
    const apiTag = ["Trending", "Breaking", "New"].includes(tag) ? "" : tag;
    const url    = apiTag ? `/api/polymarket/markets?tag=${encodeURIComponent(apiTag)}` : "/api/polymarket/markets";
    const res    = await fetch(url);
    if (res.ok) setMarkets(await res.json());
    setLoading(false);
  }, [tag]);

  const fetchMyBets = useCallback(async () => {
    if (!userId) return;
    const res = await fetch("/api/polymarket/my-bets");
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

  useEffect(() => { fetchMarkets(); }, [fetchMarkets]);
  useEffect(() => { if (tab === "my-bets") fetchMyBets(); }, [tab, fetchMyBets]);

  function handleBetSuccess() {
    toast.success("Bet placed!");
    fetchBalance();
    if (tab === "my-bets") fetchMyBets();
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

  const openBet = (market: PolymarketMarket, outcome?: string) => setTicket({ market, outcome });

  return (
    <div className="flex flex-col gap-0 text-white">

      {/* ── Search + balance bar ─────────────────────────────────────────── */}
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 flex-1 items-center gap-2.5 rounded-xl border border-white/[0.08] bg-[#1a1b22] px-4">
          <Search className="h-4 w-4 shrink-0 text-white/25" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search markets…"
            className="flex-1 bg-transparent text-[13px] font-semibold text-white outline-none placeholder:text-white/25"
          />
          {search && <button onClick={() => setSearch("")} className="text-[11px] text-white/30 hover:text-white/60">✕</button>}
        </div>
        <div className="hidden h-10 items-center gap-2 rounded-xl border border-white/[0.08] bg-[#1a1b22] px-4 sm:flex">
          <span className="text-[11px] font-black uppercase tracking-widest text-white/25">Balance</span>
          <span className="font-black text-white">KSh {Math.floor(balance).toLocaleString()}</span>
        </div>
        <button
          onClick={() => setTab(tab === "browse" ? "my-bets" : "browse")}
          className={`h-10 rounded-xl px-4 text-[13px] font-black transition ${
            tab === "my-bets" ? "bg-[#087cff] text-white" : "border border-white/[0.08] bg-[#1a1b22] text-white/50 hover:text-white"
          }`}
        >
          My Bets
        </button>
      </div>

      {/* ── Category nav strip ───────────────────────────────────────────── */}
      {tab === "browse" && (
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

      {/* ── Browse ───────────────────────────────────────────────────────── */}
      {tab === "browse" && (
        <div className="flex flex-col gap-8">

          {/* Hero + sidebar row */}
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px] xl:grid-cols-[minmax(0,1fr)_320px]">
            {/* Hero carousel */}
            <div>
              {loading ? (
                <div className="h-72 animate-pulse rounded-2xl border border-white/[0.06] bg-white/[0.03]" />
              ) : heroMarkets.length > 0 ? (
                <HeroCarousel markets={heroMarkets} onBet={openBet} />
              ) : null}
            </div>

            {/* Right sidebar */}
            <div className="flex flex-col gap-4 lg:sticky lg:top-24 lg:self-start">
              {loading ? (
                <>
                  <div className="h-52 animate-pulse rounded-2xl border border-white/[0.06] bg-white/[0.03]" />
                  <div className="h-52 animate-pulse rounded-2xl border border-white/[0.06] bg-white/[0.03]" />
                </>
              ) : (
                <>
                  <BreakingNews markets={breakingMarkets} onBet={openBet} />
                  <HotTopics markets={markets} onTagClick={(t) => { setTag(t); setSearch(""); }} />
                </>
              )}
            </div>
          </div>

          {/* All markets grid (4 col) */}
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
                  <div key={i} className="h-44 animate-pulse rounded-2xl border border-white/[0.06] bg-white/[0.03]" />
                ))}
              </div>
            ) : gridMarkets.length === 0 ? (
              <div className="rounded-2xl border border-white/[0.06] bg-[#1a1b22] py-20 text-center">
                <p className="text-sm text-white/25">No markets found</p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {gridMarkets.map((m) => (
                  <CompactCard key={m.conditionId} market={m} onBet={openBet} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── My Bets ──────────────────────────────────────────────────────── */}
      {tab === "my-bets" && (
        <div>
          {!userId ? (
            <div className="rounded-2xl border border-white/[0.06] bg-[#1a1b22] py-20 text-center">
              <p className="text-sm text-white/30">Sign in to see your bets</p>
            </div>
          ) : myBets.length === 0 ? (
            <div className="rounded-2xl border border-white/[0.06] bg-[#1a1b22] py-20 text-center">
              <p className="text-sm text-white/30">No bets yet</p>
              <button
                onClick={() => setTab("browse")}
                className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/[0.06] px-5 py-2.5 text-sm font-bold text-white/60 hover:bg-white/10 hover:text-white transition"
              >
                Browse Markets <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {myBets.map((b) => (
                <div key={b.id} className="rounded-2xl border border-white/[0.06] bg-[#1a1b22] p-5">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <p className="flex-1 text-[15px] font-semibold leading-snug text-white line-clamp-2">{b.question}</p>
                    <StatusBadge status={b.status} />
                  </div>
                  <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-white/40">
                    <span>
                      <span className={b.outcome.toLowerCase() === "yes" ? "text-[#31c45d]" : "text-red-400"}>{b.outcome}</span>
                      {" "}@ {(b.price * 100).toFixed(0)}¢ ({(1 / b.price).toFixed(2)}×)
                    </span>
                    <span>Stake: <span className="font-black text-white">KSh {b.stake.toLocaleString()}</span></span>
                    <span>
                      {b.status === "WON"
                        ? <span className="font-black text-[#31c45d]">Won KSh {b.winAmount?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        : b.status === "LOST"
                        ? <span className="font-black text-red-400">Lost</span>
                        : <span>To win: <span className="font-black text-white">KSh {b.potentialWin.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></span>
                      }
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Bet modal ────────────────────────────────────────────────────── */}
      {ticket && (
        <BetModal
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
