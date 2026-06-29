"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Icon } from "@/components/icon";
import { CURRENCY_SYMBOL, MONEY_LOCALE } from "@/lib/currency";

interface PendingWithdrawal {
  id: string;
  amount: string;
  currency: string;
  provider: string | null;
  status: string;
  reference: string | null;
  createdAt: string;
  metadata: Record<string, unknown> | null;
  user: { id: string; email: string | null; username: string | null; phone: string | null };
}

function Spinner() {
  return <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/10 border-t-[#087cff]" />;
}

const STATUS_STYLES: Record<string, string> = {
  COMPLETED:        "bg-emerald-500/12 text-emerald-400",
  PENDING:          "bg-sky-500/12 text-sky-400",
  PENDING_APPROVAL: "bg-amber-500/12 text-amber-400",
  FAILED:           "bg-red-500/12 text-red-400",
  CANCELLED:        "bg-slate-500/12 text-slate-400",
};

function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_STYLES[status] ?? "bg-slate-500/12 text-slate-400";
  return (
    <span className={`rounded-md px-2 py-1 text-[10px] font-black ${cls}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

const HISTORY_FILTERS: { label: string; status?: string }[] = [
  { label: "All" },
  { label: "Completed", status: "COMPLETED" },
  { label: "Pending",   status: "PENDING" },
  { label: "Failed",    status: "FAILED" },
];

const PAGE_SIZE = 25;

function WithdrawalsHistory() {
  const [items, setItems]     = useState<PendingWithdrawal[]>([]);
  const [total, setTotal]     = useState(0);
  const [page, setPage]       = useState(1);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState<string | undefined>(undefined);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
      if (filter) params.set("status", filter);
      const res = await fetch(`/api/admin/withdrawals/history?${params}`);
      if (res.ok) {
        const data = await res.json();
        setItems(data.rows ?? []);
        setTotal(data.total ?? 0);
      }
    } finally {
      setLoading(false);
    }
  }, [filter, page]);

  useEffect(() => { load(); }, [load]);

  // Reset to page 1 whenever the filter changes.
  function changeFilter(status: string | undefined) {
    setPage(1);
    setFilter(status);
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to   = Math.min(page * PAGE_SIZE, total);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border border-white/[0.07] bg-[#121419] px-4 py-3">
        <div className="flex flex-wrap gap-1.5">
          {HISTORY_FILTERS.map((f) => (
            <button
              key={f.label}
              onClick={() => changeFilter(f.status)}
              className={`rounded-md px-2.5 py-1 text-[10px] font-black transition-colors ${
                filter === f.status ? "bg-white/[0.1] text-white" : "text-slate-500 hover:text-white"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <button
          onClick={load}
          className="flex items-center gap-1.5 text-[10px] font-black text-slate-500 transition-colors hover:text-white"
        >
          <Icon name="refresh" className="text-[13px]" />
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : items.length === 0 ? (
        <div className="admin-panel flex min-h-[200px] flex-col items-center justify-center py-16">
          <p className="text-sm font-black text-slate-200">No withdrawals found</p>
          <p className="mt-1 text-[11px] text-slate-600">Nothing matches this filter yet.</p>
        </div>
      ) : (
        <div className="admin-panel overflow-x-auto">
          <table className="w-full min-w-[680px] text-left">
            <thead>
              <tr className="border-b border-white/[0.07] text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
                <th className="px-4 py-3">When</th>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3">Destination</th>
                <th className="px-4 py-3">Provider</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {items.map((w) => {
                const meta    = w.metadata ?? {};
                const msisdn  = meta.msisdn as string | undefined;
                const address = meta.address as string | undefined;
                const dest    = msisdn ? `+${msisdn}` : address ? `${address.slice(0, 10)}…${address.slice(-6)}` : "—";
                return (
                  <tr key={w.id} className="border-b border-white/[0.04] text-[12px] hover:bg-white/[0.02]">
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{new Date(w.createdAt).toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <Link href={`/admin/users/${w.user.id}`} target="_blank" className="font-bold text-slate-200 hover:text-blue-300">
                        {w.user.username ? `@${w.user.username}` : w.user.email ?? w.user.phone ?? "—"}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-black text-white whitespace-nowrap">
                      {Number(w.amount).toLocaleString(MONEY_LOCALE, { minimumFractionDigits: 2 })} {w.currency}
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-400 break-all">{dest}</td>
                    <td className="px-4 py-3 text-slate-500">{w.provider ?? "—"}</td>
                    <td className="px-4 py-3"><StatusBadge status={w.status} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!loading && total > 0 && (
        <div className="mt-3 flex items-center justify-between border border-white/[0.07] bg-[#121419] px-4 py-3">
          <p className="text-[11px] text-slate-500">
            Showing <span className="font-black text-slate-300">{from}–{to}</span> of <span className="font-black text-slate-300">{total}</span>
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="rounded-md px-2.5 py-1 text-[10px] font-black text-slate-400 transition-colors hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
            >
              ← Prev
            </button>
            <span className="text-[10px] font-black text-slate-500">{page} / {totalPages}</span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="rounded-md px-2.5 py-1 text-[10px] font-black text-slate-400 transition-colors hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function AdminWithdrawalsClient() {
  const [tab, setTab] = useState<"approvals" | "history">("approvals");
  const [items, setItems]       = useState<PendingWithdrawal[]>([]);
  const [loading, setLoading]   = useState(true);
  const [acting, setActing]     = useState<string | null>(null);
  const [txHashes, setTxHashes] = useState<Record<string, string>>({});
  const [confirming, setConfirming] = useState<{ id: string; action: "approve" | "reject" } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/withdrawals");
      if (res.ok) setItems(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function act(id: string, action: "approve" | "reject", txHash?: string) {
    setActing(id);
    try {
      const res = await fetch(`/api/admin/withdrawals/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...(txHash ? { txHash } : {}) }),
      });
      if (res.ok) setItems((prev) => prev.filter((w) => w.id !== id));
    } finally {
      setActing(null);
    }
  }

  function requestAction(id: string, action: "approve" | "reject") {
    setConfirming({ id, action });
  }

  return (
    <div className="admin-page">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-400">Financial</p>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-white">Withdrawals</h1>
          <p className="mt-1 max-w-2xl text-[11px] text-slate-500">Review payouts awaiting approval, and monitor every withdrawal across the platform.</p>
        </div>
        {tab === "approvals" && (
          <button
            onClick={load}
            className="admin-panel-soft flex items-center gap-1.5 px-3 py-2 text-[10px] font-black text-slate-500 transition-colors hover:text-white"
          >
            <Icon name="refresh" className="text-[13px]" />
            Refresh
          </button>
        )}
      </div>

      <div className="mb-4 flex gap-1 border-b border-white/[0.07]">
        {([["approvals", "Approvals"], ["history", "History"]] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`-mb-px border-b-2 px-3 py-2 text-[11px] font-black transition-colors ${
              tab === key ? "border-[#087cff] text-white" : "border-transparent text-slate-500 hover:text-white"
            }`}
          >
            {label}
            {key === "approvals" && items.length > 0 && (
              <span className="ml-1.5 rounded bg-amber-500/15 px-1.5 py-0.5 text-[9px] text-amber-300">{items.length}</span>
            )}
          </button>
        ))}
      </div>

      {tab === "history" ? <WithdrawalsHistory /> : loading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : items.length === 0 ? (
        <div className="admin-panel relative flex min-h-[280px] flex-col items-center justify-center overflow-hidden py-16">
          <div className="relative flex h-12 w-12 items-center justify-center rounded-lg border border-emerald-400/15 bg-emerald-400/[0.07]">
            <Icon name="verified" fill className="text-[30px] text-emerald-400" />
          </div>
          <p className="relative mt-5 text-sm font-black text-slate-200">Approval queue is clear</p>
          <p className="relative mt-1 text-[11px] text-slate-600">No withdrawals currently require owner review.</p>
        </div>
      ) : (
        <div>
          <div className="mb-3 flex items-center justify-between border border-white/[0.07] bg-[#121419] px-4 py-3">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Queue</p>
            <p className="font-mono text-sm font-black text-amber-300">{items.length} pending decision{items.length === 1 ? "" : "s"}</p>
          </div>
          <div className="space-y-2">
          {items.map((w) => {
            const meta = w.metadata ?? {};
            const amount  = Number(w.amount);
            const isSell  = w.provider === "crypto_sell";

            const msisdn  = meta.msisdn as string | undefined;
            const payout  = meta.payout as number | undefined;
            const fee     = meta.fee as number | undefined;
            const isLarge = amount > 1_000_000;

            // crypto sell fields
            const sellCrypto  = meta.crypto as string | undefined;
            const sellNetwork = meta.network as string | undefined;
            const sellAddress = meta.address as string | undefined;
            const sellAmount  = meta.cryptoAmount as number | undefined;
            const sellFeeKes  = meta.feeKes as number | undefined;

            return (
              <div key={w.id} className="admin-panel overflow-hidden">
                <div className="grid gap-4 p-4 lg:grid-cols-[1fr_auto]">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={`rounded-md px-2 py-1 text-[10px] font-black ${
                        isSell ? "bg-violet-500/12 text-violet-400" : isLarge ? "bg-amber-500/12 text-amber-400" : "bg-sky-500/12 text-sky-400"
                      }`}>
                        {isSell ? "Sell → Crypto" : isLarge ? "Large Amount" : "High Frequency"}
                      </span>
                    </div>
                    <p className="text-2xl font-black text-white">
                      {CURRENCY_SYMBOL} {amount.toLocaleString(MONEY_LOCALE, { minimumFractionDigits: 2 })}
                    </p>
                    {isSell ? (
                      <div className="space-y-0.5">
                        <p className="text-[13px] font-black text-violet-300">
                          Send ≈ {sellAmount} {sellCrypto} <span className="text-slate-600 font-bold">({sellNetwork})</span>
                        </p>
                        {sellFeeKes != null && (
                          <p className="text-[11px] text-slate-600">Fee: {CURRENCY_SYMBOL} {sellFeeKes.toLocaleString()}</p>
                        )}
                        {sellAddress && (
                          <p className="text-[11px] text-slate-500 font-mono break-all">{sellAddress}</p>
                        )}
                      </div>
                    ) : (
                      payout && fee && (
                        <p className="text-[11px] text-slate-600">
                          Payout: {CURRENCY_SYMBOL} {payout.toLocaleString()} · Fee: {CURRENCY_SYMBOL} {fee.toLocaleString()}
                        </p>
                      )
                    )}
                  </div>
                   <div className="text-right space-y-0.5">
                     <p className="text-[13px] font-bold text-white">{w.user.email ?? w.user.phone ?? "—"}</p>
                     <div className="flex items-center justify-end gap-1.5 mt-0.5">
                       {w.user.username && <span className="text-[11px] text-slate-600">@{w.user.username}</span>}
                       <Link
                         href={`/admin/users/${w.user.id}`}
                         target="_blank"
                         className="inline-flex items-center gap-0.5 rounded bg-blue-500/12 px-1.5 py-0.5 text-[9px] font-black text-blue-300 ring-1 ring-blue-500/20 hover:bg-blue-500/20 transition-colors"
                       >
                         Inspect
                       </Link>
                     </div>
                     {!isSell && msisdn && <p className="text-[11px] text-slate-600 font-mono">+{msisdn}</p>}
                     <p className="text-[10px] text-slate-700">{new Date(w.createdAt).toLocaleString()}</p>
                   </div>
                </div>

                <div className="min-w-[260px] lg:border-l lg:border-white/[0.06] lg:pl-4">
                {isSell && (
                  <input
                    type="text"
                    value={txHashes[w.id] ?? ""}
                    onChange={(e) => setTxHashes((prev) => ({ ...prev, [w.id]: e.target.value }))}
                    placeholder="On-chain tx hash (optional)"
                    className="w-full rounded-md bg-white/[0.03] px-3 py-2.5 font-mono text-[12px] text-white outline-none ring-1 ring-white/[0.08] transition focus:ring-violet-500/40 placeholder:font-sans placeholder:text-slate-600"
                  />
                )}

                <div className={`flex gap-2 ${isSell ? "mt-3" : ""}`}>
                  <button
                    onClick={() => requestAction(w.id, "approve")}
                    disabled={acting === w.id}
                    className="flex-1 rounded-md bg-emerald-500/10 py-2.5 text-[11px] font-black text-emerald-400 hover:bg-emerald-500/20 transition disabled:opacity-50"
                  >
                    {acting === w.id ? "…" : isSell ? "Mark Sent" : "Approve & Send"}
                  </button>
                  <button
                    onClick={() => requestAction(w.id, "reject")}
                    disabled={acting === w.id}
                    className="flex-1 rounded-md bg-red-500/10 py-2.5 text-[11px] font-black text-red-400 hover:bg-red-500/20 transition disabled:opacity-50"
                  >
                    {acting === w.id ? "…" : "Reject & Refund"}
                  </button>
                </div>
                </div>
                </div>
              </div>
            );
          })}
          </div>
        </div>
      )}

      {confirming && (() => {
        const withdrawal = items.find((item) => item.id === confirming.id);
        if (!withdrawal) return null;
        const isApproval = confirming.action === "approve";
        const isCryptoSale = withdrawal.provider === "crypto_sell";
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md border border-white/[0.1] bg-[#121419] p-5 shadow-2xl">
              <p className={`text-[10px] font-black uppercase tracking-[0.18em] ${isApproval ? "text-emerald-400" : "text-red-400"}`}>Confirm financial action</p>
              <h2 className="mt-2 text-lg font-black text-white">{isApproval ? (isCryptoSale ? "Mark crypto payout sent?" : "Approve and send payout?") : "Reject and refund payout?"}</h2>
              <p className="mt-3 text-sm leading-6 text-slate-400">This will {isApproval ? "finalize the withdrawal" : "return funds to the customer wallet"} for <strong className="text-white">{CURRENCY_SYMBOL} {Number(withdrawal.amount).toLocaleString(MONEY_LOCALE, { minimumFractionDigits: 2 })}</strong>. Verify the account, destination, and payment evidence before continuing.</p>
              <div className="mt-5 flex gap-2">
                <button onClick={() => setConfirming(null)} className="flex-1 rounded-md border border-white/[0.1] px-3 py-2.5 text-[11px] font-black text-slate-300 hover:bg-white/[0.05]">Cancel</button>
                <button
                  onClick={async () => {
                    await act(withdrawal.id, confirming.action, isCryptoSale ? txHashes[withdrawal.id]?.trim() : undefined);
                    setConfirming(null);
                  }}
                  disabled={acting === withdrawal.id}
                  className={`flex-1 rounded-md px-3 py-2.5 text-[11px] font-black text-white disabled:opacity-50 ${isApproval ? "bg-emerald-600 hover:bg-emerald-500" : "bg-red-600 hover:bg-red-500"}`}
                >
                  {acting === withdrawal.id ? "Processing..." : isApproval ? "Confirm approval" : "Confirm refund"}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
