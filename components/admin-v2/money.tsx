"use client";

import { useCallback, useEffect, useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CURRENCY_SYMBOL, MONEY_LOCALE } from "@/lib/currency";
import { Icon } from "@/components/icon";
import { AdminProfitsClient } from "@/components/admin-profits-client";

// Money Treasury, built to the generated Stitch design. Cashflow tab is wired
// natively to /api/admin/money; the Daily P&L tab reuses the existing profits
// client (recoloured by the .admin-v2 theme bridge).

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

const money = (v: number) => {
  const sign = v < 0 ? "-" : "";
  const a = Math.abs(v);
  return a >= 1_000_000 ? `${sign}${CURRENCY_SYMBOL} ${(a / 1_000_000).toFixed(2)}M`
    : a >= 1_000 ? `${sign}${CURRENCY_SYMBOL} ${(a / 1_000).toFixed(1)}K`
      : `${sign}${CURRENCY_SYMBOL} ${Math.round(a).toLocaleString(MONEY_LOCALE)}`;
};

function KpiCard({ label, value, icon, tone, note }: { label: string; value: string; icon: string; tone: "up" | "down" | "flat"; note: string }) {
  const toneCls = tone === "up" ? "text-emerald-400" : tone === "down" ? "text-red-400" : "text-[#c2c6d6]";
  return (
    <div className="av2-card group relative overflow-hidden rounded-lg p-4">
      <div className="absolute right-0 top-0 p-4 opacity-10 transition-opacity group-hover:opacity-20">
        <Icon name={icon} size={48} />
      </div>
      <span className="text-[11px] font-semibold uppercase tracking-wider text-[#c2c6d6]">{label}</span>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="av2-mono text-[32px] font-bold tracking-tight text-[#e5e2e3]">{value}</span>
      </div>
      <div className={`mt-4 flex items-center gap-1 text-[12px] ${toneCls}`}>
        <Icon name={tone === "down" ? "arrow_downward" : "arrow_upward"} size={16} />
        <span>{note}</span>
      </div>
    </div>
  );
}

function ProviderPanel({ title, rows, total }: { title: string; rows: ProviderRow[]; total: number }) {
  return (
    <div className="av2-card overflow-hidden rounded-lg">
      <div className="flex h-11 items-center border-b border-[#424754]/50 px-4">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[#c2c6d6]">{title}</h3>
      </div>
      {rows.length === 0 ? (
        <p className="px-4 py-6 text-center text-[11px] text-[#8c909f]">No activity in range</p>
      ) : (
        <div className="divide-y divide-[#27272a]">
          {rows.map((r) => {
            const share = total > 0 ? (r.amount / total) * 100 : 0;
            return (
              <div key={r.provider} className="px-4 py-2.5">
                <div className="flex items-center justify-between text-[12px]">
                  <span className="font-semibold capitalize text-[#e5e2e3]">{r.provider}</span>
                  <span className="av2-mono text-[#e5e2e3]">{money(r.amount)}</span>
                </div>
                <div className="mt-1.5 flex items-center gap-2">
                  <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/[0.05]">
                    <div className="h-full rounded-full bg-[#4d8eff]" style={{ width: `${share}%` }} />
                  </div>
                  <span className="text-[9px] text-[#8c909f]">{r.count} · {share.toFixed(0)}%</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Cashflow() {
  const [data, setData] = useState<Money | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/money?range=today");
      if (res.ok) setData((await res.json()) as Money);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading && !data) return <div className="flex h-64 items-center justify-center"><div className="h-7 w-7 animate-spin rounded-full border-2 border-white/10 border-t-[#adc6ff]" /></div>;
  if (!data) return <div className="p-8 text-sm text-red-400">Money data could not be loaded.</div>;

  const t = data.totals;
  return (
    <>
      <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Net Deposits" value={money(t.netCashflow)} icon="account_balance_wallet" tone={t.netCashflow >= 0 ? "up" : "down"} note={`over ${data.days}d`} />
        <KpiCard label="Total Deposits" value={money(t.deposits)} icon="south_america" tone="up" note="completed in" />
        <KpiCard label="Total Withdrawals" value={money(t.withdrawals)} icon="payments" tone="down" note="paid out" />
        <KpiCard label="GGR (House Rev)" value={money(t.ggr)} icon="show_chart" tone="up" note={`${money(t.fees)} fees`} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="av2-card flex flex-col rounded-lg lg:col-span-2">
          <div className="flex items-center justify-between border-b border-[#424754]/50 p-4">
            <h3 className="text-[16px] font-semibold text-[#e5e2e3]">Deposits vs Withdrawals</h3>
            <div className="flex items-center gap-4 text-[12px] text-[#c2c6d6]">
              <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-emerald-500" />Deposits</span>
              <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-[#df7412]" />Withdrawals</span>
            </div>
          </div>
          <div className="h-[260px] p-3">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="v2mDep" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#10b981" stopOpacity={0.3} /><stop offset="100%" stopColor="#10b981" stopOpacity={0} /></linearGradient>
                  <linearGradient id="v2mWd" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#df7412" stopOpacity={0.25} /><stop offset="100%" stopColor="#df7412" stopOpacity={0} /></linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(255,255,255,.05)" vertical={false} />
                <XAxis dataKey="date" tickFormatter={(v: string) => v.slice(5)} tick={{ fill: "#8c909f", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(v: number) => (Math.abs(v) >= 1000 ? `${Math.round(v / 1000)}K` : String(v))} tick={{ fill: "#8c909f", fontSize: 10 }} axisLine={false} tickLine={false} width={42} />
                <Tooltip contentStyle={{ background: "#161618", border: "1px solid #27272a", borderRadius: 6, fontSize: 11 }} formatter={(v) => money(Number(v ?? 0))} />
                <Area type="monotone" dataKey="deposits" stroke="#10b981" fill="url(#v2mDep)" strokeWidth={1.5} dot={false} />
                <Area type="monotone" dataKey="withdrawals" stroke="#df7412" fill="url(#v2mWd)" strokeWidth={1.5} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="space-y-4">
          <ProviderPanel title="Deposits by provider" rows={data.depositProviders} total={t.deposits} />
          <ProviderPanel title="Withdrawals by provider" rows={data.withdrawalProviders} total={t.withdrawals} />
        </div>
      </div>
    </>
  );
}

export function AdminV2Money({ initialTab = "cashflow" }: { initialTab?: "cashflow" | "pnl" }) {
  const [tab, setTab] = useState<"cashflow" | "pnl">(initialTab);
  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h2 className="text-[32px] font-semibold tracking-[-0.02em] text-[#e5e2e3]">Money Treasury</h2>
          <p className="mt-1 text-[14px] text-[#c2c6d6]">Real-time treasury monitoring and cashflow visibility.</p>
        </div>
      </div>

      <div className="mb-6 flex border-b border-[#424754]">
        {([["cashflow", "Cashflow", "trending_up"], ["pnl", "Daily P&L", "account_balance"]] as const).map(([id, label, icon]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 border-b-2 px-6 py-3 text-[14px] transition-colors ${tab === id ? "border-[#adc6ff] font-bold text-[#adc6ff]" : "border-transparent text-[#c2c6d6] hover:text-[#e5e2e3]"}`}
          >
            <Icon name={icon} size={18} /> {label}
          </button>
        ))}
      </div>

      {tab === "cashflow" ? <Cashflow /> : <AdminProfitsClient />}
    </div>
  );
}
