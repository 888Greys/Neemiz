"use client";

import { useCallback, useEffect, useState } from "react";
import { Icon } from "@/components/icon";
import { CURRENCY_SYMBOL, MONEY_LOCALE } from "@/lib/currency";

// Compact "today's money" ledger for the owner: 3 summary cards, type filter,
// paginated rows. Shared by both admin shells.

type Bucket = { count: number; total: number };
type MoneyType = "ALL" | "DEPOSIT" | "WITHDRAWAL";

interface TodayRow {
  id: string; type: string; amount: number; amountKes?: number; currency?: string;
  status: string; provider: string | null; reference: string | null;
  phone: string | null; username: string | null; createdAt: string;
}
interface TodayData {
  range: "today" | "7d";
  type: MoneyType;
  deposits: Record<string, Bucket>;
  withdrawals: Record<string, Bucket>;
  net: number;
  page: number;
  pageSize: number;
  total: number;
  rows: TodayRow[];
}

const PAGE_SIZE = 20;

const RAIL_LABEL: Record<string, string> = {
  lipaharaka: "Lipa Haraka",
  megapay: "MegaPay",
  pesapal: "Pesapal",
  relworx: "Relworx",
  crypto: "Crypto in",
  self_custody: "Crypto out",
  crypto_sell: "Crypto sell",
};

const kes = (n: number) =>
  `${CURRENCY_SYMBOL} ${Number(n).toLocaleString(MONEY_LOCALE, { maximumFractionDigits: 0 })}`;

function formatAmount(r: TodayRow) {
  const code = (r.currency || "KES").toUpperCase();
  const decimals = code === "KES" ? 0 : code === "BTC" ? 8 : 2;
  return `${Number(r.amount).toLocaleString(MONEY_LOCALE, { maximumFractionDigits: decimals })} ${code}`;
}

function shortRef(ref: string | null) {
  if (!ref) return "—";
  if (ref.length <= 18) return ref;
  return `${ref.slice(0, 10)}…${ref.slice(-6)}`;
}

const STATUS_STYLES: Record<string, string> = {
  COMPLETED: "bg-emerald-500/12 text-emerald-400",
  PENDING: "bg-sky-500/12 text-sky-400",
  PENDING_APPROVAL: "bg-amber-500/12 text-amber-400",
  FAILED: "bg-red-500/12 text-red-400",
  CANCELLED: "bg-slate-500/12 text-slate-400",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`rounded px-2 py-0.5 text-[10px] font-bold ${STATUS_STYLES[status] ?? "bg-slate-500/12 text-slate-400"}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

function SummaryCard({
  label, amount, count, tone, hint,
}: { label: string; amount: number; count: number; tone: string; hint: string }) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 py-3.5">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <p className={`mt-1.5 text-[26px] font-semibold tracking-tight ${tone}`}>{kes(amount)}</p>
      <p className="mt-1 text-[12px] text-slate-500">{count.toLocaleString()} {hint}</p>
    </div>
  );
}

export function TodayMoney({ defaultType = "ALL" }: { defaultType?: MoneyType } = {}) {
  const [data, setData] = useState<TodayData | null>(null);
  const [range, setRange] = useState<"today" | "7d">("today");
  const [type, setType] = useState<MoneyType>(defaultType);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        range,
        type,
        page: String(page),
        pageSize: String(PAGE_SIZE),
      });
      const res = await fetch(`/api/admin/money/today?${params}`);
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, [range, type, page]);

  useEffect(() => { load(); }, [load]);

  const dep = data?.deposits ?? {};
  const wd = data?.withdrawals ?? {};
  const b = (m: Record<string, Bucket>, s: string): Bucket => m[s] ?? { count: 0, total: 0 };
  const depPaid = b(dep, "COMPLETED");
  const wdPaid = b(wd, "COMPLETED");
  const pendingOut = {
    count: b(wd, "PENDING").count + b(wd, "PENDING_APPROVAL").count,
    total: b(wd, "PENDING").total + b(wd, "PENDING_APPROVAL").total,
  };
  const failedIn = b(dep, "FAILED");

  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);

  function setTypeAndReset(next: MoneyType) {
    setPage(1);
    setType(next);
  }

  function setRangeAndReset(next: "today" | "7d") {
    setPage(1);
    setRange(next);
  }

  return (
    <div className="space-y-5">
      {/* 3 clear numbers — not 6 competing tiles */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SummaryCard
          label="Money in"
          amount={depPaid.total}
          count={depPaid.count}
          tone="text-emerald-400"
          hint={`deposits paid${failedIn.count ? ` · ${failedIn.count} failed` : ""}`}
        />
        <SummaryCard
          label="Money out"
          amount={wdPaid.total}
          count={wdPaid.count}
          tone="text-[#ffb786]"
          hint={`payouts done${pendingOut.count ? ` · ${pendingOut.count} pending` : ""}`}
        />
        <SummaryCard
          label="Net"
          amount={data?.net ?? 0}
          count={depPaid.count + wdPaid.count}
          tone={(data?.net ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"}
          hint="completed in − out"
        />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1 rounded-lg bg-white/[0.04] p-1">
            {([["today", "Today"], ["7d", "7 days"]] as const).map(([k, l]) => (
              <button
                key={k}
                onClick={() => setRangeAndReset(k)}
                className={`rounded-md px-3 py-1.5 text-[11px] font-bold transition ${range === k ? "bg-white/[0.1] text-white" : "text-slate-500 hover:text-white"}`}
              >
                {l}
              </button>
            ))}
          </div>
          <div className="flex gap-1 rounded-lg bg-white/[0.04] p-1">
            {([["ALL", "All"], ["DEPOSIT", "Deposits"], ["WITHDRAWAL", "Withdrawals"]] as const).map(([k, l]) => (
              <button
                key={k}
                onClick={() => setTypeAndReset(k)}
                className={`rounded-md px-3 py-1.5 text-[11px] font-bold transition ${type === k ? "bg-white/[0.1] text-white" : "text-slate-500 hover:text-white"}`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-1.5 rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-[10px] font-bold text-slate-500 transition-colors hover:text-white"
        >
          <Icon name="refresh" className="text-[13px]" /> Refresh
        </button>
      </div>

      {loading && !data ? (
        <div className="flex justify-center py-16">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/10 border-t-[#087cff]" />
        </div>
      ) : (
        <>
          <div className="overflow-hidden rounded-xl border border-white/[0.07]">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-[13px]">
                <thead className="border-b border-white/[0.07] bg-white/[0.02] text-[11px] uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-semibold">When</th>
                    <th className="px-4 py-3 font-semibold">Type</th>
                    <th className="px-4 py-3 font-semibold">Rail</th>
                    <th className="px-4 py-3 font-semibold">User</th>
                    <th className="px-4 py-3 text-right font-semibold">Amount</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Ref</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.05]">
                  {(data?.rows ?? []).length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center text-[13px] text-slate-500">
                        No {type === "DEPOSIT" ? "deposits" : type === "WITHDRAWAL" ? "withdrawals" : "transactions"}{" "}
                        {range === "today" ? "today" : "in the last 7 days"}.
                      </td>
                    </tr>
                  ) : (
                    (data?.rows ?? []).map((r) => (
                      <tr key={r.id} className="hover:bg-white/[0.02]">
                        <td className="whitespace-nowrap px-4 py-3.5 text-slate-400">
                          {new Date(r.createdAt).toLocaleString("en-KE", { dateStyle: "short", timeStyle: "short" })}
                        </td>
                        <td className="px-4 py-3.5">
                          <span className={`font-semibold ${r.type === "DEPOSIT" ? "text-emerald-400" : "text-[#ffb786]"}`}>
                            {r.type === "DEPOSIT" ? "Deposit" : "Withdrawal"}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-slate-300">
                          {RAIL_LABEL[r.provider ?? ""] ?? r.provider ?? "—"}
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="font-medium text-slate-200">
                            {r.username ? `@${r.username}` : r.phone ?? "—"}
                          </div>
                          {r.username && r.phone ? (
                            <div className="mt-0.5 text-[11px] text-slate-500">{r.phone}</div>
                          ) : null}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3.5 text-right font-semibold text-white">
                          {formatAmount(r)}
                        </td>
                        <td className="px-4 py-3.5"><StatusBadge status={r.status} /></td>
                        <td className="px-4 py-3.5 font-mono text-[11px] text-slate-500" title={r.reference ?? undefined}>
                          {shortRef(r.reference)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {total > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-3">
              <p className="text-[12px] text-slate-500">
                Showing <span className="font-semibold text-slate-200">{from}–{to}</span> of{" "}
                <span className="font-semibold text-slate-200">{total}</span>
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1 || loading}
                  className="rounded-md px-3 py-1.5 text-[11px] font-bold text-slate-400 hover:text-white disabled:opacity-30"
                >
                  ← Prev
                </button>
                <span className="text-[11px] font-bold text-slate-500">{page} / {totalPages}</span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages || loading}
                  className="rounded-md px-3 py-1.5 text-[11px] font-bold text-slate-400 hover:text-white disabled:opacity-30"
                >
                  Next →
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
