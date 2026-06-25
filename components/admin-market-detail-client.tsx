"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { getCached, setCached } from "@/lib/client-cache";
import { CURRENCY_SYMBOL, MONEY_LOCALE } from "@/lib/currency";
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { Icon } from "@/components/icon";
import { RangeTabs } from "@/components/admin-range-tabs";
import { type AdminRangeValue } from "@/lib/admin/ranges";

// ─── Market deep-dive template (Phase 2) ──────────────────────────────────────
// ONE component, rendered for all 6 markets. Reads /api/admin/markets/[key].
// Layout mirrors the agreed mockup: range tabs → 5 KPIs → 14-day GGR chart →
// biggest open positions + top players → health strip. The only per-market
// wording swaps (P2P: fees/traders/volume) are derived from the key.

type MarketKey = "sports" | "binary" | "aviator" | "predictions" | "forex" | "p2p";

const MARKET_META: Record<MarketKey, { label: string; icon: string }> = {
  sports: { label: "Sports", icon: "sports_soccer" },
  binary: { label: "Binary", icon: "candlestick_chart" },
  aviator: { label: "Aviator", icon: "flight_takeoff" },
  predictions: { label: "Predictions", icon: "online_prediction" },
  forex: { label: "Forex", icon: "currency_exchange" },
  p2p: { label: "P2P desk", icon: "swap_horiz" },
};

interface MarketMetric {
  turnover: number; ggr: number; margin: number; activePlayers: number;
  openContracts: number; openLiability: number; liabilityExact: boolean;
}
interface MarketDetail {
  metric: MarketMetric;
  granularity: "hour" | "day";
  series: { date: string; ggr: number }[];
  openPositions: { id: string; user: string; label: string; amount: number }[];
  topPlayers: { user: string; net: number }[];
  health: { label: string; detail: string; tone: "ok" | "warn" | "danger" }[];
}


const money = (value: number) => {
  const sign = value < 0 ? "-" : "";
  const v = Math.abs(value);
  return v >= 1_000_000
    ? `${sign}${CURRENCY_SYMBOL} ${(v / 1_000_000).toFixed(2)}M`
    : v >= 1_000
      ? `${sign}${CURRENCY_SYMBOL} ${(v / 1_000).toFixed(1)}K`
      : `${sign}${CURRENCY_SYMBOL} ${Math.round(v).toLocaleString(MONEY_LOCALE)}`;
};
const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

function Kpi({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3.5">
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-600">{label}</p>
      <p className={`mt-2.5 text-xl font-black tracking-tight ${tone ?? "text-white"}`}>{value}</p>
    </div>
  );
}

function RankPanel({ title, icon, rows, empty }: {
  title: string; icon: string; rows: { left: string; right: string; tone: string }[]; empty: string;
}) {
  return (
    <section className="admin-panel overflow-hidden">
      <div className="flex h-11 items-center gap-2 border-b border-white/[0.06] px-4">
        <Icon name={icon} size={14} className="text-slate-500" />
        <h2 className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">{title}</h2>
      </div>
      {rows.length === 0
        ? <p className="px-4 py-6 text-center text-[11px] text-slate-700">{empty}</p>
        : <div className="divide-y divide-white/[0.04]">
            {rows.map((r, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-2.5 text-[11px]">
                <span className="truncate font-bold text-slate-400">{r.left}</span>
                <span className={`ml-3 shrink-0 font-mono font-black ${r.tone}`}>{r.right}</span>
              </div>
            ))}
          </div>}
    </section>
  );
}

export function MarketDetailClient({ marketKey }: { marketKey: MarketKey }) {
  const meta = MARKET_META[marketKey];
  const isP2P = marketKey === "p2p";
  const [range, setRange] = useState<AdminRangeValue>("today");
  const [data, setData] = useState<MarketDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (r: AdminRangeValue) => {
    const url = `/api/admin/markets/${marketKey}?range=${r}`;
    const cached = getCached<MarketDetail>(url);
    if (cached) setData(cached);
    setLoading(!cached);
    try {
      const res = await fetch(url);
      if (res.ok) {
        const fresh = (await res.json()) as MarketDetail;
        setData(fresh);
        setCached(url, fresh);
      }
    } finally {
      setLoading(false);
    }
  }, [marketKey]);

  useEffect(() => { load(range); }, [range, load]);

  return (
    <div className="admin-page">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/admin" className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.08] text-slate-500 hover:text-white">
            <Icon name="arrow_back" size={15} />
          </Link>
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/[0.05] text-blue-300">
            <Icon name={meta.icon} size={18} />
          </span>
          <div>
            <h1 className="text-xl font-black tracking-tight">{meta.label}</h1>
            <p className="text-[10px] font-bold text-slate-600">Independent P&amp;L unit · Kenya</p>
          </div>
        </div>
        <RangeTabs value={range} onChange={setRange} />
      </header>

      {loading && !data ? (
        <div className="flex h-64 items-center justify-center"><div className="h-7 w-7 animate-spin rounded-full border-2 border-white/10 border-t-blue-500" /></div>
      ) : !data ? (
        <div className="p-8 text-sm text-red-400">Market data could not be loaded.</div>
      ) : (
        <>
          <div className="mb-4 grid gap-3 grid-cols-2 lg:grid-cols-5">
            <Kpi label={isP2P ? "Volume" : "Turnover"} value={money(data.metric.turnover)} />
            <Kpi label={isP2P ? "Fees" : "GGR"} value={money(data.metric.ggr)} tone={data.metric.ggr < 0 ? "text-red-400" : "text-white"} />
            <Kpi label="Margin" value={pct(data.metric.margin)} />
            <Kpi label={isP2P ? "Traders" : "Active players"} value={data.metric.activePlayers.toLocaleString()} />
            <Kpi label="Open liability" tone="text-amber-400"
              value={data.metric.openLiability > 0 ? `${data.metric.liabilityExact ? "" : "~"}${money(data.metric.openLiability)}` : "—"} />
          </div>

          <section className="admin-panel mb-4 overflow-hidden">
            <div className="flex h-11 items-center justify-between border-b border-white/[0.06] px-4">
              <h2 className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">{isP2P ? "Fees" : "GGR"} — {data.granularity === "hour" ? "hour by hour (12am → 12am, Nairobi)" : "by day"}</h2>
              <span className="text-[9px] font-bold text-slate-700">{isP2P ? "platform take" : "stakes − payouts"}</span>
            </div>
            <div className="h-[220px] p-3">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="mktGgr" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#087cff" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#087cff" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgba(255,255,255,.04)" vertical={false} />
                  <XAxis dataKey="date" tickFormatter={(v: string) => (data.granularity === "hour" ? v : v.slice(5))} tick={{ fill: "#475569", fontSize: 9 }} axisLine={false} tickLine={false} interval={data.granularity === "hour" ? 2 : "preserveStartEnd"} />
                  <YAxis tickFormatter={(v: number) => Math.abs(v) >= 1000 ? `${Math.round(v / 1000)}K` : String(v)} tick={{ fill: "#475569", fontSize: 9 }} axisLine={false} tickLine={false} width={42} />
                  <Tooltip contentStyle={{ background: "#0b0f16", border: "1px solid rgba(255,255,255,.08)", borderRadius: 8, fontSize: 11 }} formatter={(v) => money(Number(v ?? 0))} />
                  <Area type="monotone" dataKey="ggr" stroke="#087cff" fill="url(#mktGgr)" strokeWidth={1.5} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </section>

          <div className="grid gap-4 lg:grid-cols-2">
            <RankPanel
              title="Biggest open positions" icon="warning"
              empty="No open positions"
              rows={data.openPositions.map((p) => ({ left: `@${p.user} · ${p.label}`, right: money(p.amount), tone: "text-amber-400/90" }))}
            />
            <RankPanel
              title={isP2P ? "Top traders by volume" : "Top players by net P&L"} icon="trophy"
              empty="No activity in range"
              rows={data.topPlayers.map((p) => ({
                left: `@${p.user}`,
                right: isP2P ? money(p.net) : `${p.net >= 0 ? "+" : ""}${money(p.net)}`,
                // Player ahead (net>0) = house behind → red; player behind = green for the house.
                tone: isP2P ? "text-slate-300" : p.net >= 0 ? "text-red-400" : "text-emerald-400",
              }))}
            />
          </div>

          {data.health.map((h, i) => (
            <div key={i} className={`mt-4 flex items-center gap-3 rounded-lg border-l-2 px-4 py-3 ${
              h.tone === "danger" ? "border-red-400/60 bg-red-400/[0.05]"
              : h.tone === "warn" ? "border-amber-400/60 bg-amber-400/[0.05]"
              : "border-emerald-400/50 bg-emerald-400/[0.04]"}`}>
              <Icon name={h.tone === "ok" ? "check_circle" : "warning"} size={15}
                className={h.tone === "danger" ? "text-red-400" : h.tone === "warn" ? "text-amber-400" : "text-emerald-400"} />
              <span className="text-[12px]"><span className="font-black text-slate-200">{h.label}</span> <span className="text-slate-500">— {h.detail}</span></span>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
