"use client";

import { useState, useEffect, useCallback } from "react";
import { Icon } from "@/components/icon";

interface PendingWithdrawal {
  id: string;
  amount: string;
  currency: string;
  createdAt: string;
  metadata: Record<string, unknown> | null;
  user: { id: string; email: string | null; username: string | null; phone: string | null };
}

function Spinner() {
  return <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/10 border-t-[#087cff]" />;
}

export function AdminWithdrawalsClient() {
  const [items, setItems]       = useState<PendingWithdrawal[]>([]);
  const [loading, setLoading]   = useState(true);
  const [acting, setActing]     = useState<string | null>(null);

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

  async function act(id: string, action: "approve" | "reject") {
    setActing(id);
    try {
      const res = await fetch(`/api/admin/withdrawals/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (res.ok) setItems((prev) => prev.filter((w) => w.id !== id));
    } finally {
      setActing(null);
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-white">Pending Withdrawals</h1>
          <p className="text-slate-600 text-xs mt-0.5">Large (&gt;1M) or high-frequency (&gt;10/day) withdrawals</p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-1.5 rounded-xl bg-white/[0.04] border border-white/[0.06] px-3 py-2 text-xs font-bold text-slate-500 hover:text-white hover:bg-white/[0.07] transition-colors"
        >
          <Icon name="refresh" className="text-[13px]" />
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 rounded-2xl border border-white/[0.06] bg-[#0f1623]">
          <Icon name="check_circle" fill className="text-[48px] text-emerald-500/40 mb-3" />
          <p className="text-slate-500 font-bold">No pending approvals</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((w) => {
            const meta = w.metadata ?? {};
            const msisdn  = meta.msisdn as string | undefined;
            const payout  = meta.payout as number | undefined;
            const fee     = meta.fee as number | undefined;
            const amount  = Number(w.amount);
            const isLarge = amount > 1_000_000;

            return (
              <div key={w.id} className="rounded-2xl border border-white/[0.06] bg-[#0f1623] p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${isLarge ? "bg-amber-500/12 text-amber-400" : "bg-sky-500/12 text-sky-400"}`}>
                        {isLarge ? "Large Amount" : "High Frequency"}
                      </span>
                    </div>
                    <p className="text-2xl font-black text-white">
                      KSh {amount.toLocaleString("en-KE", { minimumFractionDigits: 2 })}
                    </p>
                    {payout && fee && (
                      <p className="text-[11px] text-slate-600">
                        Payout: KSh {payout.toLocaleString()} · Fee: KSh {fee.toLocaleString()}
                      </p>
                    )}
                  </div>
                  <div className="text-right space-y-0.5">
                    <p className="text-[13px] font-bold text-white">{w.user.email ?? w.user.phone ?? "—"}</p>
                    {w.user.username && <p className="text-[11px] text-slate-600">@{w.user.username}</p>}
                    {msisdn && <p className="text-[11px] text-slate-600 font-mono">+{msisdn}</p>}
                    <p className="text-[10px] text-slate-700">{new Date(w.createdAt).toLocaleString()}</p>
                  </div>
                </div>

                <div className="mt-4 flex gap-3">
                  <button
                    onClick={() => act(w.id, "approve")}
                    disabled={acting === w.id}
                    className="flex-1 rounded-xl bg-emerald-500/10 py-2.5 text-sm font-black text-emerald-400 hover:bg-emerald-500/20 transition disabled:opacity-50"
                  >
                    {acting === w.id ? "…" : "Approve & Send"}
                  </button>
                  <button
                    onClick={() => act(w.id, "reject")}
                    disabled={acting === w.id}
                    className="flex-1 rounded-xl bg-red-500/10 py-2.5 text-sm font-black text-red-400 hover:bg-red-500/20 transition disabled:opacity-50"
                  >
                    {acting === w.id ? "…" : "Reject & Refund"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
