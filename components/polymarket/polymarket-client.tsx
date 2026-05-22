"use client";

import { useState, useEffect, useCallback } from "react";
import type { ReactNode } from "react";
import Image from "next/image";
import { Activity, BarChart3, Bell, Bookmark, CalendarClock, Code2, Link2, Radio, Search, SlidersHorizontal, TrendingUp } from "lucide-react";
import { MarketCard, formatEndDate, formatMarketMoney } from "./market-card";
import { BetModal }   from "./bet-modal";
import { toast }      from "@/lib/toast";
import type { PolymarketMarket } from "@/lib/polymarket";

const TAGS = ["All", "Trending", "Breaking", "New", "Politics", "Sports", "Crypto", "Esports", "Finance", "Geopolitics", "Tech", "Culture", "Economy", "Weather", "Elections"];

interface MyBet {
  id:          string;
  marketId:    string;
  question:    string;
  outcome:     string;
  price:       number;
  stake:       number;
  potentialWin:number;
  status:      string;
  winAmount:   number | null;
  settledAt:   string | null;
  createdAt:   string;
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

export function PolymarketClient({ userId, balance: initialBalance }: Props) {
  const [markets,  setMarkets]  = useState<PolymarketMarket[]>([]);
  const [myBets,   setMyBets]   = useState<MyBet[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [tab,      setTab]      = useState<"browse" | "my-bets">("browse");
  const [tag,      setTag]      = useState("All");
  const [detail,   setDetail]   = useState<PolymarketMarket | null>(null);
  const [ticket,   setTicket]   = useState<{ market: PolymarketMarket; outcome?: string } | null>(null);
  const [balance,  setBalance]  = useState(initialBalance);

  const fetchMarkets = useCallback(async () => {
    setLoading(true);
    const apiTag = ["All", "Trending", "Breaking", "New"].includes(tag) ? "" : tag;
    const url = apiTag ? `/api/polymarket/markets?tag=${encodeURIComponent(apiTag)}` : "/api/polymarket/markets";
    const res = await fetch(url);
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
  useEffect(() => {
    if (!detail && markets.length > 0) setDetail(markets[0]);
  }, [detail, markets]);
  useEffect(() => { if (tab === "my-bets") fetchMyBets(); }, [tab, fetchMyBets]);

  function handleBetSuccess() {
    toast.success("Bet placed!");
    fetchBalance();
    if (tab === "my-bets") fetchMyBets();
  }

  const visibleMarkets = markets;
  const totalVolume = visibleMarkets.reduce((sum, m) => sum + m.volume, 0);
  const totalLiquidity = visibleMarkets.reduce((sum, m) => sum + m.liquidity, 0);
  const liveCount = visibleMarkets.filter((m) => new Date(m.endDate).getTime() - Date.now() < 3 * 86_400_000).length;

  return (
    <div className="flex flex-col gap-4 text-slate-200">
      <div className="grid gap-3 lg:grid-cols-[minmax(220px,1fr)_minmax(320px,760px)_minmax(280px,420px)]">
        <div className="hidden items-center gap-2 rounded-lg border border-white/10 bg-[#151a1f] px-3 py-3 text-lg font-black text-white lg:flex">
          <span className="grid h-8 w-8 place-items-center rounded-md border border-white/20 text-sm">N</span>
          Polymarket
        </div>
        <div className="flex h-14 items-center gap-3 rounded-lg border border-white/10 bg-[#151a1f] px-4">
          <Search className="h-5 w-5 text-slate-500" />
          <input
            placeholder="Search polymarkets..."
            className="h-full flex-1 bg-transparent text-sm font-semibold text-white outline-none placeholder:text-slate-500"
          />
          <span className="font-mono text-slate-500">/</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <StatPill label="Markets" value={String(visibleMarkets.length)} />
          <StatPill label="Volume" value={formatMarketMoney(totalVolume)} />
          <StatPill label="Wallet" value={`KSh ${Math.floor(balance).toLocaleString()}`} />
        </div>
      </div>

      <div className="flex gap-1 rounded-lg border border-white/10 bg-[#11161a] p-1">
        {(["browse", "my-bets"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-md py-2 text-xs font-black uppercase tracking-wide transition ${
              tab === t ? "bg-[#087cff] text-white" : "text-white/40 hover:text-white/70"
            }`}
          >
            {t === "browse" ? "Markets" : "My Bets"}
          </button>
        ))}
      </div>

      {tab === "browse" && (
        <>
          <div className="flex gap-2 overflow-x-auto border-b border-white/10 pb-3 no-scrollbar">
            {TAGS.map((t) => (
              <button
                key={t}
                onClick={() => setTag(t)}
                className={`flex h-9 shrink-0 items-center gap-2 rounded-md px-3 text-sm font-bold transition ${
                  tag === t
                    ? "bg-[#1f2a35] text-white"
                    : "text-slate-500 hover:bg-white/5 hover:text-slate-300"
                }`}
              >
                {t === "Trending" && <TrendingUp className="h-4 w-4" />}
                {t}
              </button>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)_360px]">
            <aside className="hidden rounded-lg border border-white/10 bg-[#11161a] p-4 lg:block">
              <div className="space-y-2 border-b border-white/10 pb-4">
                <RailItem icon={<Radio className="h-5 w-5 text-red-400" />} label="Live" value={String(liveCount)} active />
                <RailItem icon={<CalendarClock className="h-5 w-5" />} label="Upcoming" value={String(Math.max(0, visibleMarkets.length - liveCount))} />
              </div>
              <div className="pt-5">
                <p className="mb-3 text-[11px] font-black uppercase tracking-widest text-slate-600">Markets</p>
                {["Politics", "Sports", "Crypto", "Finance", "Culture", "Tech", "Weather", "Elections"].map((item, index) => (
                  <RailItem
                    key={item}
                    label={item}
                    value={String(Math.max(1, Math.floor((visibleMarkets.length + index) / 3)))}
                    active={tag === item}
                    onClick={() => setTag(item)}
                  />
                ))}
              </div>
            </aside>

            <section className="min-w-0">
              {loading ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {Array.from({ length: 9 }).map((_, i) => (
                    <div key={i} className="h-44 animate-pulse rounded-lg border border-white/10 bg-white/5" />
                  ))}
                </div>
              ) : markets.length === 0 ? (
                <p className="rounded-lg border border-white/10 bg-[#151a1f] py-16 text-center text-sm text-white/30">No markets found</p>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {markets.map((m) => (
                    <MarketCard
                      key={m.conditionId}
                      market={m}
                      active={detail?.conditionId === m.conditionId}
                      onSelect={setDetail}
                      onBet={(market, outcome) => setTicket({ market, outcome })}
                    />
                  ))}
                </div>
              )}
            </section>

            <MarketDetailPanel
              market={detail ?? markets[0] ?? null}
              totalLiquidity={totalLiquidity}
              onBet={(market, outcome) => setTicket({ market, outcome })}
            />
          </div>
        </>
      )}

      {tab === "my-bets" && (
        <>
          {!userId ? (
            <p className="py-16 text-center text-sm text-white/40">Sign in to see your bets</p>
          ) : myBets.length === 0 ? (
            <p className="py-16 text-center text-sm text-white/30">No bets yet</p>
          ) : (
            <div className="flex flex-col gap-2">
              {myBets.map((b) => (
                <div key={b.id} className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <p className="flex-1 text-sm font-semibold leading-snug text-white line-clamp-2">
                      {b.question}
                    </p>
                    <StatusBadge status={b.status} />
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/40">
                    <span>
                      <span className={b.outcome.toLowerCase() === "yes" ? "text-[#31c45d]" : "text-red-400"}>
                        {b.outcome}
                      </span>
                      {" "}@ {(b.price * 100).toFixed(0)}% ({(1/b.price).toFixed(2)}x)
                    </span>
                    <span>Stake: <span className="text-white">KSh {b.stake.toLocaleString()}</span></span>
                    <span>
                      {b.status === "WON"
                        ? <span className="text-[#31c45d]">Won KSh {b.winAmount?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        : b.status === "LOST"
                        ? <span className="text-red-400">Lost</span>
                        : <span>To win: KSh {b.potentialWin.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      }
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Bet modal */}
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

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-[#151a1f] px-3 py-2">
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-600">{label}</p>
      <p className="mt-1 truncate text-sm font-black text-white">{value}</p>
    </div>
  );
}

function RailItem({ icon, label, value, active, onClick }: { icon?: ReactNode; label: string; value: string; active?: boolean; onClick?: () => void }) {
  const className = `flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-bold transition ${
    active ? "bg-white/10 text-white" : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
  }`;

  const content = (
    <>
      <span className="flex items-center gap-3">
        {icon}
        {label}
      </span>
      <span className="text-xs text-slate-500">{value}</span>
    </>
  );

  if (onClick) {
    return (
      <button onClick={onClick} className={className}>
        {content}
      </button>
    );
  }

  return (
    <div className={className}>
      {content}
    </div>
  );
}

function MarketDetailPanel({ market, totalLiquidity, onBet }: { market: PolymarketMarket | null; totalLiquidity: number; onBet: (market: PolymarketMarket, outcome?: string) => void }) {
  if (!market) {
    return <aside className="hidden rounded-lg border border-white/10 bg-[#11161a] p-5 lg:block" />;
  }

  const end = formatEndDate(market.endDate);
  const topPrice = market.outcomePrices.reduce((best, price, index) => price > best.price ? { price, label: market.outcomes[index] ?? "Outcome" } : best, { price: 0, label: "Outcome" });

  return (
    <aside className="rounded-lg border border-white/10 bg-[#11161a] lg:sticky lg:top-4 lg:max-h-[calc(100vh-120px)] lg:overflow-auto">
      <div className="border-b border-white/10 p-5">
        <div className="mb-4 flex items-start justify-between gap-3 text-slate-400">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest">
            <BarChart3 className="h-4 w-4" />
            Market
          </div>
          <div className="flex gap-3">
            <SlidersHorizontal className="h-4 w-4" />
            <Code2 className="h-4 w-4" />
            <Bookmark className="h-4 w-4" />
            <Link2 className="h-4 w-4" />
          </div>
        </div>
        <h2 className="text-xl font-black leading-tight text-white">{market.question}</h2>
        <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold text-slate-500">
          {market.tags.slice(0, 3).map((tag) => <span key={tag}>{tag}</span>)}
          <span>Ends {end}</span>
        </div>
      </div>

      <div className="grid grid-cols-3 border-b border-white/10 text-center">
        <Metric label="Vol." value={formatMarketMoney(market.volume)} />
        <Metric label="Liq." value={formatMarketMoney(market.liquidity)} />
        <Metric label="Share" value={`${Math.round((market.liquidity / Math.max(totalLiquidity, 1)) * 100)}%`} />
      </div>

      <div className="p-5">
        {market.image && (
          <Image
            src={market.image}
            alt=""
            width={640}
            height={256}
            unoptimized
            className="mb-5 h-32 w-full rounded-lg object-cover opacity-90"
          />
        )}
        <div className="mb-5 rounded-lg border border-white/10 bg-[#151a1f] p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-black text-white">{topPrice.label}</span>
            <span className="font-mono text-lg font-black text-white">{(topPrice.price * 100).toFixed(0)}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-red-500/25">
            <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(100, Math.max(0, topPrice.price * 100))}%` }} />
          </div>
        </div>

        <div className="grid gap-2">
          {market.outcomes.slice(0, 6).map((outcome, index) => {
            const price = Math.max(0.01, market.outcomePrices[index] ?? 0.5);
            const isYes = outcome.toLowerCase() === "yes" || index === 0;
            return (
              <button
                key={`${outcome}-${index}`}
                onClick={() => onBet(market, outcome)}
                className={`flex h-12 items-center justify-between rounded-md px-4 text-sm font-black transition ${
                  isYes ? "bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25" : "bg-red-500/15 text-red-300 hover:bg-red-500/25"
                }`}
              >
                <span>{outcome}</span>
                <span className="font-mono text-white">{(price * 100).toFixed(0)}%</span>
              </button>
            );
          })}
        </div>

        <div className="mt-5 flex gap-5 border-b border-white/10 text-sm font-black text-slate-500">
          {["Series Lines", "Game 1", "Game 2", "Game 3"].map((item, index) => (
            <button key={item} className={`pb-3 ${index === 0 ? "border-b-2 border-sky-400 text-slate-200" : ""}`}>{item}</button>
          ))}
        </div>

        {market.description && (
          <p className="mt-4 line-clamp-4 text-sm leading-6 text-slate-400">{market.description}</p>
        )}

        <div className="mt-5 grid grid-cols-2 gap-2">
          <button className="rounded-md border border-white/10 bg-white/5 py-2.5 text-sm font-bold text-slate-300 hover:bg-white/10">
            <Bell className="mr-2 inline h-4 w-4" />
            Alert
          </button>
          <button className="rounded-md border border-white/10 bg-white/5 py-2.5 text-sm font-bold text-slate-300 hover:bg-white/10">
            <Activity className="mr-2 inline h-4 w-4" />
            Activity
          </button>
        </div>
      </div>
    </aside>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-r border-white/10 px-3 py-3 last:border-r-0">
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-600">{label}</p>
      <p className="mt-1 truncate text-sm font-black text-white">{value}</p>
    </div>
  );
}
