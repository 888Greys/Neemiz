"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { getCached, setCached } from "@/lib/client-cache";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Icon } from "@/components/icon";
import { StatusBadge } from "@/components/admin-status-badge";

interface TransactionRow {
  id: string;
  type: string;
  amount: number;
  currency: string;
  status: string;
  provider: string | null;
  createdAt: string;
  user: { id: string; email: string | null; username: string | null };
}

interface Stats {
  totalUsers: number;
  newUsersToday: number;
  pendingKyc: number;
  openDisputes: number;
  pendingDeposits: number;
  pendingWithdrawals: number;
  totalMerchants: number;
  activeOrders: number;
  suspendedUsers: number;
  totalWalletBalance: number;
  realWalletCount?: number;
  testAccounts?: { count: number; balance: number };
  depositsToday: { count: number; amount: number };
  depositsMonth: { count: number; amount: number };
  bettingToday: { stakes: number; stakeCount: number; wins: number; winCount: number };
  exposure: { sports: number; predictions: number; binary: number; forex: number; aviator: number };
  recentTransactions: TransactionRow[];
}

interface ProfitData {
  days: Array<{ date: string; deposits: number; withdrawals: number; grossProfit: number }>;
  totals: { grossProfit: number };
}

const money = (value: number) =>
  value >= 1_000_000
    ? `KSh ${(value / 1_000_000).toFixed(2)}M`
    : value >= 1_000
      ? `KSh ${(value / 1_000).toFixed(1)}K`
      : `KSh ${value.toLocaleString("en-KE")}`;

function Metric({ label, value, detail, icon, tone = "blue" }: {
  label: string; value: string; detail: string; icon: string; tone?: "blue" | "green" | "amber" | "violet";
}) {
  const tones = {
    blue: "bg-blue-500/10 text-blue-400",
    green: "bg-emerald-500/10 text-emerald-400",
    amber: "bg-amber-500/10 text-amber-400",
    violet: "bg-violet-500/10 text-violet-400",
  };
  return (
    <div className="border-b border-r border-white/[0.06] bg-white/[0.012] p-4">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-600">{label}</p>
        <span className={`rounded-lg p-1.5 ${tones[tone]}`}><Icon name={icon} size={14} /></span>
      </div>
      <p className="mt-4 text-2xl font-black tracking-tight text-white">{value}</p>
      <p className="mt-1 text-[10px] font-medium text-slate-600">{detail}</p>
    </div>
  );
}

function Panel({ title, action, children, className = "" }: {
  title: string; action?: React.ReactNode; children: React.ReactNode; className?: string;
}) {
  return (
    <section className={`admin-panel overflow-hidden ${className}`}>
      <div className="flex h-11 items-center justify-between border-b border-white/[0.06] px-4">
        <h2 className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

// One-time security notice: the 2026-06-21 fabricated-balance cleanup.
// Dismissible per-admin (localStorage). Remove this component once acknowledged.
function BalanceCleanupAlert() {
  const [dismissed, setDismissed] = useState(true); // assume dismissed until checked (avoids SSR flash)
  useEffect(() => {
    try { setDismissed(localStorage.getItem("nezeem-admin-cleanup-20260621") === "1"); }
    catch { setDismissed(false); }
  }, []);
  if (dismissed) return null;
  return (
    <div className="admin-panel mb-4 flex items-start gap-3 border-l-2 border-amber-400/60 bg-amber-400/[0.06] p-3">
      <Icon name="shield" size={16} className="mt-0.5 shrink-0 text-amber-400" />
      <div className="min-w-0 flex-1 text-[12px] leading-relaxed text-slate-300">
        <p className="font-black text-amber-300">Balance cleanup — 21 Jun 2026</p>
        <p className="mt-0.5 text-slate-400">
          Reset 28 suspended, test &amp; owner accounts to their real net deposits — removed{" "}
          <span className="font-bold text-white">KSh 6,363,668</span> of fabricated/exploit/test balance,
          preserved <span className="font-bold text-white">KSh 11,093</span> genuine deposits. Logged as{" "}
          <span className="font-mono text-slate-300">admin_balance_reset</span> refund adjustments; full
          before-state snapshot retained for reversal.
        </p>
      </div>
      <button
        onClick={() => { try { localStorage.setItem("nezeem-admin-cleanup-20260621", "1"); } catch { /* ignore */ } setDismissed(true); }}
        className="shrink-0 rounded-lg px-2 py-1 text-[10px] font-black text-slate-500 hover:text-white"
      >
        Dismiss
      </button>
    </div>
  );
}

export function AdminDashboardClient({ adminEmail }: { adminEmail: string }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [profits, setProfits] = useState<ProfitData | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const load = useCallback(async () => {
    // Render last-known data instantly (like the main site) so revisiting the
    // command center never shows a blank spinner; then revalidate in the
    // background. Only block on the spinner when there is nothing cached.
    const cachedStats = getCached<Stats>("/api/admin/stats");
    const cachedProfits = getCached<ProfitData>("/api/admin/profits?days=30");
    if (cachedStats) setStats(cachedStats);
    if (cachedProfits) setProfits(cachedProfits);
    setLoading(!cachedStats);
    try {
      const [statsRes, profitsRes] = await Promise.all([
        fetch("/api/admin/stats"),
        fetch("/api/admin/profits?days=30"),
      ]);
      if (statsRes.ok) {
        const data = (await statsRes.json()) as Stats;
        setStats(data);
        setCached("/api/admin/stats", data);
      }
      if (profitsRes.ok) {
        const data = (await profitsRes.json()) as ProfitData;
        setProfits(data);
        setCached("/api/admin/profits?days=30", data);
      }
      setUpdatedAt(new Date());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading && !stats) {
    return <div className="flex min-h-screen items-center justify-center"><div className="h-7 w-7 animate-spin rounded-full border-2 border-white/10 border-t-blue-500" /></div>;
  }
  if (!stats) return <div className="p-8 text-sm text-red-400">Command center data could not be loaded.</div>;

  const alerts = [
    { label: "Withdrawal approvals", count: stats.pendingWithdrawals, href: "/admin/withdrawals", tone: "text-orange-400" },
    { label: "Open disputes", count: stats.openDisputes, href: "/admin/p2p", tone: "text-red-400" },
    { label: "KYC reviews", count: stats.pendingKyc, href: "/admin/p2p", tone: "text-amber-400" },
    { label: "Merchant deposits", count: stats.pendingDeposits, href: "/admin/p2p", tone: "text-blue-400" },
  ];

  const exposure = [
    ["Sports", stats.exposure.sports, "sports_soccer"],
    ["Predictions", stats.exposure.predictions, "online_prediction"],
    ["Binary", stats.exposure.binary, "candlestick_chart"],
    ["Forex", stats.exposure.forex, "currency_exchange"],
    ["Aviator", stats.exposure.aviator, "flight_takeoff"],
  ] as const;

  return (
    <div className="admin-page">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400">Platform operational</p>
          </div>
          <h1 className="mt-1 text-2xl font-black tracking-tight">Owner command center</h1>
          <p className="text-[11px] text-slate-600">{adminEmail} · {updatedAt ? `Synced ${updatedAt.toLocaleTimeString()}` : "Connecting"}</p>
        </div>
        <button onClick={load} className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[11px] font-black text-slate-400 hover:text-white">
          <Icon name="refresh" size={13} /> Refresh terminal
        </button>
      </header>

      <BalanceCleanupAlert />

      <div className="admin-panel mb-4 grid overflow-hidden sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Customer funds" value={money(stats.totalWalletBalance)} detail={stats.testAccounts && stats.testAccounts.count > 0 ? `${(stats.realWalletCount ?? stats.totalUsers).toLocaleString()} real wallets · ${stats.testAccounts.count} test excluded (${money(stats.testAccounts.balance)})` : `${stats.totalUsers.toLocaleString()} user wallets`} icon="account_balance_wallet" />
        <Metric label="Cash in today" value={money(stats.depositsToday.amount)} detail={`${stats.depositsToday.count} completed deposits`} icon="arrow_downward" tone="green" />
        <Metric label="Bet turnover today" value={money(stats.bettingToday.stakes)} detail={`${stats.bettingToday.stakeCount} stakes placed`} icon="bolt" tone="violet" />
        <Metric label="30D gross P&L" value={money(profits?.totals.grossProfit ?? 0)} detail={`${money(stats.bettingToday.wins)} wins paid today`} icon="trending_up" tone="amber" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.65fr_1fr]">
        <div className="space-y-4">
          <Panel title="30-day financial telemetry" action={<Link href="/admin/profits" className="text-[10px] font-black text-blue-400">OPEN FINANCE</Link>}>
            <div className="h-[260px] p-3">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={profits?.days ?? []} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="adminCashIn" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#10b981" stopOpacity={0.3} /><stop offset="100%" stopColor="#10b981" stopOpacity={0} /></linearGradient>
                    <linearGradient id="adminProfit" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#087cff" stopOpacity={0.25} /><stop offset="100%" stopColor="#087cff" stopOpacity={0} /></linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgba(255,255,255,.04)" vertical={false} />
                  <XAxis dataKey="date" tickFormatter={(v: string) => v.slice(5)} tick={{ fill: "#475569", fontSize: 9 }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={(v: number) => v >= 1000 ? `${Math.round(v / 1000)}K` : String(v)} tick={{ fill: "#475569", fontSize: 9 }} axisLine={false} tickLine={false} width={45} />
                  <Tooltip contentStyle={{ background: "#0b0f16", border: "1px solid rgba(255,255,255,.08)", borderRadius: 8, fontSize: 11 }} formatter={(v) => money(Number(v ?? 0))} />
                  <Area type="monotone" dataKey="deposits" stroke="#10b981" fill="url(#adminCashIn)" strokeWidth={1.5} dot={false} />
                  <Area type="monotone" dataKey="grossProfit" stroke="#087cff" fill="url(#adminProfit)" strokeWidth={1.5} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Panel>

          <Panel title="Product exposure">
            <div className="grid grid-cols-2 sm:grid-cols-5">
              {exposure.map(([label, count, icon]) => (
                <div key={label} className="border-b border-r border-white/[0.05] p-4 last:border-r-0">
                  <Icon name={icon} size={17} className="text-slate-500" />
                  <p className="mt-4 text-2xl font-black">{count}</p>
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-600">{label}</p>
                  <p className="mt-1 text-[9px] text-slate-700">Open positions</p>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Latest ledger activity" action={<Link href="/admin/users" className="text-[10px] font-black text-blue-400">INVESTIGATE USERS</Link>}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[650px] text-left">
                <thead><tr className="border-b border-white/[0.05] text-[9px] uppercase tracking-widest text-slate-700">
                  <th className="px-4 py-2.5">Account</th><th>Event</th><th>Provider</th><th>Status</th><th className="pr-4 text-right">Amount</th>
                </tr></thead>
                <tbody>
                  {stats.recentTransactions.map((tx) => (
                    <tr key={tx.id} className="border-b border-white/[0.04] text-[11px] hover:bg-white/[0.02]">
                      <td className="px-4 py-3"><Link href={`/admin/users/${tx.user.id}`} className="font-bold text-slate-300 hover:text-blue-400">{tx.user.email ?? tx.user.username ?? "Unknown"}</Link><p className="text-[9px] text-slate-700">{new Date(tx.createdAt).toLocaleString()}</p></td>
                      <td><StatusBadge status={tx.type} /></td>
                      <td className="text-slate-600">{tx.provider ?? "internal"}</td>
                      <td><StatusBadge status={tx.status} /></td>
                      <td className="pr-4 text-right font-mono font-bold text-white">{money(tx.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel title="Action queue">
            <div className="divide-y divide-white/[0.05]">
              {alerts.map((alert) => (
                <Link key={alert.label} href={alert.href} className="flex items-center justify-between px-4 py-3.5 hover:bg-white/[0.025]">
                  <div><p className="text-xs font-bold text-slate-300">{alert.label}</p><p className="text-[9px] text-slate-700">Requires owner review</p></div>
                  <span className={`font-mono text-xl font-black ${alert.count ? alert.tone : "text-slate-700"}`}>{alert.count}</span>
                </Link>
              ))}
            </div>
          </Panel>

          <Panel title="Accounts & network">
            <div className="grid grid-cols-2">
              <div className="border-b border-r border-white/[0.05] p-4"><p className="text-2xl font-black">{stats.totalUsers.toLocaleString()}</p><p className="text-[9px] uppercase tracking-widest text-slate-600">Total users</p><p className="mt-1 text-[9px] text-emerald-400">+{stats.newUsersToday} today</p></div>
              <div className="border-b border-white/[0.05] p-4"><p className="text-2xl font-black">{stats.totalMerchants}</p><p className="text-[9px] uppercase tracking-widest text-slate-600">Merchants</p><p className="mt-1 text-[9px] text-blue-400">{stats.activeOrders} live orders</p></div>
              <div className="border-r border-white/[0.05] p-4"><p className="text-2xl font-black">{stats.suspendedUsers}</p><p className="text-[9px] uppercase tracking-widest text-slate-600">Suspended</p></div>
              <div className="p-4"><p className="text-2xl font-black">{money(stats.depositsMonth.amount)}</p><p className="text-[9px] uppercase tracking-widest text-slate-600">Month deposits</p></div>
            </div>
          </Panel>

          <Panel title="Control modules">
            <div className="grid grid-cols-2 gap-2 p-3">
              {[
                ["/admin/activity", "Product activity", "Players and breakdowns", "bar_chart"],
                ["/admin/users", "User control", "Search, inspect, suspend", "groups"],
                ["/admin/p2p", "P2P desk", "KYC, disputes, wallets", "handshake"],
                ["/admin/withdrawals", "Approvals", "Approve or refund", "hourglass_top"],
                ["/admin/profits", "Finance", "Cash flow and P&L", "analytics"],
              ].map(([href, title, detail, icon]) => (
                <Link key={href} href={href} className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 hover:border-blue-500/20 hover:bg-blue-500/[0.04]">
                  <Icon name={icon} size={16} className="text-blue-400" />
                  <p className="mt-3 text-[11px] font-black">{title}</p>
                  <p className="mt-0.5 text-[9px] leading-4 text-slate-600">{detail}</p>
                </Link>
              ))}
            </div>
          </Panel>

          <Panel title="Security posture">
            <div className="space-y-3 p-4 text-[10px]">
              <div className="flex items-center justify-between"><span className="text-slate-500">Admin authentication</span><span className="font-black text-emerald-400">2FA ENFORCED</span></div>
              <div className="flex items-center justify-between"><span className="text-slate-500">Session boundary</span><span className="font-black text-emerald-400">SERVER VERIFIED</span></div>
              <div className="flex items-center justify-between"><span className="text-slate-500">Financial mutations</span><span className="font-black text-emerald-400">GUARDED</span></div>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
