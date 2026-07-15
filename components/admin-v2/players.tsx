"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CURRENCY_SYMBOL, MONEY_LOCALE } from "@/lib/currency";
import { Icon } from "@/components/icon";

// Players surface, redesigned to the Stitch "Players" screens (Overview +
// Directory tabs). Wired to the same real endpoints the old client used:
//   overview  -> /api/admin/players?range=
//   directory -> /api/admin/users?page=&q=&sort= , /api/admin/users/summary
//   actions   -> PATCH /api/admin/users/{id}

const money = (v: number) =>
  v >= 1_000_000 ? `${CURRENCY_SYMBOL} ${(v / 1_000_000).toFixed(2)}M`
    : v >= 1_000 ? `${CURRENCY_SYMBOL} ${(v / 1_000).toFixed(1)}K`
      : `${CURRENCY_SYMBOL} ${Math.round(v).toLocaleString(MONEY_LOCALE)}`;
const moneyExact = (v: string) =>
  `${CURRENCY_SYMBOL} ${Number(v).toLocaleString(MONEY_LOCALE, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const ago = (iso: string) => {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  return d <= 0 ? "today" : d === 1 ? "1d ago" : `${d}d ago`;
};

// ─── Shared bits ──────────────────────────────────────────────────────────────

function Tabs({ tab, onTab }: { tab: "overview" | "directory"; onTab: (t: "overview" | "directory") => void }) {
  return (
    <div className="mb-6">
      <h2 className="mb-4 text-[32px] font-semibold tracking-[-0.02em] text-[#e5e2e3]">Players</h2>
      <div className="flex border-b border-[#424754]">
        {(["overview", "directory"] as const).map((t) => (
          <button
            key={t}
            onClick={() => onTab(t)}
            className={`border-b-2 px-4 py-2 text-[13px] capitalize transition-colors ${
              tab === t ? "border-[#adc6ff] font-semibold text-[#adc6ff]" : "border-transparent text-[#c2c6d6] hover:text-[#e5e2e3]"
            }`}
          >
            {t}
          </button>
        ))}
      </div>
    </div>
  );
}

function KpiTile({ label, value, extra, tone }: { label: string; value: string; extra?: React.ReactNode; tone?: string }) {
  return (
    <div className="av2-card flex flex-col justify-between rounded-lg p-4">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-[#c2c6d6]">{label}</span>
      <div className="mt-2 flex items-baseline gap-2">
        <span className={`av2-mono text-[20px] font-semibold ${tone ?? "text-[#e5e2e3]"}`}>{value}</span>
        {extra}
      </div>
    </div>
  );
}

// ─── Overview tab ─────────────────────────────────────────────────────────────

interface PlayerRow { id: string; name: string; balance: number; joined: string }
interface Players {
  days: number;
  totals: { totalUsers: number; newToday: number; new7d: number; new30d: number; suspended: number; active24h: number; active7d: number; peak: number; avgDaily: number };
  kyc: { pending: number; approved: number; rejected: number };
  series: { date: string; signups: number }[];
  topBalance: PlayerRow[];
  recentSignups: PlayerRow[];
}

function LeaderPanel({ title, icon, rows, metric }: { title: string; icon: string; rows: PlayerRow[]; metric: "balance" | "joined" }) {
  return (
    <div className="av2-card overflow-hidden rounded-lg">
      <div className="flex items-center gap-2 border-b border-[#424754]/50 px-4 py-3">
        <Icon name={icon} size={15} className="text-[#c2c6d6]" />
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[#c2c6d6]">{title}</h3>
      </div>
      {rows.length === 0 ? (
        <p className="px-4 py-6 text-center text-[11px] text-[#8c909f]">No players yet</p>
      ) : (
        <div className="divide-y divide-[#27272a]">
          {rows.map((r) => (
            <Link key={r.id} href={`/admin/new/users/${r.id}`} className="flex items-center justify-between px-4 py-2.5 text-[12px] transition-colors hover:bg-[#353436]">
              <span className="truncate font-semibold text-[#e5e2e3]">@{r.name}</span>
              <span className="av2-mono ml-3 shrink-0 text-[#adc6ff]">{metric === "balance" ? money(r.balance) : ago(r.joined)}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function Overview() {
  const [data, setData] = useState<Players | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;
    fetch("/api/admin/players?range=30d")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (live && d) setData(d); })
      .finally(() => live && setLoading(false));
    return () => { live = false; };
  }, []);

  if (loading && !data) return <div className="flex h-64 items-center justify-center"><div className="h-7 w-7 animate-spin rounded-full border-2 border-white/10 border-t-[#adc6ff]" /></div>;
  if (!data) return <div className="p-8 text-sm text-red-400">Player data could not be loaded.</div>;
  const kycTotal = data.kyc.pending + data.kyc.approved + data.kyc.rejected;

  return (
    <>
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiTile label="Total Registered Users" value={data.totals.totalUsers.toLocaleString()} extra={<span className="text-[13px] text-[#adc6ff]">+{data.totals.newToday}</span>} />
        <KpiTile label="Active (24h)" value={data.totals.active24h.toLocaleString()} extra={<span className="text-[13px] text-[#c2c6d6]">{data.totals.active7d.toLocaleString()} / 7d</span>} />
        <KpiTile label="Signups Today" value={`+${data.totals.newToday}`} tone="text-emerald-400" extra={<span className="text-[13px] text-[#c2c6d6]">peak {data.totals.peak}</span>} />
        <KpiTile label="Suspended" value={data.totals.suspended.toLocaleString()} tone={data.totals.suspended ? "text-[#ffb786]" : "text-[#e5e2e3]"} />
      </div>

      <div className="av2-card mb-6 rounded-lg p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-[16px] font-semibold text-[#e5e2e3]">Signups — last {data.days} days</h3>
          <span className="text-xs text-[#c2c6d6]">new accounts / day</span>
        </div>
        <div className="h-[240px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data.series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="v2Signup" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#10b981" stopOpacity={0.3} /><stop offset="100%" stopColor="#10b981" stopOpacity={0} /></linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(255,255,255,.05)" vertical={false} />
              <XAxis dataKey="date" tickFormatter={(v: string) => v.slice(5)} tick={{ fill: "#8c909f", fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fill: "#8c909f", fontSize: 10 }} axisLine={false} tickLine={false} width={32} />
              <Tooltip contentStyle={{ background: "#161618", border: "1px solid #27272a", borderRadius: 6, fontSize: 11 }} formatter={(v) => [`${v} signups`, ""]} />
              <Area type="monotone" dataKey="signups" stroke="#10b981" fill="url(#v2Signup)" strokeWidth={1.5} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="av2-card overflow-hidden rounded-lg">
          <div className="flex items-center gap-2 border-b border-[#424754]/50 px-4 py-3">
            <Icon name="verified_user" size={15} className="text-[#c2c6d6]" />
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[#c2c6d6]">Merchant KYC</h3>
          </div>
          <div className="space-y-3 p-4">
            {([["Pending", data.kyc.pending, "#ffb786"], ["Approved", data.kyc.approved, "#10b981"], ["Rejected", data.kyc.rejected, "#ffb4ab"]] as const).map(([label, count, color]) => (
              <div key={label}>
                <div className="flex items-center justify-between text-[12px]">
                  <span className="text-[#c2c6d6]">{label}</span>
                  <span className="av2-mono" style={{ color }}>{count}</span>
                </div>
                <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/[0.05]">
                  <div className="h-full rounded-full" style={{ width: `${kycTotal ? (count / kycTotal) * 100 : 0}%`, backgroundColor: color }} />
                </div>
              </div>
            ))}
            {kycTotal === 0 && <p className="text-center text-[11px] text-[#8c909f]">No merchant applications</p>}
          </div>
        </div>
        <LeaderPanel title="Top by balance" icon="emoji_events" rows={data.topBalance} metric="balance" />
        <LeaderPanel title="Newest signups" icon="person_add" rows={data.recentSignups} metric="joined" />
      </div>
    </>
  );
}

// ─── Directory tab ────────────────────────────────────────────────────────────

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
type StatusFilter = "all" | "active" | "suspended" | "admin";

function Directory() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [totalBalance, setTotalBalance] = useState(0);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"recent" | "balance">("recent");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

  const load = useCallback(async (p: number, q: string, s: "recent" | "balance") => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/users?page=${p}&q=${encodeURIComponent(q)}&sort=${s}`);
      if (res.ok) {
        const d = await res.json();
        setUsers(d.users);
        setTotal(d.total);
        setPage(d.page);
        setPages(d.pages);
        setTotalBalance(d.totalBalance ?? 0);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(1, query, sort); }, [load, query, sort]);

  async function toggleSuspend(u: UserRow) {
    setActing(u.id);
    try {
      const res = await fetch(`/api/admin/users/${u.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: u.isActive ? "suspend" : "unsuspend" }),
      });
      if (res.ok) setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, isActive: !u.isActive } : x)));
    } finally {
      setActing(null);
    }
  }

  const shown = users.filter((u) =>
    status === "all" ? true : status === "admin" ? u.isAdmin : status === "active" ? u.isActive && !u.isAdmin : !u.isActive,
  );

  return (
    <>
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiTile label="Matched Accounts" value={total.toLocaleString()} />
        <KpiTile label="Total Held" value={moneyExact(String(totalBalance))} tone="text-emerald-400" />
        <KpiTile label="Active on Page" value={String(users.filter((u) => u.isActive && !u.isAdmin).length)} />
        <KpiTile label="Privileged" value={String(users.filter((u) => u.isAdmin).length)} tone="text-[#ffb786]" />
      </div>

      {/* Controls */}
      <div className="av2-card mb-6 flex flex-col items-center justify-between gap-4 rounded-lg p-4 sm:flex-row">
        <form onSubmit={(e) => { e.preventDefault(); setQuery(search); }} className="flex w-full flex-1 items-center gap-3">
          <div className="relative max-w-md flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#c2c6d6]"><Icon name="search" size={18} /></span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search Username, ID, or Phone..."
              className="w-full rounded-md border border-[#424754] bg-[#0a0a0b] py-2 pl-9 pr-3 text-[13px] text-[#e5e2e3] outline-none focus:border-[#4d8eff] focus:ring-1 focus:ring-[#4d8eff]"
            />
          </div>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as StatusFilter)}
            className="h-[38px] rounded-md border border-[#424754] bg-[#0a0a0b] px-3 text-[13px] text-[#e5e2e3] outline-none focus:border-[#4d8eff]"
          >
            <option value="all">Status: All</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="admin">Admin</option>
          </select>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as "recent" | "balance")}
            className="hidden h-[38px] rounded-md border border-[#424754] bg-[#0a0a0b] px-3 text-[13px] text-[#e5e2e3] outline-none focus:border-[#4d8eff] lg:block"
          >
            <option value="recent">Sort: Recent</option>
            <option value="balance">Sort: Top balance</option>
          </select>
        </form>
      </div>

      {/* Table */}
      <div className="av2-card overflow-hidden rounded-lg">
        {loading ? (
          <div className="flex justify-center py-16"><div className="h-6 w-6 animate-spin rounded-full border-2 border-white/10 border-t-[#adc6ff]" /></div>
        ) : shown.length === 0 ? (
          <p className="py-16 text-center text-sm text-[#8c909f]">No users found</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="av2-mono w-full min-w-[880px] text-left text-[13px]">
              <thead>
                <tr className="border-b border-[#27272a] bg-[#161618] text-[11px] uppercase tracking-wider text-[#c2c6d6]">
                  <th className="py-3 pl-4 pr-3 font-semibold">Player</th>
                  <th className="hidden px-3 py-3 font-semibold md:table-cell">Registered</th>
                  <th className="hidden px-3 py-3 font-semibold sm:table-cell">Activity</th>
                  <th className="px-3 py-3 text-right font-semibold">Balance</th>
                  <th className="px-3 py-3 text-center font-semibold">State</th>
                  <th className="py-3 pl-3 pr-4 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#27272a]">
                {shown.map((u) => (
                  <tr key={u.id} className="transition-colors hover:bg-[#1c1b1c]">
                    <td className="py-3 pl-4 pr-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#424754] bg-[#353436] text-[11px] font-bold text-[#adc6ff]">
                          {(u.username ?? u.email ?? "?").slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="text-[13px] font-semibold text-[#e5e2e3]">{u.username ? `@${u.username}` : u.email ?? u.phone ?? "Unnamed"}</div>
                          <div className="text-[11px] text-[#8c909f]">{u.email ?? u.phone ?? "No contact"}</div>
                        </div>
                      </div>
                    </td>
                    <td className="hidden px-3 py-3 text-[#c2c6d6] md:table-cell">{new Date(u.createdAt).toLocaleDateString("en-KE", { year: "numeric", month: "short", day: "numeric" })}</td>
                    <td className="hidden px-3 py-3 text-[#c2c6d6] sm:table-cell">{u._count.transactions} tx · {u._count.bets} bets</td>
                    <td className="px-3 py-3 text-right text-[#e5e2e3]">{moneyExact(u.walletBalance)}</td>
                    <td className="px-3 py-3 text-center">
                      {u.isAdmin ? (
                        <span className="rounded bg-[#ffb786]/10 px-2 py-1 text-[10px] font-bold text-[#ffb786]">ADMIN</span>
                      ) : u.isActive ? (
                        <span className="rounded bg-emerald-500/10 px-2 py-1 text-[10px] font-bold text-emerald-400">ACTIVE</span>
                      ) : (
                        <span className="rounded bg-red-500/10 px-2 py-1 text-[10px] font-bold text-red-400">SUSPENDED</span>
                      )}
                    </td>
                    <td className="py-3 pl-3 pr-4">
                      <div className="flex items-center justify-end gap-2">
                        <Link href={`/admin/new/users/${u.id}`} className="rounded border border-[#4d8eff]/30 bg-[#4d8eff]/10 px-3 py-1.5 text-[10px] font-bold text-[#adc6ff] hover:bg-[#4d8eff]/20">Inspect</Link>
                        {!u.isAdmin && (
                          <button
                            onClick={() => toggleSuspend(u)}
                            disabled={acting === u.id}
                            className={`rounded px-3 py-1.5 text-[10px] font-bold transition disabled:opacity-50 ${u.isActive ? "bg-red-500/10 text-red-400 hover:bg-red-500/20" : "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"}`}
                          >
                            {acting === u.id ? "…" : u.isActive ? "Suspend" : "Reactivate"}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {pages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2">
          <button onClick={() => load(page - 1, query, sort)} disabled={page <= 1} className="rounded-md border border-[#424754] bg-[#1c1b1c] px-4 py-2 text-sm font-semibold text-[#c2c6d6] hover:bg-[#353436] disabled:opacity-40">Previous</button>
          <span className="text-sm text-[#8c909f]">{page} / {pages}</span>
          <button onClick={() => load(page + 1, query, sort)} disabled={page >= pages} className="rounded-md border border-[#424754] bg-[#1c1b1c] px-4 py-2 text-sm font-semibold text-[#c2c6d6] hover:bg-[#353436] disabled:opacity-40">Next</button>
        </div>
      )}
    </>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function AdminV2Players({ initialTab = "overview" }: { initialTab?: "overview" | "directory" }) {
  const [tab, setTab] = useState<"overview" | "directory">(initialTab);
  return (
    <div className="mx-auto max-w-7xl">
      <Tabs tab={tab} onTab={setTab} />
      {tab === "overview" ? <Overview /> : <Directory />}
    </div>
  );
}
