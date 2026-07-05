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

// ─── Money screen (Phase 3) ───────────────────────────────────────────────────
// Cashflow consolidation, reading /api/admin/money. Same primitives as the
// cockpit/market pages: KPI strip → deposits-vs-withdrawals area chart →
// provider breakdown + float split, plus the pending-payout queue.

interface ProviderRow { provider: string; amount: number; count: number }
interface Money {
  days: number;
  totals: { deposits: number; withdrawals: number; netCashflow: number; ggr: number; fees: number; withdrawalFees: number; p2pFees: number };
  series: { date: string; deposits: number; withdrawals: number; net: number }[];
  depositProviders: ProviderRow[];
  withdrawalProviders: ProviderRow[];
  float: { real: { balance: number; count: number }; test: { balance: number; count: number } };
  pendingWithdrawals: { count: number; amount: number };
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

function Kpi({ label, value, detail, tone }: { label: string; value: string; detail: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-600">{label}</p>
      <p className={`mt-2.5 text-2xl font-black tracking-tight ${tone ?? "text-white"}`}>{value}</p>
      <p className="mt-1 text-[10px] font-bold text-slate-600">{detail}</p>
    </div>
  );
}

function ProviderPanel({ title, rows, total }: { title: string; rows: ProviderRow[]; total: number }) {
  return (
    <section className="admin-panel overflow-hidden">
      <div className="flex h-11 items-center border-b border-white/[0.06] px-4">
        <h2 className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">{title}</h2>
      </div>
      {rows.length === 0
        ? <p className="px-4 py-6 text-center text-[11px] text-slate-700">No activity in range</p>
        : <div className="divide-y divide-white/[0.04]">
            {rows.map((r) => {
              const share = total > 0 ? (r.amount / total) * 100 : 0;
              return (
                <div key={r.provider} className="px-4 py-2.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-bold capitalize text-slate-300">{r.provider}</span>
                    <span className="font-mono font-black text-white">{money(r.amount)}</span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/[0.05]">
                      <div className="h-full rounded-full bg-[#087cff]" style={{ width: `${share}%` }} />
                    </div>
                    <span className="text-[9px] font-bold text-slate-600">{r.count} · {share.toFixed(0)}%</span>
                  </div>
                </div>
              );
            })}
          </div>}
    </section>
  );
}

export function MoneyClient() {
  const [range, setRange] = useState<AdminRangeValue>("today");
  const [data, setData] = useState<Money | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (r: AdminRangeValue) => {
    const url = `/api/admin/money?range=${r}`;
    const cached = getCached<Money>(url);
    if (cached) setData(cached);
    setLoading(!cached);
    try {
      const res = await fetch(url);
      if (res.ok) { const fresh = (await res.json()) as Money; setData(fresh); setCached(url, fresh); }
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(range); }, [range, load]);

  return (
    <div className="admin-page">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Money</h1>
          <p className="text-[11px] text-slate-600">Real-money cashflow · genuine providers only · Kenya</p>
        </div>
        <RangeTabs value={range} onChange={setRange} />
      </header>

      {loading && !data ? (
        <div className="flex h-64 items-center justify-center"><div className="h-7 w-7 animate-spin rounded-full border-2 border-white/10 border-t-blue-500" /></div>
      ) : !data ? (
        <div className="p-8 text-sm text-red-400">Money data could not be loaded.</div>
      ) : (
        <>
          <div className="mb-4 grid gap-3 grid-cols-2 lg:grid-cols-4">
            <Kpi label="Deposits in" value={money(data.totals.deposits)} detail={`over ${data.days} days`} tone="text-emerald-400" />
            <Kpi label="Withdrawals out" value={money(data.totals.withdrawals)} detail="provider-confirmed" tone="text-orange-400" />
            <Kpi label="Net cashflow" value={money(data.totals.netCashflow)} detail="deposits − withdrawals" tone={data.totals.netCashflow >= 0 ? "text-white" : "text-red-400"} />
            <Kpi label="Fees + GGR" value={money(data.totals.fees + data.totals.ggr)} detail={`${money(data.totals.fees)} fees · ${money(data.totals.ggr)} GGR`} />
          </div>

          <section className="admin-panel mb-4 overflow-hidden">
            <div className="flex h-11 items-center justify-between border-b border-white/[0.06] px-4">
              <h2 className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Deposits vs withdrawals</h2>
              <div className="flex gap-3 text-[9px] font-bold">
                <span className="flex items-center gap-1 text-emerald-400"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />Deposits</span>
                <span className="flex items-center gap-1 text-orange-400"><span className="h-1.5 w-1.5 rounded-full bg-orange-400" />Withdrawals</span>
              </div>
            </div>
            <div className="h-[260px] p-3">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="moneyDep" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#10b981" stopOpacity={0.3} /><stop offset="100%" stopColor="#10b981" stopOpacity={0} /></linearGradient>
                    <linearGradient id="moneyWd" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f97316" stopOpacity={0.25} /><stop offset="100%" stopColor="#f97316" stopOpacity={0} /></linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgba(255,255,255,.04)" vertical={false} />
                  <XAxis dataKey="date" tickFormatter={(v: string) => v.slice(5)} tick={{ fill: "#475569", fontSize: 9 }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={(v: number) => Math.abs(v) >= 1000 ? `${Math.round(v / 1000)}K` : String(v)} tick={{ fill: "#475569", fontSize: 9 }} axisLine={false} tickLine={false} width={42} />
                  <Tooltip contentStyle={{ background: "#0b0f16", border: "1px solid rgba(255,255,255,.08)", borderRadius: 8, fontSize: 11 }} formatter={(v) => money(Number(v ?? 0))} />
                  <Area type="monotone" dataKey="deposits" stroke="#10b981" fill="url(#moneyDep)" strokeWidth={1.5} dot={false} />
                  <Area type="monotone" dataKey="withdrawals" stroke="#f97316" fill="url(#moneyWd)" strokeWidth={1.5} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </section>

          <div className="grid gap-4 lg:grid-cols-2">
            <ProviderPanel title="Deposits by provider" rows={data.depositProviders} total={data.totals.deposits} />
            <ProviderPanel title="Withdrawals by provider" rows={data.withdrawalProviders} total={data.totals.withdrawals} />
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-600">Float — real wallets</p>
              <p className="mt-2.5 text-2xl font-black tracking-tight text-white">{money(data.float.real.balance)}</p>
              <p className="mt-1 text-[10px] font-bold text-slate-600">owed to {data.float.real.count.toLocaleString()} players</p>
            </div>
            <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-600">Test/excluded balance</p>
              <p className="mt-2.5 text-2xl font-black tracking-tight text-slate-400">{money(data.float.test.balance)}</p>
              <p className="mt-1 text-[10px] font-bold text-slate-600">{data.float.test.count.toLocaleString()} accounts (not real money)</p>
            </div>
            <Link href="/admin/withdrawals" className="group rounded-xl border border-white/[0.07] bg-white/[0.02] p-4 transition hover:border-orange-500/30 hover:bg-orange-500/[0.04]">
              <p className="flex items-center justify-between text-[10px] font-black uppercase tracking-[0.14em] text-slate-600">Pending payouts <Icon name="arrow_forward" size={12} className="text-slate-600 group-hover:text-orange-400" /></p>
              <p className={`mt-2.5 text-2xl font-black tracking-tight ${data.pendingWithdrawals.count ? "text-orange-400" : "text-white"}`}>{money(data.pendingWithdrawals.amount)}</p>
              <p className="mt-1 text-[10px] font-bold text-slate-600">{data.pendingWithdrawals.count} awaiting approval</p>
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
