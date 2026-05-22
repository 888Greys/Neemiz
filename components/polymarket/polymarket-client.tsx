"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Image from "next/image";
import { ArrowRight, ChevronRight, Search, TrendingUp, Zap, Flame } from "lucide-react";
import { MarketCard, formatEndDate, formatMarketMoney } from "./market-card";
import { BetModal }   from "./bet-modal";
import { toast }      from "@/lib/toast";
import type { PolymarketMarket } from "@/lib/polymarket";

const TAGS = [
  "Trending", "Breaking", "New",
  "Politics", "Sports", "Crypto",
  "Esports", "Finance", "Geopolitics",
  "Tech", "Culture", "Economy",
  "Weather", "Elections",
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

/* ── Tiny sparkline bars ───────────────────────────────────────────────── */
function MiniBar({ pct, up }: { pct: number; up: boolean }) {
  return (
    <div className="flex h-5 items-end gap-px">
      {[0.4, 0.6, 0.5, 0.8, up ? 1 : 0.3, up ? 0.9 : 0.2].map((h, i) => (
        <div
          key={i}
          className="w-[3px] rounded-sm"
          style={{
            height: `${h * 100}%`,
            background: up ? "#31c45d" : "#ef4444",
            opacity: 0.6 + h * 0.4,
          }}
        />
      ))}
    </div>
  );
}

/* ── Hero featured market card ─────────────────────────────────────────── */
function HeroCard({ market, onBet }: { market: PolymarketMarket; onBet: (market: PolymarketMarket, outcome?: string) => void }) {
  const yesIdx  = market.outcomes.findIndex((o) => o.toLowerCase() === "yes");
  const noIdx   = market.outcomes.findIndex((o) => o.toLowerCase() === "no");
  const yesP    = yesIdx >= 0 ? market.outcomePrices[yesIdx] : market.outcomePrices[0] ?? 0.5;
  const noP     = noIdx  >= 0 ? market.outcomePrices[noIdx]  : market.outcomePrices[1] ?? (1 - yesP);
  const yesLbl  = yesIdx >= 0 ? market.outcomes[yesIdx] : market.outcomes[0] ?? "Yes";
  const noLbl   = noIdx  >= 0 ? market.outcomes[noIdx]  : market.outcomes[1] ?? "No";

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[#16171c]">
      {/* Background image blurred */}
      {market.image && (
        <div className="absolute inset-0">
          <Image
            src={market.image}
            alt=""
            fill
            unoptimized
            className="object-cover opacity-[0.07] blur-sm"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#16171c] via-[#16171c]/95 to-[#16171c]/60" />
        </div>
      )}

      <div className="relative z-10 flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:gap-8">
        {/* Left: text content */}
        <div className="flex-1 min-w-0">
          {/* Tag strip */}
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {market.tags.slice(0, 2).map((t) => (
              <span key={t} className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-widest text-white/40">
                {t}
              </span>
            ))}
            <span className="text-[11px] text-white/30">Ends {formatEndDate(market.endDate)}</span>
          </div>

          <h2 className="text-2xl font-black leading-snug text-white sm:text-3xl">
            {market.question}
          </h2>

          <div className="mt-4 flex items-center gap-5 text-sm text-white/40">
            <span><span className="font-black text-white/60">{formatMarketMoney(market.volume)}</span> vol.</span>
            <span><span className="font-black text-white/60">{formatMarketMoney(market.liquidity)}</span> liq.</span>
          </div>

          {/* Probability bar */}
          <div className="mt-5">
            <div className="mb-2 flex items-center justify-between text-xs font-bold">
              <span className="text-[#31c45d]">{yesLbl} · {(yesP * 100).toFixed(0)}%</span>
              <span className="text-red-400">{noLbl} · {(noP * 100).toFixed(0)}%</span>
            </div>
            <div className="flex h-2 overflow-hidden rounded-full bg-white/10">
              <div className="rounded-full bg-[#31c45d] transition-all" style={{ width: `${Math.min(100, yesP * 100)}%` }} />
              <div className="ml-auto rounded-full bg-red-500/60 transition-all" style={{ width: `${Math.min(100, noP * 100)}%` }} />
            </div>
          </div>

          {/* Bet buttons */}
          <div className="mt-5 flex gap-3">
            <button
              onClick={() => onBet(market, yesLbl)}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#31c45d]/15 py-3 text-sm font-black text-[#31c45d] transition hover:bg-[#31c45d]/25"
            >
              {yesLbl}
              <span className="font-mono text-white">{(yesP * 100).toFixed(0)}¢</span>
            </button>
            <button
              onClick={() => onBet(market, noLbl)}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-500/15 py-3 text-sm font-black text-red-400 transition hover:bg-red-500/25"
            >
              {noLbl}
              <span className="font-mono text-white">{(noP * 100).toFixed(0)}¢</span>
            </button>
          </div>
        </div>

        {/* Right: market image */}
        {market.image && (
          <div className="hidden shrink-0 sm:block">
            <Image
              src={market.image}
              alt=""
              width={200}
              height={160}
              unoptimized
              className="h-40 w-48 rounded-xl object-cover ring-1 ring-white/10"
            />
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Right-sidebar: Breaking news ──────────────────────────────────────── */
function BreakingNews({ markets, onBet }: { markets: PolymarketMarket[]; onBet: (m: PolymarketMarket, o?: string) => void }) {
  const items = markets.slice(0, 4);
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-[#16171c] p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-amber-400" />
          <span className="text-sm font-black text-white">Breaking news</span>
        </div>
        <button className="text-[11px] font-bold text-white/30 hover:text-white/60 flex items-center gap-1">
          More <ChevronRight className="h-3 w-3" />
        </button>
      </div>

      <div className="space-y-3">
        {items.map((m) => {
          const topIdx = m.outcomePrices.reduce((best, p, i) => p > m.outcomePrices[best] ? i : best, 0);
          const topPct = Math.round((m.outcomePrices[topIdx] ?? 0.5) * 100);
          const topLbl = m.outcomes[topIdx] ?? "Yes";
          const up     = (m.outcomePrices[0] ?? 0.5) > 0.5;

          return (
            <button
              key={m.conditionId}
              onClick={() => onBet(m)}
              className="group flex w-full items-start gap-3 rounded-xl p-2.5 text-left transition hover:bg-white/[0.04]"
            >
              {m.image && (
                <Image
                  src={m.image}
                  alt=""
                  width={40}
                  height={40}
                  unoptimized
                  className="h-10 w-10 shrink-0 rounded-lg object-cover"
                />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold leading-snug text-white/80 line-clamp-2 group-hover:text-white">
                  {m.question}
                </p>
                <div className="mt-1.5 flex items-center gap-2">
                  <span className={`text-[11px] font-black ${up ? "text-[#31c45d]" : "text-red-400"}`}>
                    {topLbl} {topPct}%
                  </span>
                  <span className="text-[10px] text-white/25">{formatMarketMoney(m.volume)} vol</span>
                </div>
              </div>
              <MiniBar pct={topPct} up={up} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ── Right-sidebar: Hot topics ─────────────────────────────────────────── */
function HotTopics({ markets, onTagClick }: { markets: PolymarketMarket[]; onTagClick: (tag: string) => void }) {
  const topics = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of markets) {
      for (const tag of m.tags) {
        map.set(tag, (map.get(tag) ?? 0) + m.volume);
      }
    }
    return [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([tag, vol]) => ({ tag, vol }));
  }, [markets]);

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-[#16171c] p-5">
      <div className="mb-4 flex items-center gap-2">
        <Flame className="h-4 w-4 text-orange-400" />
        <span className="text-sm font-black text-white">Hot topics</span>
      </div>

      <div className="space-y-1">
        {topics.map(({ tag, vol }, i) => (
          <button
            key={tag}
            onClick={() => onTagClick(tag)}
            className="flex w-full items-center justify-between rounded-lg px-2 py-2.5 text-left transition hover:bg-white/[0.04]"
          >
            <div className="flex items-center gap-3">
              <span className="w-4 text-center text-[11px] font-black text-white/20">{i + 1}</span>
              <span className="text-[13px] font-semibold text-white/70">{tag}</span>
            </div>
            <span className="text-[11px] font-bold text-white/35">{formatMarketMoney(vol)} today</span>
          </button>
        ))}
      </div>

      <button className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-white/[0.08] py-2.5 text-sm font-black text-white/50 transition hover:border-white/15 hover:text-white/80">
        Explore all
        <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  );
}

/* ── Main component ────────────────────────────────────────────────────── */
export function PolymarketClient({ userId, balance: initialBalance }: Props) {
  const [markets,  setMarkets]  = useState<PolymarketMarket[]>([]);
  const [myBets,   setMyBets]   = useState<MyBet[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [tab,      setTab]      = useState<"browse" | "my-bets">("browse");
  const [tag,      setTag]      = useState("Trending");
  const [ticket,   setTicket]   = useState<{ market: PolymarketMarket; outcome?: string } | null>(null);
  const [balance,  setBalance]  = useState(initialBalance);
  const [search,   setSearch]   = useState("");

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

  const hero        = filtered[0] ?? null;
  const gridMarkets = filtered.slice(1);

  return (
    <div className="flex flex-col gap-0 text-white">

      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <div className="mb-4 flex items-center gap-3">
        {/* Search */}
        <div className="flex h-11 flex-1 items-center gap-2.5 rounded-xl border border-white/[0.08] bg-[#16171c] px-4">
          <Search className="h-4 w-4 shrink-0 text-white/25" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search markets…"
            className="flex-1 bg-transparent text-[14px] font-semibold text-white outline-none placeholder:text-white/25"
          />
          {search && (
            <button onClick={() => setSearch("")} className="text-white/30 hover:text-white/60 text-xs">✕</button>
          )}
        </div>

        {/* Balance */}
        <div className="hidden h-11 items-center gap-2 rounded-xl border border-white/[0.08] bg-[#16171c] px-4 sm:flex">
          <span className="text-[11px] font-black uppercase tracking-widest text-white/25">Balance</span>
          <span className="font-black text-white">KSh {Math.floor(balance).toLocaleString()}</span>
        </div>

        {/* My Bets toggle */}
        <button
          onClick={() => setTab(tab === "browse" ? "my-bets" : "browse")}
          className={`h-11 rounded-xl px-4 text-sm font-black transition ${
            tab === "my-bets"
              ? "bg-[#087cff] text-white"
              : "border border-white/[0.08] bg-[#16171c] text-white/50 hover:text-white"
          }`}
        >
          My Bets {myBets.length > 0 && tab === "my-bets" && `(${myBets.length})`}
        </button>
      </div>

      {/* ── Category nav strip ──────────────────────────────────────────── */}
      {tab === "browse" && (
        <div className="no-scrollbar mb-5 flex gap-1 overflow-x-auto">
          {TAGS.map((t) => (
            <button
              key={t}
              onClick={() => setTag(t)}
              className={`flex h-9 shrink-0 items-center gap-1.5 rounded-full px-4 text-[13px] font-bold transition ${
                tag === t
                  ? "bg-white text-black"
                  : "bg-[#1e1f26] text-white/50 hover:bg-white/[0.08] hover:text-white/80"
              }`}
            >
              {t === "Trending" && <TrendingUp className="h-3.5 w-3.5" />}
              {t === "Breaking" && <Zap className="h-3.5 w-3.5" />}
              {t}
            </button>
          ))}
        </div>
      )}

      {/* ── Browse layout ────────────────────────────────────────────────── */}
      {tab === "browse" && (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px] xl:grid-cols-[minmax(0,1fr)_320px]">

          {/* ── Left: hero + grid ──────────────────────────────────────── */}
          <div className="flex flex-col gap-5 min-w-0">

            {/* Hero card */}
            {loading ? (
              <div className="h-56 animate-pulse rounded-2xl border border-white/[0.06] bg-white/[0.03]" />
            ) : hero ? (
              <HeroCard market={hero} onBet={(m, o) => setTicket({ market: m, outcome: o })} />
            ) : null}

            {/* Section label */}
            {!loading && gridMarkets.length > 0 && (
              <div className="flex items-center justify-between">
                <h3 className="text-[13px] font-black uppercase tracking-widest text-white/30">
                  {search ? `Results for "${search}"` : "All markets"}
                </h3>
                <span className="text-[11px] text-white/20">{filtered.length} markets</span>
              </div>
            )}

            {/* Markets grid */}
            {loading ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-44 animate-pulse rounded-2xl border border-white/[0.06] bg-white/[0.03]" />
                ))}
              </div>
            ) : gridMarkets.length === 0 && !hero ? (
              <div className="rounded-2xl border border-white/[0.06] bg-[#16171c] py-20 text-center">
                <p className="text-sm text-white/25">No markets found</p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {gridMarkets.map((m) => (
                  <MarketCard
                    key={m.conditionId}
                    market={m}
                    active={false}
                    onSelect={(market) => setTicket({ market })}
                    onBet={(market, outcome) => setTicket({ market, outcome })}
                  />
                ))}
              </div>
            )}
          </div>

          {/* ── Right: sidebar ─────────────────────────────────────────── */}
          <div className="flex flex-col gap-4 lg:sticky lg:top-24 lg:self-start">
            {loading ? (
              <>
                <div className="h-64 animate-pulse rounded-2xl border border-white/[0.06] bg-white/[0.03]" />
                <div className="h-52 animate-pulse rounded-2xl border border-white/[0.06] bg-white/[0.03]" />
              </>
            ) : (
              <>
                <BreakingNews
                  markets={[...markets].sort((a, b) => b.volume - a.volume).slice(0, 4)}
                  onBet={(m, o) => setTicket({ market: m, outcome: o })}
                />
                <HotTopics
                  markets={markets}
                  onTagClick={(t) => { setTag(t); setSearch(""); }}
                />
              </>
            )}
          </div>
        </div>
      )}

      {/* ── My Bets ──────────────────────────────────────────────────────── */}
      {tab === "my-bets" && (
        <div>
          {!userId ? (
            <div className="rounded-2xl border border-white/[0.06] bg-[#16171c] py-20 text-center">
              <p className="text-sm text-white/30">Sign in to see your bets</p>
            </div>
          ) : myBets.length === 0 ? (
            <div className="rounded-2xl border border-white/[0.06] bg-[#16171c] py-20 text-center">
              <p className="text-sm text-white/30">No bets yet — browse markets to place your first!</p>
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
                <div key={b.id} className="rounded-2xl border border-white/[0.06] bg-[#16171c] p-5">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <p className="flex-1 text-[15px] font-semibold leading-snug text-white line-clamp-2">
                      {b.question}
                    </p>
                    <StatusBadge status={b.status} />
                  </div>
                  <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-white/40">
                    <span>
                      <span className={b.outcome.toLowerCase() === "yes" ? "text-[#31c45d]" : "text-red-400"}>
                        {b.outcome}
                      </span>
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
