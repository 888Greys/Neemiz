"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Icon } from "@/components/icon";
import { CURRENCY_SYMBOL, MONEY_LOCALE } from "@/lib/currency";

interface UserRow {
  id: string;
  email: string | null;
  username: string | null;
  phone: string | null;
  walletBalance: string;
  isActive: boolean;
  isAdmin: boolean;
  createdAt: string;
  _count: { bets: number; transactions: number };
}

function Spinner() {
  return <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/10 border-t-[#087cff]" />;
}

interface Summary {
  totalUsers: number;
  newToday: number;
  suspended: number;
  totalHeld: number;
  deposits: { count: number; amount: number };
  withdrawals: { count: number; amount: number };
  bets: number;
  gamesPlayed: number;
}

const compact = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(2)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(1)}K` : `${n}`;
const compactMoney = (n: number) => `${CURRENCY_SYMBOL} ${compact(n)}`;

function SummaryCard({ icon, label, value, sub, accent }: { icon: string; label: string; value: string; sub?: string; accent: string }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/[0.07] bg-[#121419] p-4">
      <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full blur-2xl" style={{ backgroundColor: `${accent}22` }} />
      <span className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ backgroundColor: `${accent}1f`, color: accent }}>
        <Icon name={icon} fill className="text-[18px]" />
      </span>
      <p className="mt-3 text-2xl font-black tracking-tight text-white">{value}</p>
      <p className="mt-0.5 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">{label}</p>
      {sub && <p className="mt-0.5 text-[10px] text-slate-600">{sub}</p>}
    </div>
  );
}

function UsersSummary() {
  const [s, setS] = useState<Summary | null>(null);
  useEffect(() => {
    fetch("/api/admin/users/summary").then((r) => (r.ok ? r.json() : null)).then((d) => d && setS(d)).catch(() => {});
  }, []);

  if (!s) {
    return (
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-[116px] animate-pulse rounded-2xl bg-white/[0.04]" />)}
      </div>
    );
  }

  return (
    <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
      <SummaryCard icon="groups"                  accent="#087cff" label="Total users"   value={compact(s.totalUsers)} sub={`+${s.newToday} today · ${s.suspended} suspended`} />
      <SummaryCard icon="account_balance_wallet"  accent="#22c55e" label="Total held"    value={compactMoney(s.totalHeld)} sub="Across all wallets" />
      <SummaryCard icon="south_america"           accent="#38bdf8" label="Deposits"      value={compactMoney(s.deposits.amount)} sub={`${s.deposits.count.toLocaleString()} completed`} />
      <SummaryCard icon="payments"                accent="#f97316" label="Withdrawals"   value={compactMoney(s.withdrawals.amount)} sub={`${s.withdrawals.count.toLocaleString()} paid out`} />
      <SummaryCard icon="receipt_long"            accent="#a855f7" label="Bets placed"   value={compact(s.bets)} sub="Sports tickets" />
      <SummaryCard icon="sports_esports"          accent="#ec4899" label="Games played"  value={compact(s.gamesPlayed)} sub="Aviator, binary, forex…" />
    </div>
  );
}

const money = (value: string) =>
  `${CURRENCY_SYMBOL} ${Number(value).toLocaleString(MONEY_LOCALE, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

type SortMode = "recent" | "balance";

export function AdminUsersClient() {
  const [users, setUsers]   = useState<UserRow[]>([]);
  const [total, setTotal]   = useState(0);
  const [page, setPage]     = useState(1);
  const [pages, setPages]   = useState(1);
  const [limit, setLimit]   = useState(50);
  const [totalBalance, setTotalBalance] = useState(0);
  const [search, setSearch] = useState("");
  const [query, setQuery]   = useState("");
  const [sort, setSort]     = useState<SortMode>("recent");
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

  const load = useCallback(async (p: number, q: string, s: SortMode) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/users?page=${p}&q=${encodeURIComponent(q)}&sort=${s}`);
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users);
        setTotal(data.total);
        setPage(data.page);
        setPages(data.pages);
        setLimit(data.limit ?? 50);
        setTotalBalance(data.totalBalance ?? 0);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(1, query, sort); }, [load, query, sort]);

  async function toggleSuspend(user: UserRow) {
    setActing(user.id);
    try {
      const action = user.isActive ? "suspend" : "unsuspend";
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        setUsers((prev) => prev.map((u) => u.id === user.id ? { ...u, isActive: !user.isActive } : u));
      }
    } finally {
      setActing(null);
    }
  }

  return (
    <div className="admin-page">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-400">User operations</p>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-white">Users</h1>
          <p className="mt-1 text-[11px] text-slate-500">Search accounts, rank balances, and investigate activity.</p>
        </div>
        <form
          onSubmit={(e) => { e.preventDefault(); setQuery(search); }}
          className="flex w-full gap-2 sm:w-auto"
        >
          <div className="admin-panel-soft flex min-w-0 flex-1 items-center gap-2 px-3 py-2 sm:w-80">
            <Icon name="search" className="text-[16px] text-slate-600" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Email, username, phone…"
              className="min-w-0 flex-1 bg-transparent text-xs text-white outline-none placeholder:text-slate-700"
            />
          </div>
          <button type="submit" className="rounded-lg bg-[#087cff] px-4 py-2 text-xs font-black text-white hover:bg-blue-500">
            Find account
          </button>
        </form>
      </div>

      <UsersSummary />

      {/* Sort toggle — rank by balance to see who holds the most */}
      <div className="mb-4 flex items-center gap-1 rounded-lg bg-white/[0.03] p-1 sm:inline-flex">
        {([["recent", "Recent", "schedule"], ["balance", "Top balance", "trending_up"]] as const).map(([value, label, icon]) => (
          <button
            key={value}
            type="button"
            onClick={() => setSort(value)}
            className={`flex items-center gap-1.5 rounded-md px-3 py-2 text-[11px] font-black transition ${sort === value ? "bg-[#087cff] text-white shadow-[0_4px_14px_rgba(8,124,255,.3)]" : "text-slate-400 hover:text-white"}`}
          >
            <Icon name={icon} fill className="text-[14px]" />
            {label}
          </button>
        ))}
      </div>

      <div className="mb-4 grid grid-cols-2 border border-white/[0.07] bg-[#121419] sm:max-w-2xl sm:grid-cols-4">
        <div className="border-r border-white/[0.06] px-4 py-3"><p className="text-lg font-black text-white">{total.toLocaleString()}</p><p className="text-[9px] font-black uppercase tracking-widest text-slate-600">Matched accounts</p></div>
        <div className="border-r border-white/[0.06] px-4 py-3"><p className="font-mono text-lg font-black text-emerald-400">{money(String(totalBalance))}</p><p className="text-[9px] font-black uppercase tracking-widest text-slate-600">Total held</p></div>
        <div className="border-r border-white/[0.06] px-4 py-3"><p className="text-lg font-black text-sky-400">{users.filter((user) => user.isActive && !user.isAdmin).length}</p><p className="text-[9px] font-black uppercase tracking-widest text-slate-600">Active on page</p></div>
        <div className="px-4 py-3"><p className="text-lg font-black text-amber-400">{users.filter((user) => user.isAdmin).length}</p><p className="text-[9px] font-black uppercase tracking-widest text-slate-600">Privileged</p></div>
      </div>

      <div className="admin-panel overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : users.length === 0 ? (
          <p className="py-16 text-center text-slate-600 text-sm">No users found</p>
        ) : (
          <div className="overflow-x-auto"><table className="w-full min-w-[980px] text-sm">
            <thead>
              <tr className="border-b border-white/[0.06]">
                {["User", "Balance", "Activity", "Joined", "Account state", ""].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-[0.12em] text-slate-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((u, i) => {
                const rank = (page - 1) * limit + i + 1;
                const medal = rank === 1 ? "bg-amber-400/15 text-amber-300 ring-amber-400/30"
                  : rank === 2 ? "bg-slate-300/15 text-slate-200 ring-slate-300/30"
                  : rank === 3 ? "bg-orange-500/15 text-orange-300 ring-orange-500/30"
                  : "bg-white/[0.05] text-slate-400 ring-white/[0.08]";
                return (
                <tr key={u.id} className="admin-table-row border-b border-white/[0.04]">
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-3">
                      {sort === "balance" && (
                        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[11px] font-black ring-1 ${medal}`}>{rank}</span>
                      )}
                      <div className="min-w-0">
                        <p className="font-bold text-white text-[13px]">{u.username ? `@${u.username}` : u.email ?? u.phone ?? "Unnamed account"}</p>
                        <p className="mt-0.5 text-[10px] text-slate-600">{u.email ?? u.phone ?? "No verified contact"}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <p className="font-mono font-bold text-white">{money(u.walletBalance)}</p>
                    <p className="mt-0.5 text-[9px] uppercase tracking-wider text-slate-700">Stored wallet</p>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="text-slate-300">{u._count.transactions} ledger</span><span className="mx-1 text-slate-700">/</span><span className="text-slate-500">{u._count.bets} bets</span>
                  </td>
                  <td className="px-4 py-3.5 text-[11px] text-slate-500">
                    {new Date(u.createdAt).toLocaleDateString("en-KE", { year: "numeric", month: "short", day: "numeric" })}
                  </td>
                  <td className="px-4 py-3.5">
                    {u.isAdmin ? (
                      <span className="rounded-md bg-amber-500/12 px-2 py-1 text-[10px] font-black text-amber-400">ADMIN</span>
                    ) : u.isActive ? (
                      <span className="rounded-md bg-emerald-500/12 px-2 py-1 text-[10px] font-black text-emerald-400">ACTIVE</span>
                    ) : (
                      <span className="rounded-md bg-red-500/12 px-2 py-1 text-[10px] font-black text-red-400">SUSPENDED</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/admin/users/${u.id}`}
                        className="rounded-md border border-blue-500/20 bg-blue-500/10 px-3 py-1.5 text-[10px] font-black text-blue-300 hover:bg-blue-500/20"
                      >
                        Inspect
                      </Link>
                    {!u.isAdmin && (
                      <button
                        onClick={() => toggleSuspend(u)}
                        disabled={acting === u.id}
                        className={`rounded-md px-3 py-1.5 text-[10px] font-black transition disabled:opacity-50 ${
                          u.isActive
                            ? "bg-red-500/10 text-red-400 hover:bg-red-500/20"
                            : "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                        }`}
                      >
                        {acting === u.id ? "…" : u.isActive ? "Suspend" : "Reactivate"}
                      </button>
                    )}
                    </div>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table></div>
        )}
      </div>

      {pages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2">
          <button
            onClick={() => load(page - 1, query, sort)}
            disabled={page <= 1}
            className="rounded-md border border-white/[0.08] bg-white/[0.04] px-4 py-2 text-sm font-bold text-slate-400 disabled:opacity-40 hover:bg-white/[0.07]"
          >
            Previous
          </button>
          <span className="text-sm text-slate-600">{page} / {pages}</span>
          <button
            onClick={() => load(page + 1, query, sort)}
            disabled={page >= pages}
            className="rounded-md border border-white/[0.08] bg-white/[0.04] px-4 py-2 text-sm font-bold text-slate-400 disabled:opacity-40 hover:bg-white/[0.07]"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
