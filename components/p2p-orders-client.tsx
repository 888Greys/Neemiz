"use client";

import { useState, useEffect, useCallback } from "react";
import { getCached, cachedFetch } from "@/lib/client-cache";
import Link from "next/link";
import { Icon } from "@/components/icon";
import { P2PSubNav } from "@/components/p2p-subnav";
import { formatFiat } from "@/lib/p2p/currencies";
import { P2PStatusBadge } from "@/components/p2p/status-badge";

// ─── Types ────────────────────────────────────────────────────────────────────

type OrderStatus = "PENDING" | "PAID" | "RELEASED" | "DISPUTED" | "CANCELLED" | "EXPIRED";

type FilterTab = "all" | "pending" | "completed" | "cancelled" | "expired";

interface OrderSummary {
  id: string;
  status: OrderStatus;
  crypto: string;
  cryptoAmount: number;
  fiatAmount: number;
  pricePerUnit: number;
  fiat: string;
  isBuyer: boolean;
  counterparty: string;
  createdAt: string;
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

// ─── Filter Tab Button ────────────────────────────────────────────────────────

function FilterButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg px-3 py-2 text-xs font-black transition-all lg:h-8 lg:px-3 lg:py-0 ${
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

const ORDERS_KEY = "/api/p2p/orders";

export function P2POrdersClient() {
  const [orders, setOrders]   = useState<OrderSummary[]>(() => getCached<OrderSummary[]>(ORDERS_KEY) ?? []);
  const [loading, setLoading] = useState(!getCached(ORDERS_KEY));
  const [filter, setFilter]   = useState<FilterTab>("all");

  const fetchOrders = useCallback(async (force = false) => {
    if (!orders.length) setLoading(true);
    const data = await cachedFetch<OrderSummary[]>(ORDERS_KEY, force);
    if (data) setOrders(data);
    setLoading(false);
  }, [orders.length]);

  useEffect(() => { fetchOrders(true); }, [fetchOrders]);

  const filtered = orders.filter((o) => {
    if (filter === "all")       return true;
    if (filter === "pending")   return o.status === "PENDING" || o.status === "PAID";
    if (filter === "completed") return o.status === "RELEASED";
    if (filter === "cancelled") return o.status === "CANCELLED" || o.status === "DISPUTED";
    if (filter === "expired")   return o.status === "EXPIRED";
    return true;
  });

  const tabCounts = {
    all:       orders.length,
    pending:   orders.filter((o) => o.status === "PENDING" || o.status === "PAID").length,
    completed: orders.filter((o) => o.status === "RELEASED").length,
    cancelled: orders.filter((o) => ["CANCELLED", "DISPUTED"].includes(o.status)).length,
    expired:   orders.filter((o) => o.status === "EXPIRED").length,
  };

  return (
    <>
      <P2PSubNav />
    <div className="w-full px-3 py-3 sm:px-4 lg:px-3 lg:py-2">
      {/* Header */}
      <div className="mb-3 lg:mb-2">
        <h1 className="mb-0.5 text-lg font-black text-white lg:text-base">My P2P Orders</h1>
        <p className="text-xs text-slate-500">Track all your buy and sell orders.</p>
      </div>

      {/* Filter tabs */}
      <div className="mb-3 flex flex-wrap items-center gap-2 lg:mb-2">
        {([
          { id: "all" as FilterTab,       label: `All (${tabCounts.all})` },
          { id: "pending" as FilterTab,   label: `Pending (${tabCounts.pending})` },
          { id: "completed" as FilterTab, label: `Completed (${tabCounts.completed})` },
          { id: "cancelled" as FilterTab, label: `Cancelled (${tabCounts.cancelled})` },
          ...(tabCounts.expired > 0 ? [{ id: "expired" as FilterTab, label: `Expired (${tabCounts.expired})` }] : []),
        ] as const).map(({ id, label }) => (
          <FilterButton key={id} active={filter === id} label={label} onClick={() => setFilter(id)} />
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-[88px] rounded-2xl bg-white/5 animate-pulse lg:h-[58px] lg:rounded-lg" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex min-h-[190px] flex-col items-center justify-center rounded-2xl border border-[#1e1e30] bg-[#0e0e14] px-6 py-8 text-center">
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
        <div className="flex flex-col gap-1.5">
          {filtered.map((order) => (
            <Link
              key={order.id}
              href={`/p2p/order/${order.id}`}
              className="group block rounded-lg border border-[#1e1e30] bg-[#0e0e14] px-3 py-2.5 transition hover:bg-[#111118] lg:grid lg:grid-cols-[minmax(190px,1fr)_150px_minmax(360px,1.5fr)_240px] lg:items-center lg:gap-4 lg:px-3 lg:py-2"
            >
              {/* Row 1: type + status + chevron */}
              <div className="mb-2 flex items-center justify-between gap-2 lg:mb-0">
                <div className="flex min-w-0 items-center gap-2">
                  <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                    order.isBuyer ? "bg-[#05b957]/15" : "bg-red-500/15"
                  }`}>
                    <Icon name={order.isBuyer ? "arrow_downward" : "arrow_upward"} className={`text-[11px] ${order.isBuyer ? "text-[#05b957]" : "text-red-400"}`} />
                  </div>
                  <span className="text-[13px] font-black text-white">{order.isBuyer ? "Buy" : "Sell"} {order.crypto}</span>
                  <P2PStatusBadge status={order.status} />
                </div>
                <Icon name="chevron_right" className="shrink-0 text-[20px] text-white/25 transition group-hover:text-white/50 lg:hidden" />
              </div>

              {/* Amount */}
              <div className="mb-2 lg:mb-0">
                <p className="text-[10px] font-semibold text-white/40">{order.fiat}</p>
                <p className="text-[17px] font-black leading-tight text-white tabular-nums lg:text-base">
                  {formatFiat(Number(order.fiatAmount), order.fiat, { symbol: false, decimals: 2 })}
                </p>
              </div>

              {/* Detail rows */}
              <div className="mb-2 space-y-1 lg:mb-0 lg:grid lg:grid-cols-3 lg:gap-3 lg:space-y-0">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-white/40">Price</span>
                  <span className="font-semibold text-white/70">{formatFiat(Number(order.pricePerUnit), order.fiat)}</span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-white/40">Qty</span>
                  <span className="font-semibold text-white/70">{Number(order.cryptoAmount).toFixed(4)} {order.crypto}</span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-white/40">Order No.</span>
                  <span className="flex items-center gap-1 font-mono font-semibold text-white/70">
                    {order.id.slice(0, 16).toUpperCase()}
                    <Icon name="content_copy" className="text-[11px] text-white/25" />
                  </span>
                </div>
              </div>

              {/* Footer: merchant chip + date */}
              <div className="flex items-center justify-between border-t border-white/[0.05] pt-2.5 lg:border-t-0 lg:pt-0">
                <span className="flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 text-[11px] font-semibold text-white/55">
                  {order.counterparty}
                </span>
                <span className="text-[11px] text-white/30">
                  {new Date(order.createdAt).toLocaleString("en-KE", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
    </>
  );
}
