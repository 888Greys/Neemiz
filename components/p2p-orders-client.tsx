"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Icon } from "@/components/icon";
import { P2PSubNav } from "@/components/p2p-subnav";

// ─── Types ────────────────────────────────────────────────────────────────────

type OrderStatus = "PENDING" | "PAID" | "RELEASED" | "DISPUTED" | "CANCELLED" | "EXPIRED";

type FilterTab = "all" | "pending" | "completed" | "cancelled";

interface OrderSummary {
  id: string;
  status: OrderStatus;
  crypto: string;
  cryptoAmount: number;
  fiatAmount: number;
  fiat: string;
  isBuyer: boolean;
  counterparty: string;
  createdAt: string;
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: OrderStatus }) {
  const map: Record<OrderStatus, { label: string; color: string }> = {
    PENDING:   { label: "Pending",    color: "text-amber-400 bg-amber-500/10 border-amber-500/20" },
    PAID:      { label: "Paid",       color: "text-[#087cff] bg-[#087cff]/10 border-[#087cff]/20" },
    RELEASED:  { label: "Completed",  color: "text-[#31c45d] bg-[#31c45d]/10 border-[#31c45d]/20" },
    DISPUTED:  { label: "Disputed",   color: "text-red-400 bg-red-500/10 border-red-500/20" },
    CANCELLED: { label: "Cancelled",  color: "text-slate-400 bg-white/5 border-white/10" },
    EXPIRED:   { label: "Expired",    color: "text-slate-500 bg-white/5 border-white/10" },
  };
  const { label, color } = map[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[10px] font-black whitespace-nowrap ${color}`}>
      {status === "PENDING" && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />}
      {label}
    </span>
  );
}

// ─── Filter Tab Button ────────────────────────────────────────────────────────

function FilterButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${
        active
          ? "bg-[#087cff] text-white shadow-[0_2px_12px_rgba(8,124,255,.3)]"
          : "bg-white/5 text-slate-500 hover:text-slate-300 hover:bg-white/[0.08]"
      }`}
    >
      {label}
    </button>
  );
}

// ─── Main P2P Orders Client ───────────────────────────────────────────────────

export function P2POrdersClient() {
  const [orders, setOrders]   = useState<OrderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState<FilterTab>("all");

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 12000);
    try {
      const res = await fetch("/api/p2p/orders", { signal: controller.signal });
      if (res.ok) {
        const data = await res.json();
        setOrders(Array.isArray(data) ? data : []);
      }
    } catch { /* ignore */ } finally {
      window.clearTimeout(timeout);
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const filtered = orders.filter((o) => {
    if (filter === "all")       return true;
    if (filter === "pending")   return o.status === "PENDING" || o.status === "PAID";
    if (filter === "completed") return o.status === "RELEASED";
    if (filter === "cancelled") return o.status === "CANCELLED" || o.status === "EXPIRED" || o.status === "DISPUTED";
    return true;
  });

  const tabCounts = {
    all:       orders.length,
    pending:   orders.filter((o) => o.status === "PENDING" || o.status === "PAID").length,
    completed: orders.filter((o) => o.status === "RELEASED").length,
    cancelled: orders.filter((o) => ["CANCELLED", "EXPIRED", "DISPUTED"].includes(o.status)).length,
  };

  return (
    <>
      <P2PSubNav />
    <div className="mx-auto w-full max-w-6xl px-4 py-5 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-2xl font-black text-white mb-1">My P2P Orders</h1>
        <p className="text-slate-500 text-sm">Track all your buy and sell orders.</p>
      </div>

      {/* Filter tabs */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {([
          { id: "all" as FilterTab,       label: `All (${tabCounts.all})` },
          { id: "pending" as FilterTab,   label: `Pending (${tabCounts.pending})` },
          { id: "completed" as FilterTab, label: `Completed (${tabCounts.completed})` },
          { id: "cancelled" as FilterTab, label: `Cancelled / Disputed (${tabCounts.cancelled})` },
        ] as const).map(({ id, label }) => (
          <FilterButton key={id} active={filter === id} label={label} onClick={() => setFilter(id)} />
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-[88px] rounded-2xl bg-white/5 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex min-h-[190px] flex-col items-center justify-center rounded-2xl border border-white/[0.06] bg-[#070a10] px-6 py-8 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04]">
            <Icon name="receipt_long" className="text-xl text-slate-500" />
          </div>
          <p className="mb-1 text-base font-black text-white">No orders yet</p>
          <p className="mb-4 max-w-sm text-sm leading-6 text-slate-500">
            {filter === "all"
              ? "You haven't placed any P2P orders yet."
              : `No ${filter} orders found.`}
          </p>
          {filter === "all" && (
            <Link
              href="/p2p"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#087cff] text-white font-black text-sm hover:bg-[#0570e8] transition-colors"
            >
              <Icon name="swap_horiz" className="text-base" />
              Browse P2P Ads
            </Link>
          )}
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {filtered.map((order) => (
            <div
              key={order.id}
              className="rounded-2xl border border-white/[0.06] bg-[#0f1623] px-4 py-4 transition-colors hover:border-white/[0.1]"
            >
              <div className="flex flex-col gap-4">
                {/* Left: status + crypto */}
                <div className="flex min-w-0 items-center gap-3">
                  <div className={`w-9 h-9 shrink-0 rounded-xl flex items-center justify-center ${
                    order.isBuyer ? "bg-[#31c45d]/10" : "bg-red-500/10"
                  }`}>
                    <Icon
                      name={order.isBuyer ? "arrow_downward" : "arrow_upward"}
                      className={`text-base ${order.isBuyer ? "text-[#31c45d]" : "text-red-400"}`}
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <span className="text-white font-black text-sm">
                        {order.isBuyer ? "Buy" : "Sell"} {order.crypto}
                      </span>
                      <StatusBadge status={order.status} />
                    </div>
                    <p className="text-slate-500 text-xs font-mono">#{order.id.slice(0, 12).toUpperCase()}</p>
                  </div>
                </div>

                {/* Middle: amounts + counterparty */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div>
                    <p className="text-slate-600 text-xs mb-0.5">Amount</p>
                    <p className="text-white font-black text-sm">{Number(order.cryptoAmount).toFixed(6)} {order.crypto}</p>
                  </div>
                  <div>
                    <p className="text-slate-600 text-xs mb-0.5">You {order.isBuyer ? "paid" : "received"}</p>
                    <p className="text-[#31c45d] font-black text-sm">KSh {Number(order.fiatAmount).toLocaleString("en-KE")}</p>
                  </div>
                  <div>
                    <p className="text-slate-600 text-xs mb-0.5">{order.isBuyer ? "Merchant" : "Buyer"}</p>
                    <p className="text-slate-300 font-bold text-sm">{order.counterparty}</p>
                  </div>
                  <div>
                    <p className="text-slate-600 text-xs mb-0.5">Date</p>
                    <p className="text-slate-400 text-xs whitespace-nowrap">
                      {new Date(order.createdAt).toLocaleDateString("en-KE", { day: "2-digit", month: "short", year: "numeric" })}
                    </p>
                  </div>
                </div>

                {/* Right: View link */}
                <Link
                  href={`/p2p/order/${order.id}`}
                  className="flex items-center justify-center gap-1.5 rounded-xl bg-white/5 px-3.5 py-2 text-xs font-black text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
                >
                  View Order
                  <Icon name="arrow_forward" className="text-[13px]" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
    </>
  );
}
