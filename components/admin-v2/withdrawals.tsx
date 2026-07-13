"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/icon";
import { CURRENCY_SYMBOL, MONEY_LOCALE } from "@/lib/currency";
import { TodayMoney } from "@/components/admin/today-money";

// Withdrawals & Approvals, restyled to the Stitch design. All endpoints and
// action logic are identical to the original client (financial-critical):
//   queue    -> GET  /api/admin/withdrawals
//   act      -> PATCH /api/admin/withdrawals/{id}  { action, txHash? }
//   history  -> GET  /api/admin/withdrawals/history?page=&pageSize=&status=

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

const STATUS_STYLES: Record<string, string> = {
  COMPLETED: "bg-emerald-500/12 text-emerald-400",
  PENDING: "bg-sky-500/12 text-sky-400",
  PENDING_APPROVAL: "bg-[#ffb786]/12 text-[#ffb786]",
  FAILED: "bg-red-500/12 text-red-400",
  CANCELLED: "bg-slate-500/12 text-slate-400",
};

function StatusBadge({ status }: { status: string }) {
  return <span className={`rounded px-2 py-1 text-[10px] font-bold ${STATUS_STYLES[status] ?? "bg-slate-500/12 text-slate-400"}`}>{status.replace(/_/g, " ")}</span>;
}

const HISTORY_FILTERS: { label: string; status?: string }[] = [
  { label: "All" },
  { label: "Completed", status: "COMPLETED" },
  { label: "Pending", status: "PENDING" },
  { label: "Failed", status: "FAILED" },
];
const PAGE_SIZE = 25;

function History() {
  const [items, setItems] = useState<PendingWithdrawal[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string | undefined>(undefined);

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

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);

  return (
    <div>
      <div className="av2-card mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg px-4 py-3">
        <div className="flex flex-wrap gap-1.5">
          {HISTORY_FILTERS.map((f) => (
            <button
              key={f.label}
              onClick={() => { setPage(1); setFilter(f.status); }}
              className={`rounded px-2.5 py-1 text-[10px] font-bold transition-colors ${filter === f.status ? "bg-[#3a4a5f] text-[#adc6ff]" : "text-[#c2c6d6] hover:text-[#e5e2e3]"}`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <button onClick={load} className="flex items-center gap-1.5 text-[10px] font-bold text-[#c2c6d6] transition-colors hover:text-[#e5e2e3]">
          <Icon name="refresh" size={13} /> Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><div className="h-6 w-6 animate-spin rounded-full border-2 border-white/10 border-t-[#adc6ff]" /></div>
      ) : items.length === 0 ? (
        <div className="av2-card flex min-h-[200px] flex-col items-center justify-center rounded-lg py-16">
          <p className="text-sm font-semibold text-[#e5e2e3]">No withdrawals found</p>
          <p className="mt-1 text-[11px] text-[#8c909f]">Nothing matches this filter yet.</p>
        </div>
      ) : (
        <div className="av2-card overflow-x-auto rounded-lg">
          <table className="av2-mono w-full min-w-[820px] text-left text-[13px]">
            <thead>
              <tr className="border-b border-[#27272a] bg-[#161618] text-[11px] uppercase tracking-wider text-[#c2c6d6]">
                <th className="px-4 py-3 font-semibold">When</th>
                <th className="px-4 py-3 font-semibold">User</th>
                <th className="px-4 py-3 text-right font-semibold">Amount</th>
                <th className="px-4 py-3 font-semibold">Destination</th>
                <th className="px-4 py-3 font-semibold">Provider</th>
                <th className="px-4 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#27272a]">
              {items.map((w) => {
                const meta = w.metadata ?? {};
                const msisdn = meta.msisdn as string | undefined;
                const address = meta.address as string | undefined;
                const dest = msisdn ? `+${msisdn}` : address ? `${address.slice(0, 10)}…${address.slice(-6)}` : "—";
                return (
                  <tr key={w.id} className="transition-colors hover:bg-[#1c1b1c]">
                    <td className="whitespace-nowrap px-4 py-3 text-[#c2c6d6]">{new Date(w.createdAt).toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <Link href={`/admin/users/${w.user.id}`} target="_blank" className="font-semibold text-[#e5e2e3] hover:text-[#adc6ff]">
                        {w.user.username ? `@${w.user.username}` : w.user.email ?? w.user.phone ?? "—"}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-[#e5e2e3]">{Number(w.amount).toLocaleString(MONEY_LOCALE, { minimumFractionDigits: 2 })} {w.currency}</td>
                    <td className="break-all px-4 py-3 text-[#c2c6d6]">{dest}</td>
                    <td className="px-4 py-3 text-[#8c909f]">{w.provider ?? "—"}</td>
                    <td className="px-4 py-3"><StatusBadge status={w.status} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!loading && total > 0 && (
        <div className="av2-card mt-3 flex items-center justify-between rounded-lg px-4 py-3">
          <p className="text-[11px] text-[#c2c6d6]">Showing <span className="font-semibold text-[#e5e2e3]">{from}–{to}</span> of <span className="font-semibold text-[#e5e2e3]">{total}</span></p>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="rounded px-2.5 py-1 text-[10px] font-bold text-[#c2c6d6] hover:text-[#e5e2e3] disabled:opacity-30">← Prev</button>
            <span className="text-[10px] font-bold text-[#8c909f]">{page} / {totalPages}</span>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="rounded px-2.5 py-1 text-[10px] font-bold text-[#c2c6d6] hover:text-[#e5e2e3] disabled:opacity-30">Next →</button>
          </div>
        </div>
      )}
    </div>
  );
}

export function AdminV2Withdrawals() {
  const [tab, setTab] = useState<"today" | "approvals" | "history">("approvals");
  const [items, setItems] = useState<PendingWithdrawal[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
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

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#ffb786]">Financial</p>
          <h2 className="mt-1 text-[32px] font-semibold tracking-[-0.02em] text-[#e5e2e3]">Withdrawals &amp; Approvals</h2>
          <p className="mt-1 max-w-2xl text-[13px] text-[#c2c6d6]">Review payouts awaiting approval, and monitor every withdrawal across the platform.</p>
        </div>
        {tab === "approvals" && (
          <button onClick={load} className="av2-card flex items-center gap-1.5 rounded-md px-3 py-2 text-[10px] font-bold text-[#c2c6d6] transition-colors hover:text-[#e5e2e3]">
            <Icon name="refresh" size={13} /> Refresh
          </button>
        )}
      </div>

      <div className="mb-6 flex gap-1 border-b border-[#424754]">
        {([["today", "Today"], ["approvals", "Approvals"], ["history", "History"]] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`-mb-px border-b-2 px-3 py-2 text-[13px] font-semibold transition-colors ${tab === key ? "border-[#adc6ff] text-[#adc6ff]" : "border-transparent text-[#c2c6d6] hover:text-[#e5e2e3]"}`}
          >
            {label}
            {key === "approvals" && items.length > 0 && <span className="ml-1.5 rounded bg-[#ffb786]/15 px-1.5 py-0.5 text-[9px] text-[#ffb786]">{items.length}</span>}
          </button>
        ))}
      </div>

      {tab === "today" ? (
        <TodayMoney />
      ) : tab === "history" ? (
        <History />
      ) : loading ? (
        <div className="flex justify-center py-16"><div className="h-6 w-6 animate-spin rounded-full border-2 border-white/10 border-t-[#adc6ff]" /></div>
      ) : items.length === 0 ? (
        <div className="av2-card flex min-h-[280px] flex-col items-center justify-center rounded-lg py-16">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-emerald-400/15 bg-emerald-400/[0.07]">
            <Icon name="verified" size={30} className="text-emerald-400" />
          </div>
          <p className="mt-5 text-sm font-semibold text-[#e5e2e3]">Approval queue is clear</p>
          <p className="mt-1 text-[11px] text-[#8c909f]">No withdrawals currently require owner review.</p>
        </div>
      ) : (
        <div>
          <div className="av2-card mb-3 flex items-center justify-between rounded-lg px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#c2c6d6]">Queue</p>
            <p className="av2-mono text-sm font-semibold text-[#ffb786]">{items.length} pending decision{items.length === 1 ? "" : "s"}</p>
          </div>
          <div className="space-y-2">
            {items.map((w) => {
              const meta = w.metadata ?? {};
              const amount = Number(w.amount);
              const isSell = w.provider === "crypto_sell";
              const msisdn = meta.msisdn as string | undefined;
              const payout = meta.payout as number | undefined;
              const fee = meta.fee as number | undefined;
              const isLarge = amount > 1_000_000;
              const sellCrypto = meta.crypto as string | undefined;
              const sellNetwork = meta.network as string | undefined;
              const sellAddress = meta.address as string | undefined;
              const sellAmount = meta.cryptoAmount as number | undefined;
              const sellFeeKes = meta.feeKes as number | undefined;

              return (
                <div key={w.id} className="av2-card overflow-hidden rounded-lg">
                  <div className="grid gap-4 p-4 lg:grid-cols-[1fr_auto]">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <span className={`inline-block rounded px-2 py-1 text-[10px] font-bold ${isSell ? "bg-[#adc6ff]/12 text-[#adc6ff]" : isLarge ? "bg-[#ffb786]/12 text-[#ffb786]" : "bg-sky-500/12 text-sky-400"}`}>
                          {isSell ? "Sell → Crypto" : isLarge ? "Large Amount" : "High Frequency"}
                        </span>
                        <p className="av2-mono text-2xl font-semibold text-[#e5e2e3]">{CURRENCY_SYMBOL} {amount.toLocaleString(MONEY_LOCALE, { minimumFractionDigits: 2 })}</p>
                        {isSell ? (
                          <div className="space-y-0.5">
                            <p className="text-[13px] font-semibold text-[#adc6ff]">Send ≈ {sellAmount} {sellCrypto} <span className="font-medium text-[#8c909f]">({sellNetwork})</span></p>
                            {sellFeeKes != null && <p className="text-[11px] text-[#8c909f]">Fee: {CURRENCY_SYMBOL} {sellFeeKes.toLocaleString()}</p>}
                            {sellAddress && <p className="av2-mono break-all text-[11px] text-[#c2c6d6]">{sellAddress}</p>}
                          </div>
                        ) : (
                          payout && fee && <p className="text-[11px] text-[#8c909f]">Payout: {CURRENCY_SYMBOL} {payout.toLocaleString()} · Fee: {CURRENCY_SYMBOL} {fee.toLocaleString()}</p>
                        )}
                      </div>
                      <div className="space-y-0.5 text-right">
                        <p className="text-[13px] font-semibold text-[#e5e2e3]">{w.user.email ?? w.user.phone ?? "—"}</p>
                        <div className="mt-0.5 flex items-center justify-end gap-1.5">
                          {w.user.username && <span className="text-[11px] text-[#8c909f]">@{w.user.username}</span>}
                          <Link href={`/admin/users/${w.user.id}`} target="_blank" className="inline-flex items-center gap-0.5 rounded bg-[#4d8eff]/12 px-1.5 py-0.5 text-[9px] font-bold text-[#adc6ff] ring-1 ring-[#4d8eff]/20 transition-colors hover:bg-[#4d8eff]/20">Inspect</Link>
                        </div>
                        {!isSell && msisdn && <p className="av2-mono text-[11px] text-[#8c909f]">+{msisdn}</p>}
                        <p className="text-[10px] text-[#8c909f]">{new Date(w.createdAt).toLocaleString()}</p>
                      </div>
                    </div>
                    <div className="min-w-[260px] lg:border-l lg:border-[#424754]/50 lg:pl-4">
                      {isSell && (
                        <input
                          type="text"
                          value={txHashes[w.id] ?? ""}
                          onChange={(e) => setTxHashes((prev) => ({ ...prev, [w.id]: e.target.value }))}
                          placeholder="On-chain tx hash (optional)"
                          className="av2-mono w-full rounded-md bg-[#0a0a0b] px-3 py-2.5 text-[12px] text-[#e5e2e3] outline-none ring-1 ring-[#424754] transition focus:ring-[#adc6ff]/40"
                        />
                      )}
                      <div className={`flex gap-2 ${isSell ? "mt-3" : ""}`}>
                        <button onClick={() => setConfirming({ id: w.id, action: "approve" })} disabled={acting === w.id} className="flex-1 rounded-md bg-emerald-500/10 py-2.5 text-[11px] font-bold text-emerald-400 transition hover:bg-emerald-500/20 disabled:opacity-50">
                          {acting === w.id ? "…" : isSell ? "Mark Sent" : "Approve & Send"}
                        </button>
                        <button onClick={() => setConfirming({ id: w.id, action: "reject" })} disabled={acting === w.id} className="flex-1 rounded-md bg-red-500/10 py-2.5 text-[11px] font-bold text-red-400 transition hover:bg-red-500/20 disabled:opacity-50">
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
            <div className="av2-card w-full max-w-md rounded-lg p-5 shadow-2xl">
              <p className={`text-[10px] font-bold uppercase tracking-[0.18em] ${isApproval ? "text-emerald-400" : "text-red-400"}`}>Confirm financial action</p>
              <h2 className="mt-2 text-lg font-semibold text-[#e5e2e3]">{isApproval ? (isCryptoSale ? "Mark crypto payout sent?" : "Approve and send payout?") : "Reject and refund payout?"}</h2>
              <p className="mt-3 text-sm leading-6 text-[#c2c6d6]">This will {isApproval ? "finalize the withdrawal" : "return funds to the customer wallet"} for <strong className="text-[#e5e2e3]">{CURRENCY_SYMBOL} {Number(withdrawal.amount).toLocaleString(MONEY_LOCALE, { minimumFractionDigits: 2 })}</strong>. Verify the account, destination, and payment evidence before continuing.</p>
              <div className="mt-5 flex gap-2">
                <button onClick={() => setConfirming(null)} className="flex-1 rounded-md border border-[#424754] px-3 py-2.5 text-[11px] font-bold text-[#c2c6d6] hover:bg-[#353436]">Cancel</button>
                <button
                  onClick={async () => { await act(withdrawal.id, confirming.action, isCryptoSale ? txHashes[withdrawal.id]?.trim() : undefined); setConfirming(null); }}
                  disabled={acting === withdrawal.id}
                  className={`flex-1 rounded-md px-3 py-2.5 text-[11px] font-bold text-white disabled:opacity-50 ${isApproval ? "bg-emerald-600 hover:bg-emerald-500" : "bg-red-600 hover:bg-red-500"}`}
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
