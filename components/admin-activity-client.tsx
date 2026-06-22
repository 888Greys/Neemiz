"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Icon } from "@/components/icon";
import { StatusBadge } from "@/components/admin-status-badge";
import { CURRENCY_SYMBOL, MONEY_LOCALE } from "@/lib/currency";

interface RecentItem {
  id: string;
  amount: number;
  status: string;
  at: string;
  user: { id: string; email: string | null; username: string | null };
  question?: string;
  outcome?: string;
  market?: string;
  side?: string;
  symbol?: string;
  direction?: string;
  crypto?: string;
}

interface Product {
  id: string;
  name: string;
  players: number;
  activity: number;
  volume: number;
  payout: number;
  exposure: number;
  recent: RecentItem[];
}

interface ActivityData {
  rangeMinutes: number;
  products: Product[];
  totals: { players: number; activity: number; volume: number; payout: number };
}

const RANGE_OPTIONS = [
  { label: "30 min", minutes: 30 },
  { label: "1 hr",   minutes: 60 },
  { label: "2 hr",   minutes: 120 },
  { label: "4 hr",   minutes: 240 },
  { label: "12 hr",  minutes: 720 },
  { label: "24 hr",  minutes: 1440 },
  { label: "30 days", minutes: 43200 },
];

const icons: Record<string, string> = {
  sports: "sports_soccer",
  predictions: "online_prediction",
  aviator: "flight_takeoff",
  binary: "candlestick_chart",
  forex: "currency_exchange",
  p2p: "handshake",
};

const money = (value: number) =>
  value >= 1_000_000 ? `${CURRENCY_SYMBOL} ${(value / 1_000_000).toFixed(2)}M`
    : value >= 1_000 ? `${CURRENCY_SYMBOL} ${(value / 1_000).toFixed(1)}K`
      : `${CURRENCY_SYMBOL} ${value.toLocaleString(MONEY_LOCALE)}`;

export function AdminActivityClient() {
  const [data, setData] = useState<ActivityData | null>(null);
  const [active, setActive] = useState("sports");
  const [loading, setLoading] = useState(true);
  const [minutes, setMinutes] = useState(60);
  const [live, setLive] = useState(true);

  const load = useCallback(async (mins: number, spinner = true) => {
    if (spinner) setLoading(true);
    try {
      const response = await fetch(`/api/admin/activity?minutes=${mins}`, { cache: "no-store" });
      if (response.ok) setData(await response.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(minutes); }, [load, minutes]);

  // Live auto-refresh (every 20s) without the loading spinner, for short windows.
  useEffect(() => {
    if (!live) return;
    const id = setInterval(() => load(minutes, false), 20_000);
    return () => clearInterval(id);
  }, [live, minutes, load]);

  if (loading && !data) {
    return <div className="flex min-h-screen items-center justify-center"><div className="h-7 w-7 animate-spin rounded-full border-2 border-white/10 border-t-blue-500" /></div>;
  }
  if (!data) return <div className="p-8 text-sm text-red-400">Product activity could not be loaded.</div>;

  const product = data.products.find((item) => item.id === active) ?? data.products[0];
  const chartData = data.products.map((item) => ({ name: item.name, players: item.players, activity: item.activity }));

  return (
    <div className="admin-page">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-blue-400">
            {minutes < 43200 && <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />}
            {minutes < 43200 ? `Live · last ${RANGE_OPTIONS.find((o) => o.minutes === minutes)?.label}` : "30-day intelligence"}
          </p>
          <h1 className="mt-1 text-2xl font-black tracking-tight">Product activity</h1>
          <p className="text-xs text-slate-600">Live players, volume, payouts and recent activity across every platform product.</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Time-window dropdown */}
          <select
            value={minutes}
            onChange={(e) => setMinutes(Number(e.target.value))}
            className="rounded-lg border border-white/[0.08] bg-[#121419] px-3 py-2 text-[11px] font-black text-slate-200 outline-none transition focus:border-[#087cff]/40 [color-scheme:dark]"
          >
            {RANGE_OPTIONS.map((o) => <option key={o.minutes} value={o.minutes}>Past {o.label}</option>)}
          </select>
          {/* Live auto-refresh toggle */}
          <button
            onClick={() => setLive((v) => !v)}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[11px] font-black transition ${live ? "border-emerald-400/30 bg-emerald-400/[0.08] text-emerald-300" : "border-white/[0.08] bg-white/[0.03] text-slate-500 hover:text-white"}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${live ? "bg-emerald-400 animate-pulse" : "bg-slate-600"}`} /> Live
          </button>
          <button onClick={() => load(minutes)} className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[11px] font-black text-slate-400 hover:text-white">
            <Icon name="refresh" size={13} /> Refresh
          </button>
        </div>
      </header>

      <div className="admin-panel mb-4 grid overflow-hidden sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Product players", data.totals.players.toLocaleString(), "Distinct per product", "groups"],
          ["Total activities", data.totals.activity.toLocaleString(), "Bets, trades and orders", "bolt"],
          ["Combined volume", money(data.totals.volume), "Stake, margin and P2P value", "account_balance_wallet"],
          ["Recorded payouts", money(data.totals.payout), "Wins and closed P&L", "trending_up"],
        ].map(([label, value, detail, icon]) => (
          <div key={label} className="border-b border-r border-white/[0.06] bg-white/[0.012] p-4">
            <Icon name={icon} size={15} className="text-blue-400" />
            <p className="mt-4 text-2xl font-black">{value}</p>
            <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-slate-600">{label}</p>
            <p className="mt-1 text-[9px] text-slate-700">{detail}</p>
          </div>
        ))}
      </div>

      <div className="mb-4 grid gap-4 xl:grid-cols-[1.3fr_1fr]">
        <section className="admin-panel p-4">
          <p className="mb-4 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Players and activity by product</p>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid stroke="rgba(255,255,255,.04)" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#475569", fontSize: 9 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: "#0b0f16", border: "1px solid rgba(255,255,255,.08)", borderRadius: 8, fontSize: 11 }} />
                <Bar dataKey="activity" fill="#087cff" radius={[4, 4, 0, 0]} />
                <Bar dataKey="players" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="grid grid-cols-2 gap-2">
          {data.products.map((item) => (
            <button key={item.id} onClick={() => setActive(item.id)} className={`rounded-2xl border p-4 text-left transition ${active === item.id ? "border-blue-500/30 bg-blue-500/[0.08] shadow-[0_12px_35px_rgba(8,124,255,.08)]" : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]"}`}>
              <Icon name={icons[item.id]} size={17} className={active === item.id ? "text-blue-400" : "text-slate-600"} />
              <p className="mt-3 text-sm font-black">{item.name}</p>
              <p className="mt-1 text-[10px] text-slate-600">{item.players} players · {item.activity} activities</p>
              <p className="mt-2 text-xs font-black text-emerald-400">{money(item.volume)}</p>
            </button>
          ))}
        </section>
      </div>

      <section className="admin-panel overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-3">
          <div className="flex items-center gap-3">
            <Icon name={icons[product.id]} size={18} className="text-blue-400" />
            <div><h2 className="text-sm font-black">{product.name} breakdown</h2><p className="text-[9px] uppercase tracking-widest text-slate-600">Most recent participating users</p></div>
          </div>
          <div className="flex gap-5 text-right text-[10px]">
            <div><p className="font-black text-white">{product.players}</p><p className="text-slate-600">Players</p></div>
            <div><p className="font-black text-white">{product.activity}</p><p className="text-slate-600">Activities</p></div>
            <div><p className="font-black text-emerald-400">{money(product.volume)}</p><p className="text-slate-600">Volume</p></div>
            <div><p className="font-black text-amber-400">{money(product.exposure)}</p><p className="text-slate-600">Exposure</p></div>
          </div>
        </div>
        <div className="max-h-[440px] overflow-auto no-scrollbar">
          <table className="w-full min-w-[700px] text-left">
            <thead className="sticky top-0 z-10 bg-[#0b0f16]"><tr className="border-b border-white/[0.05] text-[9px] uppercase tracking-widest text-slate-700">
              <th className="px-4 py-2.5">Player</th><th>Activity</th><th>Status</th><th>Time</th><th className="pr-4 text-right">Amount</th>
            </tr></thead>
            <tbody>
              {product.recent.map((item) => (
                <tr key={item.id} className="border-b border-white/[0.04] text-[11px] hover:bg-white/[0.02]">
                  <td className="px-4 py-3"><Link href={`/admin/users/${item.user.id}`} className="font-bold text-slate-300 hover:text-blue-400">{item.user.email ?? item.user.username ?? "Unknown"}</Link></td>
                  <td className="text-slate-500">{item.question ?? [item.market, item.side].filter(Boolean).join(" · ") ?? item.symbol ?? item.crypto ?? product.name}</td>
                  <td><StatusBadge status={item.status} /></td>
                  <td className="text-slate-600">{new Date(item.at).toLocaleString()}</td>
                  <td className="pr-4 text-right font-mono font-black">{money(item.amount)}</td>
                </tr>
              ))}
              {product.recent.length === 0 && <tr><td colSpan={5} className="px-4 py-12 text-center text-xs text-slate-600">No activity in this period.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
