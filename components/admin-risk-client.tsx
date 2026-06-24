"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { getCached, setCached } from "@/lib/client-cache";
import { CURRENCY_SYMBOL, MONEY_LOCALE } from "@/lib/currency";
import { Icon } from "@/components/icon";

// ─── Risk & security feed (Phase 3) ───────────────────────────────────────────
// Reads /api/admin/risk. Read-only: house worst-case exposure per market,
// settlement health, internal crypto-book liability, and integrity flags. The
// deep on-chain incident view lives at /admin/crypto (it hits RPCs).

interface MarketExposure { key: string; label: string; openLiability: number; openContracts: number; exact: boolean }
interface StuckSettlement { market: string; stuck: number; note: string }
interface CryptoLiability { crypto: string; amount: number }
interface Risk {
  exposure: MarketExposure[];
  totalExposure: number;
  settlement: StuckSettlement[];
  settlementStuck: number;
  voids24h: number;
  cryptoLiability: CryptoLiability[];
  flags: { suspended: number; negativeBalances: number; pendingWithdrawals: { count: number; amount: number } };
}

const money = (v: number) => v >= 1_000_000
  ? `${CURRENCY_SYMBOL} ${(v / 1_000_000).toFixed(2)}M`
  : v >= 1_000 ? `${CURRENCY_SYMBOL} ${(v / 1_000).toFixed(1)}K` : `${CURRENCY_SYMBOL} ${Math.round(v).toLocaleString(MONEY_LOCALE)}`;

const cryptoAmt = (v: number) => v.toLocaleString(MONEY_LOCALE, { maximumFractionDigits: 4 });

function Stat({ label, value, sub, tone = "default" }: { label: string; value: string; sub?: string; tone?: "default" | "warn" | "bad" }) {
  const valueColor = tone === "bad" ? "text-red-400" : tone === "warn" ? "text-orange-400" : "text-white";
  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-4">
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-600">{label}</p>
      <p className={`mt-1 text-2xl font-black tracking-tight ${valueColor}`}>{value}</p>
      {sub && <p className="text-[10px] font-bold text-slate-600">{sub}</p>}
    </div>
  );
}

export function RiskClient() {
  const [data, setData] = useState<Risk | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const cached = getCached<Risk>("/api/admin/risk");
    if (cached) setData(cached);
    setLoading(!cached);
    try {
      const res = await fetch("/api/admin/risk");
      if (res.ok) { const fresh = (await res.json()) as Risk; setData(fresh); setCached("/api/admin/risk", fresh); }
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const maxLiability = data ? Math.max(1, ...data.exposure.map((m) => m.openLiability)) : 1;

  return (
    <div className="admin-page">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Risk &amp; security</h1>
          <p className="text-[11px] text-slate-600">House exposure, settlement health, and integrity flags</p>
        </div>
        <button onClick={load} className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[11px] font-black text-slate-400 hover:text-white">
          <Icon name="refresh" size={13} /> Refresh
        </button>
      </header>

      {loading && !data ? (
        <div className="flex h-64 items-center justify-center"><div className="h-7 w-7 animate-spin rounded-full border-2 border-white/10 border-t-blue-500" /></div>
      ) : !data ? (
        <div className="p-8 text-sm text-red-400">Risk data could not be loaded.</div>
      ) : (
        <div className="flex flex-col gap-4">
          {/* Top-line risk numbers */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="House exposure" value={money(data.totalExposure)} sub="worst-case on open positions" />
            <Stat label="Settlement stuck" value={String(data.settlementStuck)} sub="trades past their settle time" tone={data.settlementStuck > 0 ? "warn" : "default"} />
            <Stat label="Voids (24h)" value={String(data.voids24h)} sub="refunded — couldn't settle" tone={data.voids24h > 0 ? "warn" : "default"} />
            <Stat label="Withdrawals to approve" value={String(data.flags.pendingWithdrawals.count)} sub={money(data.flags.pendingWithdrawals.amount)} tone={data.flags.pendingWithdrawals.count > 0 ? "warn" : "default"} />
          </div>

          {/* House exposure by market */}
          <section className="admin-panel p-4">
            <h2 className="mb-3 text-[12px] font-black uppercase tracking-wide text-slate-400">House exposure by market</h2>
            {data.exposure.length === 0 ? (
              <p className="text-[11px] text-slate-600">No open positions.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {data.exposure.map((m) => (
                  <div key={m.key} className="flex items-center gap-3">
                    <div className="w-28 shrink-0 text-[12px] font-black text-slate-200">{m.label}</div>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/[0.04]">
                      <div className="h-full rounded-full bg-[#087cff]/60" style={{ width: `${Math.round((m.openLiability / maxLiability) * 100)}%` }} />
                    </div>
                    <div className="w-28 shrink-0 text-right">
                      <p className="text-[12px] font-black text-white">{!m.exact && "~"}{money(m.openLiability)}</p>
                      <p className="text-[10px] text-slate-600">{m.openContracts.toLocaleString(MONEY_LOCALE)} open</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* Settlement health */}
            <section className="admin-panel p-4">
              <h2 className="mb-3 text-[12px] font-black uppercase tracking-wide text-slate-400">Settlement health</h2>
              {data.settlement.length === 0 ? (
                <div className="flex items-center gap-2 py-2 text-[12px] font-black text-emerald-400">
                  <Icon name="check_circle" size={15} /> All markets settling cleanly
                </div>
              ) : (
                <div className="flex flex-col divide-y divide-white/[0.05]">
                  {data.settlement.map((s) => (
                    <div key={s.market} className="flex items-center justify-between py-2">
                      <div>
                        <p className="text-[12px] font-black text-slate-200">{s.market}</p>
                        <p className="text-[10px] text-slate-600">{s.note}</p>
                      </div>
                      <p className="text-[15px] font-black text-orange-400">{s.stuck}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Internal crypto-book liability */}
            <section className="admin-panel p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-[12px] font-black uppercase tracking-wide text-slate-400">Crypto liability (internal)</h2>
                <Link href="/admin/crypto" className="flex items-center gap-1 text-[10px] font-black text-slate-500 hover:text-blue-400">
                  on-chain <Icon name="arrow_forward" size={12} />
                </Link>
              </div>
              {data.cryptoLiability.length === 0 ? (
                <p className="text-[11px] text-slate-600">No crypto held on-platform.</p>
              ) : (
                <div className="flex flex-col divide-y divide-white/[0.05]">
                  {data.cryptoLiability.map((c) => (
                    <div key={c.crypto} className="flex items-center justify-between py-2">
                      <p className="text-[12px] font-black text-slate-200">{c.crypto}</p>
                      <p className="text-[13px] font-black text-white">{cryptoAmt(c.amount)}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* Integrity flags */}
          <section className="admin-panel p-4">
            <h2 className="mb-3 text-[12px] font-black uppercase tracking-wide text-slate-400">Integrity</h2>
            <div className="grid gap-3 sm:grid-cols-3">
              <Link href="/admin/users" className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-3 transition hover:border-[#087cff]/30">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-600">Negative balances</p>
                <p className={`mt-1 text-2xl font-black ${data.flags.negativeBalances > 0 ? "text-red-400" : "text-white"}`}>{data.flags.negativeBalances}</p>
                <p className="text-[10px] font-bold text-slate-600">should always be 0</p>
              </Link>
              <Link href="/admin/users" className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-3 transition hover:border-[#087cff]/30">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-600">Suspended users</p>
                <p className="mt-1 text-2xl font-black text-white">{data.flags.suspended}</p>
                <p className="text-[10px] font-bold text-slate-600">inactive accounts</p>
              </Link>
              <Link href="/admin/withdrawals" className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-3 transition hover:border-[#087cff]/30">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-600">Withdrawals to approve</p>
                <p className={`mt-1 text-2xl font-black ${data.flags.pendingWithdrawals.count > 0 ? "text-orange-400" : "text-white"}`}>{data.flags.pendingWithdrawals.count}</p>
                <p className="text-[10px] font-bold text-slate-600">{money(data.flags.pendingWithdrawals.amount)} held</p>
              </Link>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
