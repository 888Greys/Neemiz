"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Icon } from "@/components/icon";
import { StatusBadge } from "@/components/admin-status-badge";
import { CURRENCY_SYMBOL, MONEY_LOCALE } from "@/lib/currency";

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
  };
};

const money = (value: number | string) =>
  `${CURRENCY_SYMBOL} ${Number(value).toLocaleString(MONEY_LOCALE, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function Metric({ label, value, sub, tone }: { label: string; value: string; sub: string; tone: string }) {
  return (
    <div className="border-b border-r border-white/[0.06] bg-white/[0.012] p-4">
      <p className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-600">{label}</p>
      <p className={`mt-3 text-xl font-black ${tone}`}>{value}</p>
      <p className="mt-1 text-[10px] text-slate-600">{sub}</p>
    </div>
  );
}

export function AdminUserDetailClient({ userId }: { userId: string }) {
  const [data, setData] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/users/${userId}`);
      if (!response.ok) throw new Error("Unable to load this user");
      setData(await response.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load this user");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="flex justify-center py-24"><div className="h-7 w-7 animate-spin rounded-full border-2 border-white/10 border-t-[#087cff]" /></div>;
  if (error || !data) return <div className="mx-auto max-w-6xl px-4 py-12 text-red-400">{error || "User not found"}</div>;

  const { user, summary } = data;
  const differenceIsClean = Math.abs(summary.walletDifference) < 0.01;

  return (
    <div className="admin-page">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/admin/users" className="mb-3 inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-white">
            <Icon name="arrow_back" size={14} /> Users
          </Link>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-400">Customer investigation</p>
          <h1 className="mt-1 text-2xl font-black text-white">{user.username ? `@${user.username}` : user.email ?? user.phone ?? "User"}</h1>
          <p className="mt-1 text-xs text-slate-500">{user.email ?? "No email"} · {user.phone ?? "No phone"}</p>
        </div>
        <div className={`rounded-md px-3 py-1.5 text-[10px] font-black ${user.isActive ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"}`}>
          {user.isActive ? "ACTIVE ACCOUNT" : "SUSPENDED ACCOUNT"}
        </div>
      </div>

      <div className="admin-panel mb-4 grid overflow-hidden grid-cols-2 lg:grid-cols-6">
          <Metric label="Wallet balance" value={money(user.walletBalance)} sub="Current stored balance" tone="text-white" />
          <Metric label="Real cash in" value={money(summary.realDeposits.amount)} sub={`${summary.realDeposits.count} provider deposits`} tone="text-sky-400" />
          <Metric label="Real cash out" value={money(summary.realWithdrawals.amount)} sub={`${summary.realWithdrawals.count} completed payouts`} tone="text-orange-400" />
          <Metric label="Bet stakes" value={money(summary.stakes.amount)} sub={`${summary.stakes.count} ledger entries`} tone="text-violet-400" />
          <Metric label="Bet wins" value={money(summary.wins.amount)} sub={`${summary.wins.count} ledger entries`} tone="text-rose-400" />
          <Metric label="Ledger difference" value={money(summary.walletDifference)} sub={differenceIsClean ? "Wallet reconciles" : `Expected ${money(summary.ledgerBalance)}`} tone={differenceIsClean ? "text-emerald-400" : "text-red-400"} />
      </div>

      {!differenceIsClean && (
        <div className="mb-4 border border-red-500/20 bg-red-500/[0.07] p-4 text-sm text-red-300">
          <strong>Financial review required.</strong> The stored wallet differs from the completed transaction ledger by {money(summary.walletDifference)}. Do not adjust balances from this screen before the ledger is reconciled.
        </div>
      )}

      <div className="mb-4 grid gap-4 md:grid-cols-[1.1fr_.9fr]">
        <section className="admin-panel p-5">
          <div className="mb-4 flex items-center justify-between"><h2 className="text-sm font-black text-white">Account identity</h2><span className="text-[9px] font-black uppercase tracking-widest text-slate-600">Profile record</span></div>
          <dl className="space-y-3 text-xs">
            {[
              ["Name", [user.firstName, user.lastName].filter(Boolean).join(" ") || "Not provided"],
              ["User ID", user.id],
              ["Supabase ID", user.supabaseId],
              ["Joined", new Date(user.createdAt).toLocaleString()],
              ["Last updated", new Date(user.updatedAt).toLocaleString()],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between gap-4 border-b border-white/[0.04] pb-2">
                <dt className="text-slate-600">{label}</dt><dd className="break-all text-right text-slate-300">{value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="admin-panel p-5">
          <div className="mb-4 flex items-center justify-between"><h2 className="text-sm font-black text-white">Review scope</h2><Icon name="policy" size={16} className="text-slate-600" /></div>
          <p className="text-xs leading-5 text-slate-400">
            Real cash metrics only include completed payment-provider records. Internal transfers, bonuses, demo funds,
            failed payments, and pending payouts are excluded. A ledger difference is a review signal, not proof of fraud.
          </p>
          <div className="mt-5 grid grid-cols-2 gap-px overflow-hidden border border-white/[0.06] bg-white/[0.06]">
            <div className="bg-[#121419] p-3"><p className="text-lg font-black text-white">{user.transactions.length}</p><p className="text-[9px] font-black uppercase tracking-wider text-slate-600">Recent ledger rows</p></div>
            <div className="bg-[#121419] p-3"><p className="text-lg font-black text-white">{user.bets.length}</p><p className="text-[9px] font-black uppercase tracking-wider text-slate-600">Recent sports bets</p></div>
          </div>
        </section>
      </div>

      <section className="admin-panel mb-4 overflow-hidden">
        <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-3.5"><h2 className="text-sm font-black text-white">Ledger activity</h2><span className="text-[9px] font-black uppercase tracking-widest text-slate-600">Latest 50 records</span></div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="text-left text-[10px] uppercase tracking-wider text-slate-600">
              {["Date", "Type", "Amount", "Status", "Provider", "Reference"].map((item) => <th key={item} className="px-4 py-3">{item}</th>)}
            </tr></thead>
            <tbody>{user.transactions.map((transaction) => (
              <tr key={transaction.id} className="border-t border-white/[0.04]">
                <td className="px-4 py-3 text-slate-500">{new Date(transaction.createdAt).toLocaleString()}</td>
                <td className="px-4 py-3"><StatusBadge status={transaction.type} /></td>
                <td className="px-4 py-3 font-bold text-slate-200">{money(transaction.amount)}</td>
                <td className="px-4 py-3"><StatusBadge status={transaction.status} /></td>
                <td className="px-4 py-3 text-slate-400">{transaction.provider ?? "internal"}</td>
                <td className="max-w-[180px] truncate px-4 py-3 text-slate-600">{transaction.reference ?? "—"}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </section>

      <section className="admin-panel overflow-hidden">
        <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-3.5"><h2 className="text-sm font-black text-white">Sports betting activity</h2><span className="text-[9px] font-black uppercase tracking-widest text-slate-600">Latest 50 bets</span></div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="text-left text-[10px] uppercase tracking-wider text-slate-600">
              {["Date", "Type", "Stake", "Odds", "Potential Win", "Paid", "Status"].map((item) => <th key={item} className="px-4 py-3">{item}</th>)}
            </tr></thead>
            <tbody>{user.bets.map((bet) => (
              <tr key={bet.id} className="border-t border-white/[0.04]">
                <td className="px-4 py-3 text-slate-500">{new Date(bet.createdAt).toLocaleString()}</td>
                <td className="px-4 py-3 font-bold text-white">{bet.betType}</td>
                <td className="px-4 py-3 text-slate-300">{money(bet.stake)}</td>
                <td className="px-4 py-3 text-slate-300">{Number(bet.totalOdds).toFixed(2)}</td>
                <td className="px-4 py-3 text-slate-300">{money(bet.potentialWin)}</td>
                <td className="px-4 py-3 text-slate-300">{bet.winAmount ? money(bet.winAmount) : "—"}</td>
                <td className="px-4 py-3"><StatusBadge status={bet.status} /></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
