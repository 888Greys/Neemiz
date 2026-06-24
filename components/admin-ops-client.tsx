"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { getCached, setCached } from "@/lib/client-cache";
import { CURRENCY_SYMBOL, MONEY_LOCALE } from "@/lib/currency";
import { Icon } from "@/components/icon";

// ─── Operations triage (Phase 3) ──────────────────────────────────────────────
// Consolidated queue overview, reading /api/admin/ops. Read-only triage: each
// queue card links out to its existing action page — no duplicated mutations.

interface Queue { key: string; label: string; icon: string; href: string; count: number; amount: number; oldest: string | null; detail: string }
interface Ops { queues: Queue[]; totalPending: number }

const money = (v: number) => v >= 1_000_000
  ? `${CURRENCY_SYMBOL} ${(v / 1_000_000).toFixed(2)}M`
  : v >= 1_000 ? `${CURRENCY_SYMBOL} ${(v / 1_000).toFixed(1)}K` : `${CURRENCY_SYMBOL} ${Math.round(v).toLocaleString(MONEY_LOCALE)}`;

function waited(iso: string | null) {
  if (!iso) return "—";
  const h = Math.floor((Date.now() - new Date(iso).getTime()) / 3_600_000);
  if (h < 1) return "<1h";
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export function OpsClient() {
  const [data, setData] = useState<Ops | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const cached = getCached<Ops>("/api/admin/ops");
    if (cached) setData(cached);
    setLoading(!cached);
    try {
      const res = await fetch("/api/admin/ops");
      if (res.ok) { const fresh = (await res.json()) as Ops; setData(fresh); setCached("/api/admin/ops", fresh); }
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="admin-page">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Operations</h1>
          <p className="text-[11px] text-slate-600">Everything waiting on an owner decision</p>
        </div>
        <button onClick={load} className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[11px] font-black text-slate-400 hover:text-white">
          <Icon name="refresh" size={13} /> Refresh
        </button>
      </header>

      {loading && !data ? (
        <div className="flex h-64 items-center justify-center"><div className="h-7 w-7 animate-spin rounded-full border-2 border-white/10 border-t-blue-500" /></div>
      ) : !data ? (
        <div className="p-8 text-sm text-red-400">Ops data could not be loaded.</div>
      ) : data.totalPending === 0 ? (
        <div className="admin-panel flex flex-col items-center justify-center gap-2 py-16 text-center">
          <Icon name="check_circle" size={28} className="text-emerald-400" />
          <p className="text-sm font-black text-slate-300">Queue clear</p>
          <p className="text-[11px] text-slate-600">Nothing is waiting on a decision right now.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {data.queues.map((q) => (
            <Link key={q.key} href={q.href}
              className={`group flex flex-col rounded-xl border p-4 transition ${q.count ? "border-white/[0.1] bg-white/[0.03] hover:border-[#087cff]/30 hover:bg-[#087cff]/[0.04]" : "border-white/[0.06] bg-white/[0.015]"}`}>
              <div className="flex items-center gap-3">
                <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${q.count ? "bg-[#087cff]/15 text-blue-300" : "bg-white/[0.04] text-slate-600"}`}>
                  <Icon name={q.icon} size={17} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-black text-slate-200">{q.label}</p>
                  <p className="text-[10px] text-slate-600">{q.detail}</p>
                </div>
                <Icon name="arrow_forward" size={14} className="text-slate-700 group-hover:text-blue-400" />
              </div>
              <div className="mt-4 flex items-end justify-between">
                <p className={`text-3xl font-black tracking-tight ${q.count ? "text-white" : "text-slate-700"}`}>{q.count}</p>
                <div className="text-right">
                  {q.amount > 0 && <p className="text-[12px] font-black text-orange-400">{money(q.amount)}</p>}
                  {q.count > 0 && <p className="text-[10px] font-bold text-slate-600">oldest waiting {waited(q.oldest)}</p>}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
