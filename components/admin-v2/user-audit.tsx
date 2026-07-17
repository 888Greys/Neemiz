"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Icon } from "@/components/icon";
import { CURRENCY_SYMBOL, MONEY_LOCALE } from "@/lib/currency";

// Full player audit — replaces the old Customer Investigation dump with charts,
// game mix, and deposits-vs-withdrawals so an owner can read a player in one pass.

type MoneyCount = { count: number; amount: number };
type Transaction = {
  id: string;
  type: string;
  amount: string;
  currency: string;
  status: string;
  provider: string | null;
  reference: string | null;
  createdAt: string;
};
type Bet = {
  id: string;
  betType: string;
  stake: string;
  totalOdds: string;
  potentialWin: string;
  winAmount: string | null;
  status: string;
  createdAt: string;
};
type Game = {
  key: string;
  label: string;
  icon: string;
  stakes: number;
  wins: number;
  count: number;
  net: number;
};
type Detail = {
  user: {
    id: string;
    supabaseId: string;
    email: string | null;
    phone: string | null;
    username: string | null;
    firstName: string | null;
    lastName: string | null;
    walletBalance: string;
    currency: string;
    isActive: boolean;
    isAdmin: boolean;
    createdAt: string;
    updatedAt: string;
    transactions: Transaction[];
    bets: Bet[];
  };
  summary: {
    realDeposits: MoneyCount;
    realWithdrawals: MoneyCount;
    stakes: MoneyCount;
    wins: MoneyCount;
    ledgerBalance: number;
    walletDifference: number;
    cashNet: number;
    pendingWithdrawals: MoneyCount;
  };
  audit: {
    days: number;
    series: { date: string; deposits: number; withdrawals: number; stakes: number; wins: number }[];
    games: Game[];
  };
};

const money = (v: number | string) =>
  `${CURRENCY_SYMBOL} ${Number(v).toLocaleString(MONEY_LOCALE, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const moneyShort = (v: number) => {
  const sign = v < 0 ? "-" : "";
  const a = Math.abs(v);
  if (a >= 1_000_000) return `${sign}${CURRENCY_SYMBOL} ${(a / 1_000_000).toFixed(2)}M`;
  if (a >= 1_000) return `${sign}${CURRENCY_SYMBOL} ${(a / 1_000).toFixed(1)}K`;
  return `${sign}${CURRENCY_SYMBOL} ${Math.round(a).toLocaleString(MONEY_LOCALE)}`;
};

const TYPE_TONE: Record<string, string> = {
  DEPOSIT: "text-emerald-400",
  WITHDRAWAL: "text-[#ffb786]",
  BET_STAKE: "text-[#c4b5fd]",
  BET_WIN: "text-emerald-400",
  BONUS: "text-[#adc6ff]",
  REFUND: "text-[#adc6ff]",
};

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub: string; tone?: string }) {
  return (
    <div className="av2-card flex flex-col justify-between rounded-lg p-4">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-[#c2c6d6]">{label}</span>
      <div className="mt-3">
        <div className={`av2-mono text-[20px] font-semibold ${tone ?? "text-[#e5e2e3]"}`}>{value}</div>
        <div className="mt-1 text-[12px] text-[#8c909f]">{sub}</div>
      </div>
    </div>
  );
}

function StatusChip({ status }: { status: string }) {
  const ok = status === "COMPLETED" || status === "WON" || status === "ACTIVE";
  const bad = status === "FAILED" || status === "LOST" || status === "SUSPENDED";
  const tone = ok ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
    : bad ? "border-red-500/30 bg-red-500/10 text-red-400"
      : "border-[#424754] bg-[#222226] text-[#c2c6d6]";
  return <span className={`inline-flex rounded border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${tone}`}>{status.replace(/_/g, " ")}</span>;
}

export function AdminV2UserAudit({ userId }: { userId: string }) {
  const [data, setData] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"ledger" | "sports">("ledger");
  const [acting, setActing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/users/${userId}`);
      if (!response.ok) throw new Error("Unable to load this player");
      setData(await response.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load this player");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  async function toggleSuspend() {
    if (!data || data.user.isAdmin) return;
    setActing(true);
    try {
      const action = data.user.isActive ? "suspend" : "unsuspend";
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) throw new Error("Action failed");
      await load();
    } catch {
      setError("Could not update account status");
    } finally {
      setActing(false);
    }
  }

  if (loading && !data) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-white/10 border-t-[#adc6ff]" />
      </div>
    );
  }
  if (error || !data) {
    return <div className="p-8 text-sm text-red-400">{error || "Player not found"}</div>;
  }

  const { user, summary, audit } = data;
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ") || "Not provided";
  const handle = user.username ? `@${user.username}` : user.email ?? user.phone ?? "Player";
  const clean = Math.abs(summary.walletDifference) < 0.01;
  const playerNet = summary.wins.amount - summary.stakes.amount;
  const maxGameStake = Math.max(...audit.games.map((g) => g.stakes), 1);
  const totalActivity = audit.series.reduce((s, d) => s + d.stakes + d.deposits + d.withdrawals, 0);

  return (
    <div className="mx-auto max-w-7xl">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/admin/new/players"
            className="mb-3 inline-flex items-center gap-1 text-[12px] font-semibold text-[#8c909f] transition-colors hover:text-[#e5e2e3]"
          >
            <Icon name="arrow_back" size={14} /> Players
          </Link>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#adc6ff]">Player audit</p>
          <h1 className="mt-1 text-[32px] font-semibold tracking-[-0.02em] text-[#e5e2e3]">{handle}</h1>
          <p className="mt-1 text-[13px] text-[#c2c6d6]">
            {user.email ?? "No email"} · {user.phone ?? "No phone"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-md px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider ${
            user.isActive ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
          }`}>
            {user.isActive ? "Active" : "Suspended"}
          </span>
          {!user.isAdmin && (
            <button
              type="button"
              disabled={acting}
              onClick={toggleSuspend}
              className="rounded-md border border-[#424754] bg-[#222226] px-3 py-1.5 text-[11px] font-semibold text-[#e5e2e3] transition hover:border-[#adc6ff]/40 hover:text-[#adc6ff] disabled:opacity-50"
            >
              {user.isActive ? "Suspend" : "Unsuspend"}
            </button>
          )}
        </div>
      </div>

      {!clean && (
        <div className="mb-4 rounded-lg border border-red-500/25 bg-red-500/[0.07] px-4 py-3 text-[13px] text-red-300">
          <strong className="font-semibold">Ledger mismatch.</strong> Wallet differs from completed ledger by {money(summary.walletDifference)}
          {" "}(expected {money(summary.ledgerBalance)}). Review before adjusting balances.
        </div>
      )}

      {/* KPIs */}
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-7">
        <Kpi label="Wallet" value={money(user.walletBalance)} sub="Current balance" />
        <Kpi label="Deposits" value={money(summary.realDeposits.amount)} sub={`${summary.realDeposits.count} completed`} tone="text-emerald-400" />
        <Kpi label="Withdrawals" value={money(summary.realWithdrawals.amount)} sub={`${summary.realWithdrawals.count} completed`} tone="text-[#ffb786]" />
        <Kpi label="Cash net" value={money(summary.cashNet)} sub="In − out" tone={summary.cashNet >= 0 ? "text-emerald-400" : "text-red-400"} />
        <Kpi label="Staked" value={money(summary.stakes.amount)} sub={`${summary.stakes.count} bets`} tone="text-[#c4b5fd]" />
        <Kpi label="Won" value={money(summary.wins.amount)} sub={`${summary.wins.count} wins`} tone="text-emerald-400" />
        <Kpi
          label="Player P&L"
          value={money(playerNet)}
          sub={playerNet >= 0 ? "Ahead of house" : "Behind house"}
          tone={playerNet >= 0 ? "text-emerald-400" : "text-red-400"}
        />
      </div>

      {/* Charts */}
      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="av2-card rounded-lg p-5">
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <h3 className="text-[16px] font-semibold text-[#e5e2e3]">Betting activity</h3>
              <p className="mt-0.5 text-[12px] text-[#8c909f]">Stakes vs wins · last {audit.days} days</p>
            </div>
            <span className="av2-mono text-[11px] text-[#adc6ff]">{moneyShort(totalActivity)} flow</span>
          </div>
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={audit.series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="uaStake" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#a78bfa" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#a78bfa" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="uaWin" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(255,255,255,.05)" vertical={false} />
                <XAxis dataKey="date" tickFormatter={(v: string) => v.slice(5)} tick={{ fill: "#8c909f", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(v: number) => (Math.abs(v) >= 1000 ? `${Math.round(v / 1000)}K` : String(v))} tick={{ fill: "#8c909f", fontSize: 10 }} axisLine={false} tickLine={false} width={40} />
                <Tooltip
                  contentStyle={{ background: "#161618", border: "1px solid #27272a", borderRadius: 6, fontSize: 11 }}
                  formatter={(v, name) => [money(Number(v ?? 0)), name === "stakes" ? "Staked" : "Won"]}
                  labelFormatter={(l) => String(l)}
                />
                <Area type="monotone" dataKey="stakes" stroke="#a78bfa" fill="url(#uaStake)" strokeWidth={1.5} dot={false} />
                <Area type="monotone" dataKey="wins" stroke="#10b981" fill="url(#uaWin)" strokeWidth={1.5} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 flex gap-4 text-[11px] text-[#8c909f]">
            <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-[#a78bfa]" /> Stakes</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Wins</span>
          </div>
        </div>

        <div className="av2-card rounded-lg p-5">
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <h3 className="text-[16px] font-semibold text-[#e5e2e3]">Cash movement</h3>
              <p className="mt-0.5 text-[12px] text-[#8c909f]">Deposits vs withdrawals · last {audit.days} days</p>
            </div>
            {summary.pendingWithdrawals.count > 0 && (
              <span className="rounded border border-[#ffb786]/30 bg-[#ffb786]/10 px-2 py-0.5 text-[10px] font-bold text-[#ffb786]">
                {summary.pendingWithdrawals.count} pending · {moneyShort(summary.pendingWithdrawals.amount)}
              </span>
            )}
          </div>
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={audit.series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="rgba(255,255,255,.05)" vertical={false} />
                <XAxis dataKey="date" tickFormatter={(v: string) => v.slice(5)} tick={{ fill: "#8c909f", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(v: number) => (Math.abs(v) >= 1000 ? `${Math.round(v / 1000)}K` : String(v))} tick={{ fill: "#8c909f", fontSize: 10 }} axisLine={false} tickLine={false} width={40} />
                <Tooltip
                  contentStyle={{ background: "#161618", border: "1px solid #27272a", borderRadius: 6, fontSize: 11 }}
                  formatter={(v, name) => [money(Number(v ?? 0)), name === "deposits" ? "Deposits" : "Withdrawals"]}
                />
                <Bar dataKey="deposits" fill="#10b981" radius={[2, 2, 0, 0]} maxBarSize={10} />
                <Bar dataKey="withdrawals" fill="#df7412" radius={[2, 2, 0, 0]} maxBarSize={10} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 flex gap-4 text-[11px] text-[#8c909f]">
            <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Deposits</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-[#df7412]" /> Withdrawals</span>
          </div>
        </div>
      </div>

      {/* Games + identity */}
      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className="av2-card rounded-lg p-5 lg:col-span-3">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-[16px] font-semibold text-[#e5e2e3]">Games played</h3>
              <p className="mt-0.5 text-[12px] text-[#8c909f]">Lifetime stake mix across products</p>
            </div>
            <span className="text-[11px] text-[#8c909f]">{audit.games.length} products</span>
          </div>
          {audit.games.length === 0 ? (
            <p className="py-10 text-center text-[13px] text-[#8c909f]">No betting activity yet</p>
          ) : (
            <div className="space-y-3">
              {audit.games.map((g) => (
                <div key={g.key} className="rounded-lg bg-[#1c1b1c]/80 px-3 py-3">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#222226] text-[#adc6ff]">
                        <Icon name={g.icon} size={16} />
                      </span>
                      <div className="min-w-0">
                        <div className="truncate text-[13px] font-semibold text-[#e5e2e3]">{g.label}</div>
                        <div className="text-[11px] text-[#8c909f]">{g.count.toLocaleString()} stakes</div>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="av2-mono text-[13px] font-semibold text-[#e5e2e3]">{moneyShort(g.stakes)}</div>
                      <div className={`av2-mono text-[11px] ${g.net >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                        {g.net >= 0 ? "+" : ""}{moneyShort(g.net)} P&L
                      </div>
                    </div>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.05]">
                    <div
                      className="h-full rounded-full bg-[#adc6ff]/80 transition-[width] duration-500 ease-out"
                      style={{ width: `${Math.max(4, (g.stakes / maxGameStake) * 100)}%` }}
                    />
                  </div>
                  <div className="mt-1.5 flex justify-between text-[10px] text-[#8c909f]">
                    <span>Won {moneyShort(g.wins)}</span>
                    <span>{((g.stakes / (summary.stakes.amount || 1)) * 100).toFixed(0)}% of stakes</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="av2-card flex flex-col rounded-lg p-5 lg:col-span-2">
          <h3 className="mb-4 text-[16px] font-semibold text-[#e5e2e3]">Identity</h3>
          <dl className="space-y-3 text-[12px]">
            {[
              ["Name", name],
              ["User ID", user.id],
              ["Supabase", user.supabaseId],
              ["Joined", new Date(user.createdAt).toLocaleString()],
              ["Updated", new Date(user.updatedAt).toLocaleString()],
              ["Ledger check", clean ? "Reconciles" : money(summary.walletDifference)],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between gap-4 border-b border-[#27272a] pb-2.5 last:border-0">
                <dt className="shrink-0 text-[#8c909f]">{label}</dt>
                <dd className={`break-all text-right ${label === "Ledger check" && !clean ? "text-red-400" : "text-[#e5e2e3]"} ${label === "Ledger check" && clean ? "text-emerald-400" : ""}`}>
                  {value}
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-auto pt-5 text-[11px] leading-relaxed text-[#8c909f]">
            Real cash counts completed fiat rails only (Lipa Haraka, MegaPay, Pesapal, Relworx). Bonuses, transfers, and pending payouts are excluded from deposit/withdrawal totals.
          </p>
        </div>
      </div>

      {/* Activity tables */}
      <div className="av2-card overflow-hidden rounded-lg">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#424754]/50 px-4">
          <div className="flex gap-1">
            {([
              ["ledger", "Ledger activity", user.transactions.length],
              ["sports", "Sports bets", user.bets.length],
            ] as const).map(([id, label, count]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`-mb-px border-b-2 px-4 py-3 text-[13px] font-semibold transition ${
                  tab === id ? "border-[#adc6ff] text-[#e5e2e3]" : "border-transparent text-[#8c909f] hover:text-[#c2c6d6]"
                }`}
              >
                {label}
                <span className="av2-mono ml-2 text-[11px] text-[#8c909f]">{count}</span>
              </button>
            ))}
          </div>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[#8c909f]">Latest 50</span>
        </div>

        {tab === "ledger" ? (
          user.transactions.length === 0 ? (
            <p className="px-4 py-10 text-center text-[13px] text-[#8c909f]">No ledger rows</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-[#27272a] text-[11px] uppercase tracking-wider text-[#8c909f]">
                    {["Date", "Type", "Amount", "Status", "Provider", "Reference"].map((h) => (
                      <th key={h} className="px-4 py-2.5 text-left font-semibold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#27272a]">
                  {user.transactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-[#1c1b1c]">
                      <td className="whitespace-nowrap px-4 py-2.5 text-[#8c909f]">{new Date(tx.createdAt).toLocaleString()}</td>
                      <td className={`px-4 py-2.5 font-semibold ${TYPE_TONE[tx.type] ?? "text-[#e5e2e3]"}`}>{tx.type.replace(/_/g, " ")}</td>
                      <td className="av2-mono px-4 py-2.5 text-[#e5e2e3]">{money(tx.amount)}</td>
                      <td className="px-4 py-2.5"><StatusChip status={tx.status} /></td>
                      <td className="px-4 py-2.5 text-[#c2c6d6]">{tx.provider ?? "internal"}</td>
                      <td className="max-w-[200px] truncate px-4 py-2.5 text-[#8c909f]">{tx.reference ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : user.bets.length === 0 ? (
          <p className="px-4 py-10 text-center text-[13px] text-[#8c909f]">No sports bets</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-[#27272a] text-[11px] uppercase tracking-wider text-[#8c909f]">
                  {["Date", "Type", "Stake", "Odds", "Potential", "Paid", "Status"].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#27272a]">
                {user.bets.map((bet) => (
                  <tr key={bet.id} className="hover:bg-[#1c1b1c]">
                    <td className="whitespace-nowrap px-4 py-2.5 text-[#8c909f]">{new Date(bet.createdAt).toLocaleString()}</td>
                    <td className="px-4 py-2.5 font-semibold text-[#e5e2e3]">{bet.betType}</td>
                    <td className="av2-mono px-4 py-2.5 text-[#e5e2e3]">{money(bet.stake)}</td>
                    <td className="av2-mono px-4 py-2.5 text-[#c2c6d6]">{Number(bet.totalOdds).toFixed(2)}</td>
                    <td className="av2-mono px-4 py-2.5 text-[#c2c6d6]">{money(bet.potentialWin)}</td>
                    <td className="av2-mono px-4 py-2.5 text-[#c2c6d6]">{bet.winAmount ? money(bet.winAmount) : "—"}</td>
                    <td className="px-4 py-2.5"><StatusChip status={bet.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
