"use client";

import { useCallback, useEffect, useState } from "react";
import { Icon } from "@/components/icon";
import { CURRENCY_SYMBOL, MONEY_LOCALE } from "@/lib/currency";

// Today's deposits + withdrawals at a glance, so the owner never has to open the
// Lipa Haraka dashboard to see the day's money. Shared by both admin shells.

type Bucket = { count: number; total: number };
interface TodayRow {
  id: string; type: string; amount: number; status: string;
  provider: string | null; reference: string | null;
  phone: string | null; username: string | null; createdAt: string;
}
interface TodayData {
  range: "today" | "7d";
  deposits: Record<string, Bucket>;
  withdrawals: Record<string, Bucket>;
  net: number;
  rows: TodayRow[];
}

const money = (n: number) => `${CURRENCY_SYMBOL} ${Number(n).toLocaleString(MONEY_LOCALE, { maximumFractionDigits: 0 })}`;

const STATUS_STYLES: Record<string, string> = {
  COMPLETED: "bg-emerald-500/12 text-emerald-400",
  PENDING: "bg-sky-500/12 text-sky-400",
  PENDING_APPROVAL: "bg-amber-500/12 text-amber-400",
  FAILED: "bg-red-500/12 text-red-400",
  CANCELLED: "bg-slate-500/12 text-slate-400",
};
function StatusBadge({ status }: { status: string }) {
  return <span className={`rounded px-2 py-1 text-[10px] font-black ${STATUS_STYLES[status] ?? "bg-slate-500/12 text-slate-400"}`}>{status.replace(/_/g, " ")}</span>;
}

function StatTile({ label, count, total, tone }: { label: string; count: number; total: number; tone: string }) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] p-3">
      <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">{label}</p>
      <p className={`mt-1 text-[18px] font-black ${tone}`}>{money(total)}</p>
      <p className="text-[10px] font-semibold text-slate-500">{count.toLocaleString()} txns</p>
    </div>
  );
}

export function TodayMoney() {
  const [data, setData] = useState<TodayData | null>(null);
  const [range, setRange] = useState<"today" | "7d">("today");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/money/today?range=${range}`);
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, [range]);
  useEffect(() => { load(); }, [load]);

  const dep = data?.deposits ?? {};
  const wd = data?.withdrawals ?? {};
  const b = (m: Record<string, Bucket>, s: string): Bucket => m[s] ?? { count: 0, total: 0 };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-1 rounded-lg bg-white/[0.04] p-1">
          {([["today", "Today"], ["7d", "7 days"]] as const).map(([k, l]) => (
            <button
              key={k}
              onClick={() => setRange(k)}
              className={`rounded-md px-3 py-1.5 text-[11px] font-black transition ${range === k ? "bg-white/[0.1] text-white" : "text-slate-500 hover:text-white"}`}
            >
              {l}
            </button>
          ))}
        </div>
        <button onClick={load} className="flex items-center gap-1.5 rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-[10px] font-black text-slate-500 transition-colors hover:text-white">
          <Icon name="refresh" className="text-[13px]" /> Refresh
        </button>
      </div>

      {loading && !data ? (
        <div className="flex justify-center py-16"><div className="h-5 w-5 animate-spin rounded-full border-2 border-white/10 border-t-[#087cff]" /></div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            <StatTile label="Deposits paid" count={b(dep, "COMPLETED").count} total={b(dep, "COMPLETED").total} tone="text-emerald-400" />
            <StatTile label="Deposits failed" count={b(dep, "FAILED").count} total={b(dep, "FAILED").total} tone="text-red-400" />
            <StatTile label="Deposits pending" count={b(dep, "PENDING").count} total={b(dep, "PENDING").total} tone="text-sky-400" />
            <StatTile label="Payouts done" count={b(wd, "COMPLETED").count} total={b(wd, "COMPLETED").total} tone="text-emerald-400" />
            <StatTile label="Payouts pending" count={b(wd, "PENDING").count + b(wd, "PENDING_APPROVAL").count} total={b(wd, "PENDING").total + b(wd, "PENDING_APPROVAL").total} tone="text-amber-400" />
            <StatTile label="Net (in − out)" count={b(dep, "COMPLETED").count + b(wd, "COMPLETED").count} total={data?.net ?? 0} tone={(data?.net ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"} />
          </div>

          <div className="overflow-hidden rounded-xl border border-white/[0.06]">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[12px]">
                <thead className="border-b border-white/[0.07] text-[10px] uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-3 py-2.5 font-black">Time</th>
                    <th className="px-3 py-2.5 font-black">Type</th>
                    <th className="px-3 py-2.5 font-black">Phone / user</th>
                    <th className="px-3 py-2.5 text-right font-black">Amount</th>
                    <th className="px-3 py-2.5 font-black">Status</th>
                    <th className="px-3 py-2.5 font-black">Ref</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.05]">
                  {(data?.rows ?? []).length === 0 ? (
                    <tr><td colSpan={6} className="px-3 py-10 text-center text-[12px] text-slate-500">No transactions {range === "today" ? "today" : "in the last 7 days"}.</td></tr>
                  ) : (
                    (data?.rows ?? []).map((r) => (
                      <tr key={r.id} className="hover:bg-white/[0.02]">
                        <td className="whitespace-nowrap px-3 py-2.5 text-slate-400">
                          {new Date(r.createdAt).toLocaleString("en-KE", { dateStyle: "short", timeStyle: "short" })}
                        </td>
                        <td className="px-3 py-2.5">
                          <span className={`inline-flex items-center gap-1 font-black ${r.type === "DEPOSIT" ? "text-emerald-400" : "text-[#ffb786]"}`}>
                            <Icon name={r.type === "DEPOSIT" ? "south_west" : "north_east"} className="text-[13px]" />
                            {r.type === "DEPOSIT" ? "Deposit" : "Withdrawal"}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-slate-300">
                          {r.phone ?? "—"}{r.username ? <span className="ml-1 text-slate-600">@{r.username}</span> : null}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-right font-black text-white">{money(r.amount)}</td>
                        <td className="px-3 py-2.5"><StatusBadge status={r.status} /></td>
                        <td className="px-3 py-2.5 font-mono text-[11px] text-slate-500">{r.reference || "—"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
