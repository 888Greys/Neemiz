"use client";

import { useState, useEffect, useCallback } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Icon } from "@/components/icon";

interface DayData {
  date: string;
  deposits: number;
  withdrawals: number;
  betStakes: number;
  betWins: number;
  grossProfit: number;
}

interface ProfitsResponse {
  days: DayData[];
  totals: {
    deposits: number;
    withdrawals: number;
    betStakes: number;
    betWins: number;
    feesCollected: number;
    grossProfit: number;
  };
}

function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return (
    <div className="admin-panel p-4">
      <p className="text-xl font-black tracking-tight text-white">{value}</p>
      <p className={`mt-2 text-[9px] font-black uppercase tracking-[0.16em] ${color}`}>{label}</p>
      {sub && <p className="mt-1 text-[11px] text-slate-600">{sub}</p>}
    </div>
  );
}

function Spinner() {
  return <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/10 border-t-[#087cff]" />;
}

const RANGE_OPTIONS = [
  { label: "Today", days: 1  },
  { label: "7D",    days: 7  },
  { label: "30D",   days: 30 },
  { label: "90D",   days: 90 },
];

const fmt = (n: number) =>
  n >= 1_000_000
    ? `KSh ${(n / 1_000_000).toFixed(2)}M`
    : n >= 1_000
    ? `KSh ${(n / 1_000).toFixed(1)}K`
    : `KSh ${n.toLocaleString()}`;

export function AdminProfitsClient() {
  const [data, setData]       = useState<ProfitsResponse | null>(null);
  const [days, setDays]       = useState(30);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (d: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/profits?days=${d}`);
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(days); }, [load, days]);

  const t = data?.totals;

  return (
    <div className="admin-page">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[9px] font-black uppercase tracking-[0.24em] text-emerald-400">Financial intelligence</p>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-white">Finance & revenue</h1>
          <p className="mt-1 text-[11px] text-slate-500">Verified provider cash flow, wagering turnover and platform profitability.</p>
        </div>
        <div className="flex gap-1.5">
          {RANGE_OPTIONS.map((o) => (
            <button
              key={o.days}
              onClick={() => setDays(o.days)}
              className={`rounded-xl px-3 py-1.5 text-xs font-black transition ${days === o.days ? "bg-[#087cff] text-white" : "bg-white/[0.04] border border-white/[0.06] text-slate-500 hover:text-white"}`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {loading || !t ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
            <StatCard label="Gross Profit"    value={fmt(t.grossProfit)}    color={t.grossProfit >= 0 ? "text-emerald-400" : "text-red-400"} />
            <StatCard label="Real Cash In"    value={fmt(t.deposits)}       sub="Completed M-Pesa deposits" color="text-sky-400" />
            <StatCard label="Real Cash Out"   value={fmt(t.withdrawals)}    sub="Completed provider payouts" color="text-orange-400" />
            <StatCard label="Bet Stakes"      value={fmt(t.betStakes)}      color="text-violet-400" />
            <StatCard label="Bet Wins Paid"   value={fmt(t.betWins)}        color="text-rose-400" />
            <StatCard label="Fees Collected"  value={fmt(t.feesCollected)}  color="text-amber-400" />
          </div>

          {/* Gross profit chart */}
          <div className="admin-panel mb-4 p-5">
            <p className="mb-4 text-[11px] font-black uppercase tracking-[0.12em] text-slate-600">
              Daily Gross Profit (KSh)
            </p>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={data!.days} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="profitGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#087cff" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#087cff" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis
                  dataKey="date"
                  tick={{ fill: "#475569", fontSize: 10 }}
                  tickFormatter={(v: string) => v.slice(5)}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis tick={{ fill: "#475569", fontSize: 10 }} axisLine={false} tickLine={false} width={60}
                  tickFormatter={(v: number) => v >= 1000 ? `${(v/1000).toFixed(0)}K` : String(v)}
                />
                <Tooltip
                  contentStyle={{ background: "#0f1623", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, fontSize: 12 }}
                  labelStyle={{ color: "#94a3b8" }}
                  formatter={(v) => [`KSh ${Number(v ?? 0).toLocaleString()}`, "Gross Profit"]}
                />
                <Area type="monotone" dataKey="grossProfit" stroke="#087cff" strokeWidth={2} fill="url(#profitGrad)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Deposits vs Withdrawals chart */}
          <div className="admin-panel p-5">
            <p className="mb-4 text-[11px] font-black uppercase tracking-[0.12em] text-slate-600">
              Verified Cash In vs Cash Out (KSh)
            </p>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={data!.days} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="depGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#10b981" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="wdGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#f97316" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="date" tick={{ fill: "#475569", fontSize: 10 }} tickFormatter={(v: string) => v.slice(5)} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#475569", fontSize: 10 }} axisLine={false} tickLine={false} width={60}
                  tickFormatter={(v: number) => v >= 1000 ? `${(v/1000).toFixed(0)}K` : String(v)}
                />
                <Tooltip
                  contentStyle={{ background: "#0f1623", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, fontSize: 12 }}
                  labelStyle={{ color: "#94a3b8" }}
                  formatter={(v, name) => [`KSh ${Number(v ?? 0).toLocaleString()}`, name === "deposits" ? "Real Cash In" : "Real Cash Out"]}
                />
                <Area type="monotone" dataKey="deposits"    stroke="#10b981" strokeWidth={1.5} fill="url(#depGrad)" dot={false} />
                <Area type="monotone" dataKey="withdrawals" stroke="#f97316" strokeWidth={1.5} fill="url(#wdGrad)"  dot={false} />
              </AreaChart>
            </ResponsiveContainer>
            <div className="mt-3 flex gap-4 justify-end">
              <span className="flex items-center gap-1.5 text-[11px] text-slate-500"><span className="h-2 w-4 rounded bg-emerald-500/60 inline-block" /> M-Pesa cash in</span>
              <span className="flex items-center gap-1.5 text-[11px] text-slate-500"><span className="h-2 w-4 rounded bg-orange-500/60 inline-block" /> Provider cash out</span>
            </div>
          </div>

          {/* Daily table */}
          <div className="admin-panel mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  {["Date", "Real Cash In", "Real Cash Out", "Bet Stakes", "Bet Wins", "Gross P&L"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-[0.12em] text-slate-600">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...data!.days].reverse().map((d) => (
                  <tr key={d.date} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                    <td className="px-4 py-2.5 text-slate-400 text-[12px]">{d.date}</td>
                    <td className="px-4 py-2.5 text-sky-400 font-bold">
                      {d.deposits > 0 ? `KSh ${d.deposits.toLocaleString()}` : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-orange-400 font-bold">
                      {d.withdrawals > 0 ? `KSh ${d.withdrawals.toLocaleString()}` : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-violet-400 font-bold">
                      {d.betStakes > 0 ? `KSh ${d.betStakes.toLocaleString()}` : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-rose-400 font-bold">
                      {d.betWins > 0 ? `KSh ${d.betWins.toLocaleString()}` : "—"}
                    </td>
                    <td className={`px-4 py-2.5 font-black ${d.grossProfit >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {d.grossProfit !== 0 ? `KSh ${d.grossProfit.toLocaleString()}` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
