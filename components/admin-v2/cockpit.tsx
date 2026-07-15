"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CURRENCY_SYMBOL, MONEY_LOCALE } from "@/lib/currency";
import { Icon } from "@/components/icon";

// Owner Cockpit, redesigned per the Stitch export but wired to the real
// /api/admin/cockpit endpoint (same data contract the current cockpit uses).

type MarketKey = "sports" | "binary" | "aviator" | "predictions" | "forex" | "p2p";

interface MarketMetric {
  key: MarketKey;
  label: string;
  turnover: number;
  ggr: number;
  margin: number;
  activePlayers: number;
  openContracts: number;
  openLiability: number;
  liabilityExact: boolean;
}

interface Cockpit {
  asOf: string;
  money: {
    netDepositsToday: number;
    depositsToday: number;
    depositsCount: number;
    withdrawalsToday: number;
    ggrToday: number;
    walletLiability: number;
    playerCount: number;
  };
  growth: { signupsToday: number; avg7d: number; peak30d: number };
  series: { granularity: "hour" | "day"; points: Array<{ t: string; deposits: number; withdrawals: number; net: number }> };
  markets: MarketMetric[];
  alerts: {
    pendingWithdrawals: number;
    openDisputes: number;
    pendingKyc: number;
    pendingDeposits: number;
    unsettledSports: number;
  };
}

const MARKET_ICON: Record<MarketKey, string> = {
  sports: "sports_soccer",
  binary: "candlestick_chart",
  aviator: "flight_takeoff",
  predictions: "online_prediction",
  forex: "currency_exchange",
  p2p: "swap_horiz",
};

const money = (value: number) =>
  value <= -1_000 || value >= 1_000_000
    ? `${CURRENCY_SYMBOL} ${(value / 1_000_000).toFixed(2)}M`.replace(" 0.00M", " 0")
    : value >= 1_000
      ? `${CURRENCY_SYMBOL} ${(value / 1_000).toFixed(1)}K`
      : `${CURRENCY_SYMBOL} ${Math.round(value).toLocaleString(MONEY_LOCALE)}`;

const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

function KpiCard({
  label,
  value,
  icon,
  badge,
  badgeTone,
  detail,
  critical,
  valueTone,
}: {
  label: string;
  value: string;
  icon: string;
  badge: string;
  badgeTone: "green" | "red";
  detail: string;
  critical?: boolean;
  valueTone?: "red";
}) {
  const badgeClass =
    badgeTone === "green"
      ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
      : "border-red-500/20 bg-red-500/10 text-red-400";
  return (
    <div className={`av2-card relative flex flex-col gap-2 overflow-hidden rounded-lg p-4 ${critical ? "!border-red-500/30" : ""}`}>
      {critical && <div className="absolute right-0 top-0 h-16 w-16 rounded-full bg-red-500/5 blur-xl" />}
      <div className="z-10 flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-[0.05em] text-[#c2c6d6]">{label}</span>
        <Icon name={icon} size={15} className={critical ? "text-red-400" : "text-[#c2c6d6]"} />
      </div>
      <div className={`av2-mono z-10 text-[32px] font-semibold leading-none tracking-[-0.02em] ${valueTone === "red" ? "text-red-400" : "text-[#e5e2e3]"}`}>
        {value}
      </div>
      <div className="z-10 mt-auto flex items-center gap-2 border-t border-[#424754]/30 pt-2">
        <span className={`rounded border px-1.5 py-0.5 text-[10px] font-bold ${badgeClass}`}>{badge}</span>
        <span className="text-[11px] text-[#c2c6d6]">{detail}</span>
      </div>
    </div>
  );
}

function MarketCard({ m }: { m: MarketMetric }) {
  const isP2P = m.key === "p2p";
  return (
    <Link href={`/admin/new/markets/${m.key}`} className="av2-card flex flex-col rounded-lg p-0 transition-colors hover:border-[#3b82f6]/40">
      <div className="flex items-center justify-between rounded-t-lg border-b border-[#424754]/50 bg-[#1c1b1c] p-4">
        <div className="flex items-center gap-2">
          <Icon name={MARKET_ICON[m.key]} size={18} className="text-[#c2c6d6]" />
          <span className="text-[16px] font-semibold text-[#e5e2e3]">{m.label}</span>
        </div>
        <span className="rounded border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-[10px] font-bold text-emerald-400">Live</span>
      </div>
      <div className="grid grid-cols-2 gap-x-2 gap-y-4 p-4">
        <Cell label={isP2P ? "Matched Vol" : "Turnover"} value={money(m.turnover)} />
        <Cell label={isP2P ? "Comm Fees" : "GGR"} value={`${money(m.ggr)} (${pct(m.margin)})`} tone="emerald" />
        <Cell label={isP2P ? "Active Traders" : "Active Players"} value={m.activePlayers.toLocaleString()} />
        <Cell
          label={isP2P ? "Disputes" : "Open Liab"}
          value={m.openLiability > 0 ? `${m.liabilityExact ? "" : "~"}${money(m.openLiability)}` : "—"}
          tone={isP2P && m.openLiability > 0 ? "tertiary" : undefined}
        />
      </div>
    </Link>
  );
}

function Cell({ label, value, tone }: { label: string; value: string; tone?: "emerald" | "tertiary" }) {
  const c = tone === "emerald" ? "text-emerald-400" : tone === "tertiary" ? "text-[#df7412]" : "text-[#e5e2e3]";
  return (
    <div>
      <div className="mb-1 text-[10px] uppercase tracking-wider text-[#c2c6d6]">{label}</div>
      <div className={`av2-mono ${c}`}>{value}</div>
    </div>
  );
}

export function AdminV2Cockpit() {
  const [data, setData] = useState<Cockpit | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/cockpit?range=today");
      if (res.ok) setData((await res.json()) as Cockpit);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading && !data) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-white/10 border-t-[#adc6ff]" />
      </div>
    );
  }
  if (!data) return <div className="p-8 text-sm text-red-400">Cockpit data could not be loaded.</div>;

  const { money: m, growth, markets, alerts, series } = data;
  const netUp = m.netDepositsToday >= 0;
  const hourly = series.granularity === "hour";

  const queue = [
    { label: "Sports Settlements", detail: `${alerts.unsettledSports} stuck > 24h`, href: "/admin/markets/sports", icon: "error", on: alerts.unsettledSports > 0, count: alerts.unsettledSports },
    { label: "P2P Disputes", detail: `${alerts.openDisputes} urgent cases`, href: "/admin/p2p", icon: "gavel", on: alerts.openDisputes > 0, count: alerts.openDisputes },
    { label: "Pending Withdrawals", detail: `${alerts.pendingWithdrawals} items requiring review`, href: "/admin/withdrawals", icon: "payments", on: alerts.pendingWithdrawals > 0, count: alerts.pendingWithdrawals },
    { label: "KYC Verification", detail: `${alerts.pendingKyc} merchants pending`, href: "/admin/p2p", icon: "badge", on: alerts.pendingKyc > 0, count: alerts.pendingKyc },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Net Deposits"
          value={money(m.netDepositsToday)}
          icon="payments"
          badge={netUp ? "IN > OUT" : "OUT > IN"}
          badgeTone={netUp ? "green" : "red"}
          detail={`${money(m.depositsToday)} in · ${money(m.withdrawalsToday)} out`}
        />
        <KpiCard
          label="GGR / House Rev"
          value={money(m.ggrToday)}
          icon="account_balance"
          badge={`${markets.length} markets`}
          badgeTone="green"
          detail="combined today"
        />
        <KpiCard
          label="Wallet Liability"
          value={money(m.walletLiability)}
          icon="warning"
          badge="OWED"
          badgeTone="red"
          detail={`to ${m.playerCount.toLocaleString()} players`}
          critical
          valueTone="red"
        />
        <KpiCard
          label="New Signups"
          value={`+${growth.signupsToday}`}
          icon="person_add"
          badge={`peak ${growth.peak30d}`}
          badgeTone="green"
          detail={`7d avg ${growth.avg7d}`}
        />
      </div>

      {/* Chart + Action Queue */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="av2-card flex flex-col rounded-lg p-5 lg:col-span-2">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h3 className="text-[16px] font-semibold text-[#e5e2e3]">Cashflow Dynamics</h3>
              <p className="mt-1 text-xs text-[#c2c6d6]">Deposits vs Withdrawals ({hourly ? "Hourly" : "Daily"})</p>
            </div>
            <div className="flex items-center gap-4 text-xs text-[#c2c6d6]">
              <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-emerald-500" />Deposits</span>
              <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-[#df7412]" />Withdrawals</span>
            </div>
          </div>
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series.points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="v2Dep" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#10b981" stopOpacity={0.3} /><stop offset="100%" stopColor="#10b981" stopOpacity={0} /></linearGradient>
                  <linearGradient id="v2Wd" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#df7412" stopOpacity={0.25} /><stop offset="100%" stopColor="#df7412" stopOpacity={0} /></linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(255,255,255,.05)" vertical={false} />
                <XAxis dataKey="t" tickFormatter={(v: string) => (hourly ? v : v.slice(5))} tick={{ fill: "#8c909f", fontSize: 10 }} axisLine={false} tickLine={false} interval={hourly ? 2 : "preserveStartEnd"} />
                <YAxis tickFormatter={(v: number) => (Math.abs(v) >= 1000 ? `${Math.round(v / 1000)}K` : String(v))} tick={{ fill: "#8c909f", fontSize: 10 }} axisLine={false} tickLine={false} width={42} />
                <Tooltip contentStyle={{ background: "#161618", border: "1px solid #27272a", borderRadius: 6, fontSize: 11 }} formatter={(v) => money(Number(v ?? 0))} />
                <Area type="monotone" dataKey="deposits" stroke="#10b981" fill="url(#v2Dep)" strokeWidth={1.5} dot={false} />
                <Area type="monotone" dataKey="withdrawals" stroke="#df7412" fill="url(#v2Wd)" strokeWidth={1.5} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="av2-card flex flex-col rounded-lg p-5">
          <div className="mb-4 flex items-center justify-between border-b border-[#424754]/50 pb-4">
            <h3 className="text-[16px] font-semibold text-[#e5e2e3]">Action Queue</h3>
          </div>
          <div className="flex flex-1 flex-col gap-3">
            {queue.map((q) => (
              <Link
                key={q.label}
                href={q.href}
                className={`flex items-center justify-between rounded p-3 transition-colors ${
                  q.on ? "border border-red-500/20 bg-red-500/5 hover:bg-red-500/10" : "av2-card-2 hover:bg-[#353436]"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon name={q.icon} size={18} className={q.on ? "text-red-400" : "text-[#c2c6d6]"} />
                  <div>
                    <div className="text-sm font-medium text-[#e5e2e3]">{q.label}</div>
                    <div className={`text-xs ${q.on ? "text-red-400" : "text-[#c2c6d6]"}`}>{q.detail}</div>
                  </div>
                </div>
                {q.on && q.count > 0 && (
                  <span className="rounded-full bg-[#3b82f6] px-2 py-0.5 text-[10px] font-bold text-white">{q.count}</span>
                )}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Market performance */}
      <div>
        <h3 className="mb-4 text-[16px] font-semibold text-[#e5e2e3]">Market Performance</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {markets.map((mk) => (
            <MarketCard key={mk.key} m={mk} />
          ))}
        </div>
      </div>

      <footer className="border-t border-[#424754]/30 pb-8 pt-3 text-center text-xs text-[#c2c6d6]">
        Nezeem Admin Console · Strict Access Control Monitored.
      </footer>
    </div>
  );
}
