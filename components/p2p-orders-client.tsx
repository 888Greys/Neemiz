"use client";

import { useState, useEffect, useCallback } from "react";
import { getCached, cachedFetch } from "@/lib/client-cache";
import Link from "next/link";
import { Icon } from "@/components/icon";
import { P2PSubNav } from "@/components/p2p-subnav";
import { formatFiat } from "@/lib/p2p/currencies";
import { P2PStatusBadge } from "@/components/p2p/status-badge";
import { useSupabaseAuth } from "@/lib/supabase/auth-context";
import { useAuthModal } from "@/lib/auth-modal-context";

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
  const [orders, setOrders]   = useState<OrderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState<FilterTab>("all");
  const { isLoaded, isSignedIn } = useSupabaseAuth();
  const { openLogin } = useAuthModal();

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
    <div className="mx-auto w-full max-w-6xl px-3 py-3 sm:px-4 lg:px-3 lg:py-2">
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
      {!isLoaded || loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-[88px] rounded-2xl bg-white/5 animate-pulse lg:h-[58px] lg:rounded-lg" />
          ))}
        </div>
      ) : !isSignedIn ? (
        <OrdersLoginState openLogin={openLogin} />
      ) : filtered.length === 0 ? (
        filter === "all" ? (
          <OrdersLaunchpad />
        ) : (
          <div className="flex min-h-[190px] flex-col items-center justify-center rounded-2xl border border-[#1e1e30] bg-[#0e0e14] px-6 py-8 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04]">
              <Icon name="receipt_long" className="text-xl text-slate-500" />
            </div>
            <p className="mb-1 text-base font-black text-white">No {filter} orders</p>
            <p className="max-w-sm text-sm leading-6 text-slate-500">
              Nothing here right now. Try another filter or start a new trade.
            </p>
          </div>
        )
      ) : (
        <div className="flex flex-col gap-1.5">
          {filtered.map((order) => (
            <Link
              key={order.id}
              href={`/p2p/order/${order.id}`}
              prefetch={false}
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

function OrdersLoginState({ openLogin }: { openLogin: () => void }) {
  return (
    <div className="flex min-h-[260px] flex-col items-center justify-center rounded-2xl border border-[#1e1e30] bg-[#0e0e14] px-6 py-8 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04]">
        <Icon name="lock" className="text-xl text-slate-400" />
      </div>
      <p className="mb-1 text-lg font-black text-white">Log in to view P2P orders</p>
      <p className="max-w-sm text-sm leading-6 text-slate-500">
        This page only shows trades for the account signed in on this browser.
      </p>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          onClick={openLogin}
          className="rounded-xl bg-[#087cff] px-5 py-2.5 text-sm font-black text-white transition hover:bg-[#0a6ee0]"
        >
          Login
        </button>
        {process.env.NODE_ENV !== "production" ? (
          <Link
            href="/dev-login"
            prefetch={false}
            className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-5 py-2.5 text-sm font-black text-slate-200 transition hover:bg-white/[0.08]"
          >
            Dev login
          </Link>
        ) : null}
      </div>
    </div>
  );
}

// ─── Empty-state launchpad ──────────────────────────────────────────────────────
// Turns the "no orders" dead zone into an onboarding moment: two ways to start a
// trade, the 3-step flow, and an escrow reassurance line.

function OrdersLaunchpad() {
  const actions = [
    {
      href: "/p2p",
      icon: "storefront",
      title: "Browse the market",
      desc: "Pick a verified merchant and set your own price.",
      tone: "from-[#087cff]/15 to-transparent",
      ring: "ring-[#087cff]/25",
      iconBg: "bg-[#087cff]/15 text-[#087cff]",
      cta: "Browse ads",
    },
    {
      href: "/p2p/express",
      icon: "bolt",
      title: "Express buy",
      desc: "Auto-match to the best price instantly — no hunting.",
      tone: "from-[#05b957]/15 to-transparent",
      ring: "ring-[#05b957]/25",
      iconBg: "bg-[#05b957]/15 text-[#05b957]",
      cta: "Buy now",
    },
  ];

  const steps = [
    { icon: "manage_search", title: "Choose an offer", desc: "Browse rates or auto-match in Express." },
    { icon: "payments", title: "Pay the merchant", desc: "M-Pesa or bank transfer within the window." },
    { icon: "account_balance_wallet", title: "Receive crypto", desc: "Released from escrow once payment clears." },
  ];

  return (
    <div className="space-y-4">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl border border-[#1e1e30] bg-[radial-gradient(circle_at_top_right,rgba(8,124,255,.10),transparent_45%),#0e0e14] px-6 py-7 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04]">
          <Icon name="receipt_long" className="text-xl text-slate-400" />
        </div>
        <p className="mb-1 text-lg font-black text-white">Your first trade is one tap away</p>
        <p className="mx-auto max-w-md text-sm leading-6 text-slate-500">
          You haven&apos;t placed any P2P orders yet. Every trade is escrow-protected from start to finish.
        </p>
      </div>

      {/* Two ways to start */}
      <div className="grid gap-3 sm:grid-cols-2">
        {actions.map((a) => (
          <Link
            key={a.href}
            href={a.href}
            prefetch={false}
            className={`group relative overflow-hidden rounded-2xl border border-white/[0.07] bg-gradient-to-br ${a.tone} bg-[#111118] p-5 ring-1 ring-inset ${a.ring} transition hover:-translate-y-0.5 hover:border-white/15`}
          >
            <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${a.iconBg}`}>
              <Icon name={a.icon} fill className="text-[20px]" />
            </div>
            <p className="text-base font-black text-white">{a.title}</p>
            <p className="mt-1 text-[13px] leading-5 text-slate-500">{a.desc}</p>
            <span className="mt-4 inline-flex items-center gap-1 text-[13px] font-black text-white/80 transition group-hover:gap-2">
              {a.cta}
              <Icon name="arrow_forward" className="text-[16px]" />
            </span>
          </Link>
        ))}
      </div>

      {/* How it works */}
      <div className="rounded-2xl border border-white/[0.06] bg-[#0e0e14] p-5">
        <p className="mb-4 text-center text-[11px] font-black uppercase tracking-widest text-slate-600">
          How P2P trading works
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          {steps.map((s, i) => (
            <div key={i} className="relative rounded-xl border border-white/[0.06] bg-[#111118] p-4">
              {i < 2 && <div className="absolute -right-1.5 top-1/2 z-10 hidden h-px w-3 bg-white/[0.08] sm:block" />}
              <div className="mb-2 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#087cff]/20 bg-[#087cff]/10">
                  <Icon name={s.icon} className="text-[15px] text-[#087cff]" />
                </div>
                <span className="rounded-full bg-white/[0.04] px-2 py-0.5 text-[10px] font-black text-slate-500">Step {i + 1}</span>
              </div>
              <p className="mb-0.5 text-sm font-black text-white">{s.title}</p>
              <p className="text-xs leading-5 text-slate-600">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
