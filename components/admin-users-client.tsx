"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Icon } from "@/components/icon";

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

const money = (value: string) =>
  `KSh ${Number(value).toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function AdminUsersClient() {
  const [users, setUsers]   = useState<UserRow[]>([]);
  const [total, setTotal]   = useState(0);
  const [page, setPage]     = useState(1);
  const [pages, setPages]   = useState(1);
  const [search, setSearch] = useState("");
  const [query, setQuery]   = useState("");
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

  const load = useCallback(async (p: number, q: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/users?page=${p}&q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users);
        setTotal(data.total);
        setPage(data.page);
        setPages(data.pages);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(1, query); }, [load, query]);

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
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-400">Customer operations</p>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-white">Customer directory</h1>
          <p className="mt-1 text-[11px] text-slate-500">Search accounts, review balances, and investigate activity.</p>
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

      <div className="mb-4 grid grid-cols-3 border border-white/[0.07] bg-[#121419] sm:max-w-xl">
        <div className="border-r border-white/[0.06] px-4 py-3"><p className="text-lg font-black text-white">{total.toLocaleString()}</p><p className="text-[9px] font-black uppercase tracking-widest text-slate-600">Matched accounts</p></div>
        <div className="border-r border-white/[0.06] px-4 py-3"><p className="text-lg font-black text-emerald-400">{users.filter((user) => user.isActive && !user.isAdmin).length}</p><p className="text-[9px] font-black uppercase tracking-widest text-slate-600">Active on page</p></div>
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
                {["Customer", "Balance", "Activity", "Joined", "Account state", ""].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-[0.12em] text-slate-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="admin-table-row border-b border-white/[0.04]">
                  <td className="px-4 py-3.5">
                    <p className="font-bold text-white text-[13px]">{u.username ? `@${u.username}` : u.email ?? u.phone ?? "Unnamed account"}</p>
                    <p className="mt-0.5 text-[10px] text-slate-600">{u.email ?? u.phone ?? "No verified contact"}</p>
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
              ))}
            </tbody>
          </table></div>
        )}
      </div>

      {pages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2">
          <button
            onClick={() => load(page - 1, query)}
            disabled={page <= 1}
            className="rounded-md border border-white/[0.08] bg-white/[0.04] px-4 py-2 text-sm font-bold text-slate-400 disabled:opacity-40 hover:bg-white/[0.07]"
          >
            Previous
          </button>
          <span className="text-sm text-slate-600">{page} / {pages}</span>
          <button
            onClick={() => load(page + 1, query)}
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
