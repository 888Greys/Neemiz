"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getCached, cachedFetch } from "@/lib/client-cache";
import Link from "next/link";
import { Icon } from "@/components/icon";
import { P2PSubNav } from "@/components/p2p-subnav";
import { formatFiat } from "@/lib/p2p/currencies";
import { P2PStatusBadge } from "@/components/p2p/status-badge";
import { useSupabaseAuth } from "@/lib/supabase/auth-context";
import { useAuthModal } from "@/lib/auth-modal-context";
import { toast } from "@/lib/toast";

// ─── Types ────────────────────────────────────────────────────────────────────

type OrderStatus = "PENDING" | "PAID" | "RELEASED" | "DISPUTED" | "CANCELLED" | "EXPIRED";

type MainTab = "ongoing" | "fulfilled";
type SubFilter = "all" | "pending" | "processing" | "completed" | "cancelled" | "expired" | "appeal";

const ONGOING_STATUSES: OrderStatus[] = ["PENDING", "PAID"];
const FULFILLED_STATUSES: OrderStatus[] = ["RELEASED", "CANCELLED", "EXPIRED", "DISPUTED"];

interface OrderSummary {
  id: string;
  status: OrderStatus;
  crypto: string;
  cryptoAmount: number;
  fiatAmount: number;
  pricePerUnit: number;
  fiat: string;
  side: "BUY" | "SELL";
  isBuyer: boolean;
  isSeller: boolean;
  counterparty: string;
  createdAt: string;
}

// ─── Card row + helpers ───────────────────────────────────────────────────────

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 text-[13px]">
      <span className="shrink-0 text-slate-500">{label}</span>
      <span className={`min-w-0 truncate text-right ${strong ? "text-[15px] font-bold text-white" : "font-semibold text-white"}`}>
        {value}
      </span>
    </div>
  );
}

// "06-17 14:39:51" — month-day hour:min:sec, matching the order-history design.
function fmtTimestamp(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

function statusMatchesSub(status: OrderStatus, sub: SubFilter): boolean {
  switch (sub) {
    case "all":        return true;
    case "pending":    return status === "PENDING";
    case "processing": return status === "PAID";
    case "completed":  return status === "RELEASED";
    case "cancelled":  return status === "CANCELLED";
    case "expired":    return status === "EXPIRED";
    case "appeal":     return status === "DISPUTED";
  }
}

// ─── Main P2P Orders Client ───────────────────────────────────────────────────

const ORDERS_KEY = "/api/p2p/orders";

export function P2POrdersClient() {
  const [orders, setOrders]   = useState<OrderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [mainTab, setMainTab] = useState<MainTab>("ongoing");
  const [subFilter, setSubFilter] = useState<SubFilter>("all");
  const { isLoaded, isSignedIn } = useSupabaseAuth();
  const { openLogin } = useAuthModal();
  const router = useRouter();

  const fetchOrders = useCallback(async (force = false) => {
    if (!isSignedIn) {
      setOrders([]);
      setLoading(false);
      return;
    }

    try {
      const data = await cachedFetch<OrderSummary[]>(ORDERS_KEY, force);
      if (data) setOrders(data);
    } finally {
      setLoading(false);
    }
  }, [isSignedIn]);

  // Seed from the client cache AFTER mount (not in the useState initializer) so
  // the first client render matches the server's empty render. Reading
  // sessionStorage during render is what caused the /p2p/orders hydration error.
  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      setOrders([]);
      setLoading(false);
      return;
    }

    const cached = getCached<OrderSummary[]>(ORDERS_KEY);
    if (cached?.length) { setOrders(cached); setLoading(false); }
    fetchOrders(true);
  }, [fetchOrders, isLoaded, isSignedIn]);

  const mainStatuses = mainTab === "ongoing" ? ONGOING_STATUSES : FULFILLED_STATUSES;
  const filtered = orders.filter(
    (o) => mainStatuses.includes(o.status) && statusMatchesSub(o.status, subFilter),
  );

  const subChips: { id: SubFilter; label: string }[] =
    mainTab === "ongoing"
      ? [
          { id: "all", label: "All" },
          { id: "pending", label: "Pending" },
          { id: "processing", label: "Processing" },
        ]
      : [
          { id: "all", label: "All" },
          { id: "completed", label: "Completed" },
          { id: "cancelled", label: "Cancelled" },
          { id: "expired", label: "Expired" },
          { id: "appeal", label: "Appeal" },
        ];

  const switchTab = (tab: MainTab) => { setMainTab(tab); setSubFilter("all"); };

  const copyOrderNo = (id: string) => {
    navigator.clipboard?.writeText(id).then(() => toast.success("Order number copied")).catch(() => {});
  };

  const isCryptoBuyer = (order: OrderSummary) =>
    order.side === "SELL" ? order.isBuyer : order.isSeller;

  return (
    <>
      <P2PSubNav />
    <div className="mx-auto w-full max-w-lg px-3 py-3 sm:max-w-xl sm:px-4 lg:max-w-6xl lg:px-3 lg:py-2">
      {/* Header */}
      <div className="mb-1 flex items-center justify-between py-2 lg:mb-2">
        <h1 className="text-[17px] font-bold text-white">Orders</h1>
        <span className="text-[12px] font-medium text-slate-500 lg:hidden" />
      </div>

      {/* Main tabs: Ongoing / Fulfilled */}
      <div className="mb-3 flex items-end gap-5 border-b border-white/[0.08]">
        {([
          { id: "ongoing" as MainTab, label: "Ongoing" },
          { id: "fulfilled" as MainTab, label: "Fulfilled" },
        ]).map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => switchTab(id)}
            className={`relative pb-2.5 text-[15px] font-bold transition ${
              mainTab === id ? "text-white" : "text-slate-500"
            }`}
          >
            {label}
            {mainTab === id && (
              <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-white" />
            )}
          </button>
        ))}
      </div>

      {/* Sub-filter chips */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {subChips.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => setSubFilter(id)}
            className={`rounded-lg px-3 py-1.5 text-[12px] font-semibold transition ${
              subFilter === id ? "bg-white/10 text-white" : "text-slate-500 hover:text-slate-300"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      {!isLoaded || loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-[88px] rounded-2xl bg-white/5 animate-pulse lg:h-[58px] lg:rounded-lg" />
          ))}
        </div>
      ) : !isSignedIn ? (
        <OrdersLoginState openLogin={openLogin} />
      ) : orders.length === 0 ? (
        <OrdersEmptyState />
      ) : filtered.length === 0 ? (
        <div className="flex min-h-[220px] flex-col items-center justify-center px-6 py-12 text-center">
          <Icon name="inbox" className="mb-3 text-[28px] text-slate-600" />
          <p className="text-[14px] font-bold text-slate-400">No {mainTab} orders</p>
        </div>
      ) : (
        <div className="flex w-full flex-col gap-3">
          {filtered.map((order) => (
            (() => {
              const cryptoBuyer = isCryptoBuyer(order);
              return (
            <Link
              key={order.id}
              href={`/p2p/order/${order.id}`}
              prefetch={false}
              className="group block rounded-xl bg-[#1c1c1e] px-4 py-4 transition hover:bg-[#222226] lg:px-5"
            >
              {/* Top: side + status */}
              <div className="mb-3 flex items-center justify-between gap-2">
                <span className="text-[15px] font-bold text-white">
                  <span className={cryptoBuyer ? "text-[#05b957]" : "text-red-500"}>{cryptoBuyer ? "Buy" : "Sell"}</span> {order.crypto}
                </span>
                <P2PStatusBadge status={order.status} />
              </div>

              {/* Detail rows */}
              <div className="space-y-2.5">
                <Row label="Amount" value={formatFiat(Number(order.fiatAmount), order.fiat, { decimals: 2 })} strong />
                <Row label="Price" value={formatFiat(Number(order.pricePerUnit), order.fiat)} />
                <Row label={cryptoBuyer ? "Received Quantity" : "Total Quantity"} value={`${Number(order.cryptoAmount).toFixed(2)} ${order.crypto}`} />
                <div className="flex items-center justify-between gap-3 text-[13px]">
                  <span className="shrink-0 text-slate-500">Order</span>
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span className="min-w-0 truncate font-mono font-semibold text-white">{order.id.toUpperCase()}</span>
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); copyOrderNo(order.id.toUpperCase()); }}
                      className="shrink-0 text-slate-500 transition hover:text-white"
                    >
                      <Icon name="content_copy" className="text-[13px]" />
                    </button>
                  </span>
                </div>
              </div>

              {/* Footer: merchant name + chat (opens the conversation) + timestamp */}
              <div className="mt-3 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); router.push(`/p2p/order/${order.id}?chat=1`); }}
                  className="inline-flex items-center gap-1.5 rounded bg-white/[0.06] px-2.5 py-1 text-[12px] font-semibold text-slate-300 transition hover:bg-white/[0.12] hover:text-white"
                >
                  {order.counterparty || "Trader"}
                  <Icon name="chat" className="text-[14px] text-[#087cff]" />
                </button>
                <span className="text-[12px] text-slate-500">{fmtTimestamp(order.createdAt)}</span>
              </div>
            </Link>
              );
            })()
          ))}
        </div>
      )}
    </div>
    </>
  );
}

function OrdersLoginState({ openLogin }: { openLogin: () => void }) {
  return (
    <div className="flex min-h-[280px] flex-col items-center justify-center px-6 py-14 text-center">
      <svg width="72" height="72" viewBox="0 0 72 72" fill="none" aria-hidden className="mb-4 text-slate-600">
        <path d="M18 14h28l10 10v34a4 4 0 0 1-4 4H18a4 4 0 0 1-4-4V18a4 4 0 0 1 4-4Z" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" />
        <path d="M46 14v10h10" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" />
        <path d="M24 34h24M24 42h18M24 50h12" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
      <p className="text-[14px] font-medium text-slate-400">Log in to view your P2P orders.</p>
      <button
        type="button"
        onClick={openLogin}
        className="mt-6 rounded-full border border-dashed border-white/35 px-8 py-2.5 text-[14px] font-bold text-white transition hover:border-white/55 hover:bg-white/[0.04] active:scale-[0.98]"
      >
        Login
      </button>
      {process.env.NODE_ENV !== "production" ? (
        <Link
          href="/dev-login"
          prefetch={false}
          className="mt-3 text-[12px] font-semibold text-slate-500 transition hover:text-white"
        >
          Dev login
        </Link>
      ) : null}
    </div>
  );
}

// Clean empty state — Ads-style dashed CTA.
function OrdersEmptyState() {
  return (
    <div className="flex min-h-[280px] flex-col items-center justify-center px-6 py-14 text-center">
      <svg width="72" height="72" viewBox="0 0 72 72" fill="none" aria-hidden className="mb-4 text-slate-600">
        <path d="M18 14h28l10 10v34a4 4 0 0 1-4 4H18a4 4 0 0 1-4-4V18a4 4 0 0 1 4-4Z" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" />
        <path d="M46 14v10h10" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" />
        <path d="M24 34h24M24 42h18M24 50h12" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
      <p className="text-[14px] font-medium text-slate-400">Oops, you do not have any orders.</p>
      <Link
        href="/p2p"
        prefetch={false}
        className="mt-6 rounded-full border border-dashed border-white/35 px-8 py-2.5 text-[14px] font-bold text-white transition hover:border-white/55 hover:bg-white/[0.04] active:scale-[0.98]"
      >
        Trade Now
      </Link>
    </div>
  );
}
