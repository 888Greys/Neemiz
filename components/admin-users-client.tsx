"use client";

import { useState, useEffect, useCallback } from "react";
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
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-white">Users</h1>
          <p className="text-slate-600 text-xs mt-0.5">{total.toLocaleString()} total accounts</p>
        </div>
        <form
          onSubmit={(e) => { e.preventDefault(); setQuery(search); }}
          className="flex gap-2"
        >
          <div className="flex items-center gap-2 rounded-xl bg-white/[0.04] border border-white/[0.06] px-3 py-2">
            <Icon name="search" className="text-[16px] text-slate-600" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Email, username, phone…"
              className="bg-transparent text-sm text-white outline-none placeholder:text-slate-700 w-52"
            />
          </div>
          <button type="submit" className="rounded-xl bg-[#087cff] px-4 py-2 text-sm font-bold text-white hover:bg-[#1a8aff]">
            Search
          </button>
        </form>
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-[#0f1623]">
        {loading ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : users.length === 0 ? (
          <p className="py-16 text-center text-slate-600 text-sm">No users found</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06]">
                {["User", "Balance", "Bets", "Txns", "Joined", "Status", ""].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-[0.12em] text-slate-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-bold text-white text-[13px]">{u.email ?? u.phone ?? "—"}</p>
                    {u.username && <p className="text-[11px] text-slate-600">@{u.username}</p>}
                  </td>
                  <td className="px-4 py-3 font-bold text-white">
                    KSh {Number(u.walletBalance).toLocaleString("en-KE", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3 text-slate-400">{u._count.bets}</td>
                  <td className="px-4 py-3 text-slate-400">{u._count.transactions}</td>
                  <td className="px-4 py-3 text-slate-600 text-[11px]">
                    {new Date(u.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    {u.isAdmin ? (
                      <span className="rounded-full bg-amber-500/12 px-2 py-0.5 text-[10px] font-black text-amber-400">Admin</span>
                    ) : u.isActive ? (
                      <span className="rounded-full bg-emerald-500/12 px-2 py-0.5 text-[10px] font-black text-emerald-400">Active</span>
                    ) : (
                      <span className="rounded-full bg-red-500/12 px-2 py-0.5 text-[10px] font-black text-red-400">Suspended</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {!u.isAdmin && (
                      <button
                        onClick={() => toggleSuspend(u)}
                        disabled={acting === u.id}
                        className={`rounded-xl px-3 py-1.5 text-[11px] font-black transition disabled:opacity-50 ${
                          u.isActive
                            ? "bg-red-500/10 text-red-400 hover:bg-red-500/20"
                            : "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                        }`}
                      >
                        {acting === u.id ? "…" : u.isActive ? "Suspend" : "Reactivate"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {pages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2">
          <button
            onClick={() => load(page - 1, query)}
            disabled={page <= 1}
            className="rounded-xl bg-white/[0.04] border border-white/[0.06] px-4 py-2 text-sm font-bold text-slate-400 disabled:opacity-40 hover:bg-white/[0.07]"
          >
            Previous
          </button>
          <span className="text-sm text-slate-600">{page} / {pages}</span>
          <button
            onClick={() => load(page + 1, query)}
            disabled={page >= pages}
            className="rounded-xl bg-white/[0.04] border border-white/[0.06] px-4 py-2 text-sm font-bold text-slate-400 disabled:opacity-40 hover:bg-white/[0.07]"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
