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

// ─── Players / Growth screen (Phase 3) ────────────────────────────────────────
// Acquisition + base-health, reading /api/admin/players. Same primitives:
// KPI strip → signup-trend area chart → KYC funnel + leaderboards.

interface PlayerRow { id: string; name: string; balance: number; joined: string }
interface Players {
  days: number;
  totals: { totalUsers: number; newToday: number; new7d: number; new30d: number; suspended: number; active24h: number; active7d: number; peak: number; avgDaily: number };
  kyc: { pending: number; approved: number; rejected: number };
  series: { date: string; signups: number }[];
  topBalance: PlayerRow[];
  recentSignups: PlayerRow[];
}


const money = (v: number) => v >= 1_000_000
  ? `${CURRENCY_SYMBOL} ${(v / 1_000_000).toFixed(2)}M`
  : v >= 1_000 ? `${CURRENCY_SYMBOL} ${(v / 1_000).toFixed(1)}K` : `${CURRENCY_SYMBOL} ${Math.round(v).toLocaleString(MONEY_LOCALE)}`;
const ago = (iso: string) => {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  return d <= 0 ? "today" : d === 1 ? "1d ago" : `${d}d ago`;
};

function Kpi({ label, value, detail, tone }: { label: string; value: string; detail: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-600">{label}</p>
      <p className={`mt-2.5 text-2xl font-black tracking-tight ${tone ?? "text-white"}`}>{value}</p>
      <p className="mt-1 text-[10px] font-bold text-slate-600">{detail}</p>
    </div>
  );
}

function LeaderPanel({ title, icon, rows, metricLabel }: { title: string; icon: string; rows: PlayerRow[]; metricLabel: "balance" | "joined" }) {
  return (
    <section className="admin-panel overflow-hidden">
      <div className="flex h-11 items-center gap-2 border-b border-white/[0.06] px-4">
        <Icon name={icon} size={14} className="text-slate-500" />
        <h2 className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">{title}</h2>
      </div>
      {rows.length === 0
        ? <p className="px-4 py-6 text-center text-[11px] text-slate-700">No players yet</p>
        : <div className="divide-y divide-white/[0.04]">
            {rows.map((r) => (
              <Link key={r.id} href={`/admin/users/${r.id}`} className="flex items-center justify-between px-4 py-2.5 text-[11px] hover:bg-white/[0.025]">
                <span className="truncate font-bold text-slate-300">@{r.name}</span>
                <span className="ml-3 shrink-0 font-mono font-black text-white">
                  {metricLabel === "balance" ? money(r.balance) : ago(r.joined)}
                </span>
              </Link>
            ))}
          </div>}
    </section>
  );
}

export function PlayersClient() {
  const [range, setRange] = useState<AdminRangeValue>("today");
  const [data, setData] = useState<Players | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (r: AdminRangeValue) => {
    const url = `/api/admin/players?range=${r}`;
    const cached = getCached<Players>(url);
    if (cached) setData(cached);
    setLoading(!cached);
    try {
      const res = await fetch(url);
      if (res.ok) { const fresh = (await res.json()) as Players; setData(fresh); setCached(url, fresh); }
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(range); }, [range, load]);

  const kycTotal = data ? data.kyc.pending + data.kyc.approved + data.kyc.rejected : 0;

  return (
    <div className="admin-page">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Players &amp; growth</h1>
          <p className="text-[11px] text-slate-600">Acquisition, activity and base health · Kenya</p>
        </div>
        <RangeTabs value={range} onChange={setRange} />
      </header>

      {loading && !data ? (
        <div className="flex h-64 items-center justify-center"><div className="h-7 w-7 animate-spin rounded-full border-2 border-white/10 border-t-blue-500" /></div>
      ) : !data ? (
        <div className="p-8 text-sm text-red-400">Player data could not be loaded.</div>
      ) : (
        <>
          <div className="mb-4 grid gap-3 grid-cols-2 lg:grid-cols-4">
            <Kpi label="Total users" value={data.totals.totalUsers.toLocaleString()} detail={`+${data.totals.newToday} today`} tone="text-white" />
            <Kpi label="Signups today" value={`+${data.totals.newToday}`} detail={`peak ${data.totals.peak} · avg ${data.totals.avgDaily}/day`} tone="text-emerald-400" />
            <Kpi label="Active (24h)" value={data.totals.active24h.toLocaleString()} detail={`${data.totals.active7d.toLocaleString()} in last 7d`} />
            <Kpi label="Suspended" value={data.totals.suspended.toLocaleString()} detail="locked accounts" tone={data.totals.suspended ? "text-orange-400" : "text-white"} />
          </div>

          <section className="admin-panel mb-4 overflow-hidden">
            <div className="flex h-11 items-center justify-between border-b border-white/[0.06] px-4">
              <h2 className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Signups — last {data.days} days</h2>
              <span className="text-[9px] font-bold text-slate-700">new accounts / day</span>
            </div>
            <div className="h-[240px] p-3">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="signupFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgba(255,255,255,.04)" vertical={false} />
                  <XAxis dataKey="date" tickFormatter={(v: string) => v.slice(5)} tick={{ fill: "#475569", fontSize: 9 }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fill: "#475569", fontSize: 9 }} axisLine={false} tickLine={false} width={32} />
                  <Tooltip contentStyle={{ background: "#0b0f16", border: "1px solid rgba(255,255,255,.08)", borderRadius: 8, fontSize: 11 }} formatter={(v) => [`${v} signups`, ""]} />
                  <Area type="monotone" dataKey="signups" stroke="#10b981" fill="url(#signupFill)" strokeWidth={1.5} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </section>

          <div className="grid gap-4 lg:grid-cols-[1fr_1fr_1fr]">
            <section className="admin-panel overflow-hidden">
              <div className="flex h-11 items-center gap-2 border-b border-white/[0.06] px-4">
                <Icon name="verified_user" size={14} className="text-slate-500" />
                <h2 className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Merchant KYC</h2>
              </div>
              <div className="space-y-3 p-4">
                {([["Pending", data.kyc.pending, "text-amber-400"], ["Approved", data.kyc.approved, "text-emerald-400"], ["Rejected", data.kyc.rejected, "text-red-400"]] as const).map(([label, count, tone]) => (
                  <div key={label}>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold text-slate-400">{label}</span>
                      <span className={`font-mono font-black ${tone}`}>{count}</span>
                    </div>
                    <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/[0.05]">
                      <div className={`h-full rounded-full ${tone.replace("text-", "bg-")}`} style={{ width: `${kycTotal ? (count / kycTotal) * 100 : 0}%` }} />
                    </div>
                  </div>
                ))}
                {kycTotal === 0 && <p className="text-center text-[11px] text-slate-700">No merchant applications</p>}
              </div>
            </section>

            <LeaderPanel title="Top by balance" icon="trophy" rows={data.topBalance} metricLabel="balance" />
            <LeaderPanel title="Newest signups" icon="person_add" rows={data.recentSignups} metricLabel="joined" />
          </div>
        </>
      )}
    </div>
  );
}
