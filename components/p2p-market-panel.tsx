"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Icon } from "@/components/icon";
import { useSupabaseAuth } from "@/lib/supabase/auth-context";

// ─── Types ────────────────────────────────────────────────────────────────────

interface RateEntry {
  bestBuy:  number | null;
  bestSell: number | null;
  buyCount:  number;
  sellCount: number;
}

type RateMap = Record<string, RateEntry>;

interface MarketRate {
  kes:    number;
  usd:    number;
  change: number; // 24h % change
}

type MarketRateMap = Record<string, MarketRate>;

interface Ad {
  side:         "BUY" | "SELL";
  crypto:       string;
  pricePerUnit: number;
}

const CRYPTOS = ["USDT", "BTC", "ETH", "BNB"] as const;
type Crypto = typeof CRYPTOS[number];

const CRYPTO_ICONS: Record<string, string> = {
  USDT: "https://cdn.jsdelivr.net/npm/cryptocurrency-icons@0.18.1/svg/color/usdt.svg",
  BTC:  "https://cdn.jsdelivr.net/npm/cryptocurrency-icons@0.18.1/svg/color/btc.svg",
  ETH:  "https://cdn.jsdelivr.net/npm/cryptocurrency-icons@0.18.1/svg/color/eth.svg",
  BNB:  "https://cdn.jsdelivr.net/npm/cryptocurrency-icons@0.18.1/svg/color/bnb.svg",
};

const COINGECKO_IDS: Record<Crypto, string> = {
  USDT: "tether",
  BTC:  "bitcoin",
  ETH:  "ethereum",
  BNB:  "binancecoin",
};

function fmtKes(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString("en-KE");
}

function fmtChange(c: number): string {
  return `${c >= 0 ? "+" : ""}${c.toFixed(2)}%`;
}

// ─── Rates Table ──────────────────────────────────────────────────────────────

function RatesTable({ rates, market, loading }: { rates: RateMap; market: MarketRateMap; loading: boolean }) {
  return (
    <div className="bg-[#111118] border border-white/[0.06] rounded-2xl overflow-hidden">
      <div className="px-4 pt-3 pb-2 flex items-center justify-between">
        <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Best P2P Rates</p>
        <span className="flex items-center gap-1 text-[10px] text-slate-600">
          <span className="w-1.5 h-1.5 rounded-full bg-[#05b957] animate-pulse" />
          Live
        </span>
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-[1fr_1fr_1fr_1fr] px-4 py-1.5 text-[9px] font-black text-slate-700 uppercase tracking-wider border-b border-white/[0.04]">
        <span>Asset</span>
        <span className="text-slate-600">Market</span>
        <span className="text-[#05b957]">Buy</span>
        <span className="text-red-400">Sell</span>
      </div>

      {loading ? (
        <div className="space-y-px">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-10 bg-white/[0.02] animate-pulse" style={{ opacity: 1 - i * 0.15 }} />
          ))}
        </div>
      ) : (
        <div>
          {CRYPTOS.map((c) => {
            const r  = rates[c];
            const mk = market[c];
            return (
              <div
                key={c}
                className="grid grid-cols-[1fr_1fr_1fr_1fr] px-4 py-2.5 items-center hover:bg-white/[0.03] transition-colors border-b border-white/[0.03] last:border-0"
              >
                {/* Asset */}
                <div className="flex items-center gap-1.5">
                  <img src={CRYPTO_ICONS[c]} alt={c} width={16} height={16} className="h-4 w-4 rounded-full shrink-0" />
                  <div>
                    <p className="text-xs font-black text-white leading-none">{c}</p>
                    {mk?.change !== undefined && (
                      <p className={`text-[9px] font-bold leading-none mt-0.5 ${mk.change >= 0 ? "text-[#05b957]" : "text-red-400"}`}>
                        {fmtChange(mk.change)}
                      </p>
                    )}
                  </div>
                </div>

                {/* Market rate */}
                <div>
                  {mk?.kes ? (
                    <span className="text-[11px] font-bold text-slate-400">
                      {fmtKes(mk.kes)}
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-700">—</span>
                  )}
                </div>

                {/* Best P2P buy */}
                <div>
                  {r?.bestBuy ? (
                    <span className="text-[11px] font-bold text-[#05b957]">
                      {fmtKes(r.bestBuy)}
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-700">—</span>
                  )}
                </div>

                {/* Best P2P sell */}
                <div>
                  {r?.bestSell ? (
                    <span className="text-[11px] font-bold text-red-400">
                      {fmtKes(r.bestSell)}
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-700">—</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── My Orders ────────────────────────────────────────────────────────────────

interface Order {
  id:          string;
  crypto:      string;
  cryptoAmount:number;
  fiatAmount:  number;
  status:      string;
  side:        "buy" | "sell"; // buyer or seller perspective
  createdAt:   string;
}

const ORDER_STATUS_STYLE: Record<string, string> = {
  PENDING:   "bg-amber-500/10 text-amber-400 border-amber-500/20",
  PAID:      "bg-blue-500/10 text-blue-400 border-blue-500/20",
  RELEASED:  "bg-[#05b957]/10 text-[#05b957] border-[#05b957]/20",
  CANCELLED: "bg-white/5 text-slate-600 border-white/10",
  DISPUTED:  "bg-red-500/10 text-red-400 border-red-500/20",
  EXPIRED:   "bg-white/5 text-slate-600 border-white/10",
};

function MyOrders({ userId }: { userId: string }) {
  const [orders,  setOrders]  = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/p2p/orders?limit=4")
      .then((r) => r.ok ? r.json() : [])
      .then((data) => setOrders(Array.isArray(data) ? data.slice(0, 4) : []))
      .catch(() => setOrders([]))
      .finally(() => setLoading(false));
  }, [userId]);

  return (
    <div className="bg-[#111118] border border-white/[0.06] rounded-2xl overflow-hidden">
      <div className="px-4 pt-3 pb-2 flex items-center justify-between">
        <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest">My Orders</p>
        <Link href="/p2p/orders" className="text-[10px] text-[#087cff] hover:text-blue-300 font-bold transition-colors">
          View all
        </Link>
      </div>

      {loading ? (
        <div className="px-4 pb-3 space-y-2">
          {[1,2,3].map((i) => (
            <div key={i} className="h-10 rounded-xl bg-white/[0.03] animate-pulse" />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="px-4 pb-4 text-center">
          <Icon name="receipt_long" className="text-slate-700 text-2xl mb-1" />
          <p className="text-[11px] text-slate-600">No orders yet</p>
          <Link href="/p2p" className="text-[10px] text-[#05b957] font-bold hover:underline">
            Start trading →
          </Link>
        </div>
      ) : (
        <div className="px-3 pb-3 space-y-1.5">
          {orders.map((o) => (
            <Link
              key={o.id}
              href={`/p2p/orders/${o.id}`}
              className="flex items-center gap-2 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.05] rounded-xl px-3 py-2 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-black text-white">
                    {o.cryptoAmount} {o.crypto}
                  </span>
                  <span className="text-[9px] text-slate-600">·</span>
                  <span className="text-[10px] text-slate-500">
                    KSh {Number(o.fiatAmount).toLocaleString("en-KE", { maximumFractionDigits: 0 })}
                  </span>
                </div>
              </div>
              <span className={`shrink-0 text-[9px] font-black px-1.5 py-0.5 rounded-full border ${ORDER_STATUS_STYLE[o.status] ?? ORDER_STATUS_STYLE.CANCELLED}`}>
                {o.status}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Merchant Center ──────────────────────────────────────────────────────────

interface MerchantInfo {
  isMerchant:      boolean;
  kycStatus:       string;
  isOnline:        boolean;
  displayName:     string;
  completedTrades: number;
  completionRate:  number;
  activeAds:       number;
}

function MerchantCenter({ userId }: { userId: string }) {
  const [info,    setInfo]    = useState<MerchantInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [toggling,setToggling]= useState(false);

  useEffect(() => {
    fetch("/api/p2p/merchant/profile")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => setInfo(d))
      .catch(() => setInfo(null))
      .finally(() => setLoading(false));
  }, [userId]);

  async function toggleOnline() {
    if (!info) return;
    setToggling(true);
    try {
      const res = await fetch("/api/p2p/merchant/online", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isOnline: !info.isOnline }),
      });
      if (res.ok) setInfo((prev) => prev ? { ...prev, isOnline: !prev.isOnline } : prev);
    } finally {
      setToggling(false);
    }
  }

  if (loading) {
    return (
      <div className="h-24 rounded-2xl bg-[#111118] border border-white/[0.06] animate-pulse" />
    );
  }

  // Not a merchant yet
  if (!info || !info.isMerchant) {
    return (
      <Link
        href="/p2p/merchant"
        className="flex items-center gap-3 bg-[#087cff]/10 border border-[#087cff]/20 rounded-2xl px-4 py-3.5 hover:bg-[#087cff]/15 transition-colors"
      >
        <div className="w-8 h-8 rounded-xl bg-[#087cff]/20 flex items-center justify-center shrink-0">
          <Icon name="storefront" className="text-[#087cff] text-lg" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-black text-white">Become a Merchant</p>
          <p className="text-[10px] text-slate-500">Post ads · Earn on every trade</p>
        </div>
        <Icon name="arrow_forward" className="text-slate-600 text-sm shrink-0" />
      </Link>
    );
  }

  // Active merchant dashboard
  return (
    <div className="bg-[#111118] border border-white/[0.06] rounded-2xl overflow-hidden">
      <div className="px-4 pt-3 pb-2 flex items-center justify-between">
        <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Merchant Center</p>
        <Link href="/p2p/merchant" className="text-[10px] text-[#087cff] hover:text-blue-300 font-bold transition-colors">
          Manage
        </Link>
      </div>

      {/* Merchant info */}
      <div className="px-4 pb-3 space-y-3">
        {/* Name + online toggle */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-black text-white">{info.displayName}</p>
            <p className="text-[10px] text-slate-600">{info.completedTrades} completed · {Number(info.completionRate).toFixed(0)}% rate</p>
          </div>
          <button
            onClick={toggleOnline}
            disabled={toggling}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[10px] font-black border transition-all ${
              info.isOnline
                ? "bg-[#05b957]/15 border-[#05b957]/30 text-[#05b957]"
                : "bg-white/[0.04] border-white/[0.08] text-slate-500"
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${info.isOnline ? "bg-[#05b957] animate-pulse" : "bg-slate-600"}`} />
            {info.isOnline ? "Online" : "Offline"}
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-white/[0.03] border border-white/[0.05] rounded-xl px-3 py-2 text-center">
            <p className="text-base font-black text-white">{info.activeAds}</p>
            <p className="text-[10px] text-slate-600">Active Ads</p>
          </div>
          <div className="bg-white/[0.03] border border-white/[0.05] rounded-xl px-3 py-2 text-center">
            <p className="text-base font-black text-[#05b957]">{Number(info.completionRate).toFixed(0)}%</p>
            <p className="text-[10px] text-slate-600">Completion</p>
          </div>
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-2 gap-1.5">
          <Link href="/p2p/merchant?tab=ads" className="flex items-center justify-center gap-1.5 bg-white/[0.04] border border-white/[0.06] rounded-xl py-2 text-[11px] font-black text-white hover:bg-white/[0.07] transition-colors">
            <Icon name="view_list" className="text-sm text-slate-400" />
            My Ads
          </Link>
          <Link href="/p2p/merchant?tab=deposit" className="flex items-center justify-center gap-1.5 bg-white/[0.04] border border-white/[0.06] rounded-xl py-2 text-[11px] font-black text-white hover:bg-white/[0.07] transition-colors">
            <Icon name="account_balance_wallet" className="text-sm text-[#087cff]" />
            Deposit
          </Link>
        </div>
      </div>
    </div>
  );
}

// ─── Trust Signals ────────────────────────────────────────────────────────────

function TrustBlock() {
  const items = [
    { icon: "lock",          text: "Escrow-protected",    sub: "Crypto locked until payment confirmed" },
    { icon: "verified_user", text: "KYC verified",        sub: "All merchants are identity-verified" },
    { icon: "support_agent", text: "Dispute resolution",  sub: "Admin mediates any disputed trade" },
  ];

  return (
    <div className="space-y-2">
      {items.map(({ icon, text, sub }) => (
        <div key={text} className="flex items-start gap-3 bg-[#111118] border border-white/[0.05] rounded-xl px-3 py-2.5">
          <div className="w-7 h-7 rounded-lg bg-[#087cff]/10 flex items-center justify-center shrink-0 mt-0.5">
            <Icon name={icon} className="text-[#087cff] text-sm" />
          </div>
          <div>
            <p className="text-xs font-black text-white">{text}</p>
            <p className="text-[10px] text-slate-600 leading-tight mt-0.5">{sub}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

export function P2PMarketPanel() {
  const { user }              = useSupabaseAuth();
  const [rates, setRates]     = useState<RateMap>({});
  const [market, setMarket]   = useState<MarketRateMap>({});
  const [loading, setLoading] = useState(true);

  const fetchMarket = useCallback(async () => {
    try {
      const ids = Object.values(COINGECKO_IDS).join(",");
      const res = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=kes,usd&include_24hr_change=true`,
        { next: { revalidate: 60 } }
      );
      if (!res.ok) return;
      const data = await res.json();

      const map: MarketRateMap = {};
      for (const crypto of CRYPTOS) {
        const id = COINGECKO_IDS[crypto];
        if (data[id]) {
          map[crypto] = {
            kes:    data[id].kes    ?? 0,
            usd:    data[id].usd    ?? 0,
            change: data[id].kes_24h_change ?? 0,
          };
        }
      }
      setMarket(map);
    } catch {
      // keep previous market data
    }
  }, []);

  const fetchRates = useCallback(async () => {
    setLoading(true);
    try {
      const [buyAds, sellAds] = await Promise.all([
        fetch("/api/p2p/ads?side=SELL").then((r) => r.json()),
        fetch("/api/p2p/ads?side=BUY").then((r) => r.json()),
      ]);

      const all: Ad[] = [
        ...(Array.isArray(buyAds)  ? buyAds  : []),
        ...(Array.isArray(sellAds) ? sellAds : []),
      ];

      const map: RateMap = {};
      for (const crypto of CRYPTOS) {
        const sells = all.filter((a) => a.side === "SELL" && a.crypto === crypto);
        const buys  = all.filter((a) => a.side === "BUY"  && a.crypto === crypto);
        map[crypto] = {
          bestBuy:   sells.length ? Math.min(...sells.map((a) => a.pricePerUnit)) : null,
          bestSell:  buys.length  ? Math.max(...buys.map((a) => a.pricePerUnit))  : null,
          buyCount:  sells.length,
          sellCount: buys.length,
        };
      }
      setRates(map);
    } catch {
      // keep empty rates
    } finally {
      setLoading(false);
    }
  }, []);

  const refresh = useCallback(() => {
    fetchRates();
    fetchMarket();
  }, [fetchRates, fetchMarket]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 30_000);
    return () => clearInterval(interval);
  }, [refresh]);

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto no-scrollbar px-3 py-5">

      {/* Header */}
      <div className="flex items-center justify-between px-1">
        <p className="text-sm font-black text-white">P2P Market</p>
        <button
          onClick={refresh}
          className="p-1.5 rounded-lg text-slate-600 hover:text-white hover:bg-white/[0.06] transition-colors"
          title="Refresh"
        >
          <Icon name="refresh" className="text-base" />
        </button>
      </div>

      {/* Live rates table */}
      <RatesTable rates={rates} market={market} loading={loading} />

      {/* Quick links */}
      <div className="grid grid-cols-2 gap-2">
        <Link
          href="/p2p"
          className="flex flex-col items-center gap-1.5 bg-[#05b957]/10 border border-[#05b957]/20 rounded-xl py-3 hover:bg-[#05b957]/15 transition-colors"
        >
          <Icon name="add_circle" className="text-[#05b957] text-xl" />
          <span className="text-xs font-black text-white">Buy</span>
        </Link>
        <Link
          href="/p2p?side=SELL"
          className="flex flex-col items-center gap-1.5 bg-red-500/10 border border-red-500/20 rounded-xl py-3 hover:bg-red-500/15 transition-colors"
        >
          <Icon name="remove_circle" className="text-red-400 text-xl" />
          <span className="text-xs font-black text-white">Sell</span>
        </Link>
      </div>

      {/* My Orders — only when signed in */}
      {user && <MyOrders userId={user.id} />}

      {/* Merchant Center — shows become-merchant CTA or dashboard */}
      {user
        ? <MerchantCenter userId={user.id} />
        : (
          <Link
            href="/p2p/merchant"
            className="flex items-center gap-3 bg-[#087cff]/10 border border-[#087cff]/20 rounded-2xl px-4 py-3.5 hover:bg-[#087cff]/15 transition-colors"
          >
            <div className="w-8 h-8 rounded-xl bg-[#087cff]/20 flex items-center justify-center shrink-0">
              <Icon name="storefront" className="text-[#087cff] text-lg" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-black text-white">Become a Merchant</p>
              <p className="text-[10px] text-slate-500">Post ads · Earn on every trade</p>
            </div>
            <Icon name="arrow_forward" className="text-slate-600 text-sm shrink-0" />
          </Link>
        )
      }

      {/* Trust signals */}
      <TrustBlock />
    </div>
  );
}
