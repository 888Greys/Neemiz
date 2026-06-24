"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { getCached, setCached } from "@/lib/client-cache";
import { CURRENCY_SYMBOL, MONEY_LOCALE } from "@/lib/currency";
import { Icon } from "@/components/icon";

// ─── Owner Cockpit (Phase 1) ──────────────────────────────────────────────────
// Reads /api/admin/cockpit → lib/admin/metrics. Reading order matches the agreed
// design: money top-left, growth top-right, the 6 independent market cards,
// alerts/queue rail. Each market card is identical (the comparability rule);
// P2P bends it (fees not GGR, disputes not exposure) because it's an exchange.

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

function MarketCard({ m }: { m: MarketMetric }) {
  const isP2P = m.key === "p2p";
  const liability = m.openLiability > 0
    ? `${m.liabilityExact ? "" : "~"}${money(m.openLiability)} open`
    : "no open risk";
  return (
    <Link
      href={`/admin/markets/${m.key}`}
      className="group flex flex-col rounded-xl border border-white/[0.07] bg-white/[0.02] p-3.5 transition hover:border-blue-500/25 hover:bg-blue-500/[0.04]"
    >
      <div className="mb-2.5 flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-white/[0.05] text-slate-400 group-hover:text-blue-300">
          <Icon name={MARKET_ICON[m.key]} size={15} />
        </span>
        <span className="text-[12px] font-black text-slate-200">{m.label}</span>
      </div>
      <p className="text-lg font-black tracking-tight text-white">{money(m.ggr)}</p>
      <p className="text-[10px] font-bold text-slate-600">
        {isP2P ? "fees" : "GGR"} · {pct(m.margin)} margin
      </p>
      <div className="mt-2.5 flex items-center justify-between border-t border-white/[0.06] pt-2 text-[10px] font-bold">
        <span className="text-slate-500">
          {m.activePlayers} {isP2P ? "traders" : "players"}
        </span>
        <span className="text-amber-400/90">{liability}</span>
      </div>
    </Link>
  );
}

function KpiCard({ label, value, detail, tone }: {
  label: string; value: string; detail: React.ReactNode; tone?: "green" | "amber";
}) {
  const toneClass = tone === "green" ? "text-emerald-400" : tone === "amber" ? "text-amber-400" : "text-slate-600";
  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-600">{label}</p>
      <p className="mt-3 text-2xl font-black tracking-tight text-white">{value}</p>
      <p className={`mt-1 text-[10px] font-bold ${toneClass}`}>{detail}</p>
    </div>
  );
}

export function AdminCockpitClient({ adminEmail }: { adminEmail: string }) {
  const [data, setData] = useState<Cockpit | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const load = useCallback(async () => {
    const cached = getCached<Cockpit>("/api/admin/cockpit");
    if (cached) setData(cached);
    setLoading(!cached);
    try {
      const res = await fetch("/api/admin/cockpit");
      if (res.ok) {
        const fresh = (await res.json()) as Cockpit;
        setData(fresh);
        setCached("/api/admin/cockpit", fresh);
        setUpdatedAt(new Date());
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading && !data) {
    return <div className="flex min-h-screen items-center justify-center"><div className="h-7 w-7 animate-spin rounded-full border-2 border-white/10 border-t-blue-500" /></div>;
  }
  if (!data) return <div className="p-8 text-sm text-red-400">Cockpit data could not be loaded.</div>;

  const { money: m, growth, markets, alerts } = data;
  const netUp = m.netDepositsToday >= 0;

  const queue = [
    { label: `${alerts.pendingWithdrawals} withdrawals pending`, detail: "approve or refund", href: "/admin/withdrawals", icon: "hourglass_top", tone: "text-orange-400", on: alerts.pendingWithdrawals > 0 },
    { label: `${alerts.openDisputes} P2P disputes open`, detail: "buyer/seller conflict", href: "/admin/p2p", icon: "gavel", tone: "text-red-400", on: alerts.openDisputes > 0 },
    { label: `${alerts.pendingKyc} KYC pending`, detail: "merchant verification", href: "/admin/p2p", icon: "badge", tone: "text-amber-400", on: alerts.pendingKyc > 0 },
    { label: `${alerts.pendingDeposits} merchant deposits`, detail: "crypto top-ups", href: "/admin/p2p", icon: "account_balance_wallet", tone: "text-blue-400", on: alerts.pendingDeposits > 0 },
    { label: `${alerts.unsettledSports} sports unsettled >24h`, detail: "settlement stuck", href: "/admin/markets/sports", icon: "warning", tone: "text-red-400", on: alerts.unsettledSports > 0 },
  ];

  return (
    <div className="admin-page">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400">Platform operational · Kenya</p>
          </div>
          <h1 className="mt-1 text-2xl font-black tracking-tight">Owner cockpit</h1>
          <p className="text-[11px] text-slate-600">{adminEmail} · {updatedAt ? `Synced ${updatedAt.toLocaleTimeString()}` : "Connecting"}</p>
        </div>
        <button onClick={load} className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[11px] font-black text-slate-400 hover:text-white">
          <Icon name="refresh" size={13} /> Refresh
        </button>
      </header>

      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Net deposits today"
          value={money(m.netDepositsToday)}
          tone={netUp ? "green" : "amber"}
          detail={<><Icon name={netUp ? "arrow_upward" : "arrow_downward"} size={11} /> {money(m.depositsToday)} in · {money(m.withdrawalsToday)} out</>}
        />
        <KpiCard
          label="GGR today (house)"
          value={money(m.ggrToday)}
          detail={`${markets.length} markets combined`}
        />
        <KpiCard
          label="Wallet liability"
          value={money(m.walletLiability)}
          detail={`owed to ${m.playerCount.toLocaleString()} players`}
        />
        <KpiCard
          label="Signups today"
          value={`+${growth.signupsToday}`}
          tone="green"
          detail={`peak ${growth.peak30d} · 7d avg ${growth.avg7d}`}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <div>
          <p className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-600">Markets · independent P&amp;L (tap to drill in)</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {markets.map((mk) => <MarketCard key={mk.key} m={mk} />)}
          </div>
        </div>

        <div>
          <p className="mb-2 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-slate-600">
            <Icon name="notifications" size={12} /> Alerts &amp; queue
          </p>
          <div className="admin-panel divide-y divide-white/[0.05] overflow-hidden">
            {queue.map((q) => (
              <Link key={q.label} href={q.href} className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.025]">
                <Icon name={q.icon} size={16} className={q.on ? q.tone : "text-slate-700"} />
                <div className="min-w-0 flex-1">
                  <p className={`text-[12px] font-bold ${q.on ? "text-slate-200" : "text-slate-600"}`}>{q.label}</p>
                  <p className="text-[9px] text-slate-700">{q.detail}</p>
                </div>
                {q.on && <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
