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
  isBuyer: boolean;
  counterparty: string;
  createdAt: string;
}

// ─── Card row + helpers ───────────────────────────────────────────────────────

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 text-[13px]">
      <span className="shrink-0 text-slate-500">{label}</span>
      <span className={`min-w-0 truncate text-right ${strong ? "text-[15px] font-black text-white" : "font-semibold text-white"}`}>
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

  return (
    <>
      <P2PSubNav />
    <div className="mx-auto w-full max-w-6xl px-3 py-3 sm:px-4 lg:px-3 lg:py-2">
      {/* Header */}
      <div className="mb-3 lg:mb-2">
        <h1 className="mb-0.5 text-lg font-black text-white lg:text-base">My P2P Orders</h1>
        <p className="text-xs text-slate-500">Track all your buy and sell orders.</p>
      </div>

      {/* Main tabs: Ongoing / Fulfilled */}
      <div className="mb-3 flex items-center gap-6 border-b border-white/[0.08]">
        {([
          { id: "ongoing" as MainTab, label: "Ongoing" },
          { id: "fulfilled" as MainTab, label: "Fulfilled" },
        ]).map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => switchTab(id)}
            className={`relative -mb-px pb-2.5 text-sm font-bold transition ${
              mainTab === id ? "text-white" : "text-slate-500 hover:text-slate-300"
            }`}
          >
            {label}
            {mainTab === id && <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-[#087cff]" />}
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
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
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
        <OrdersLaunchpad />
      ) : filtered.length === 0 ? (
        <div className="flex min-h-[190px] flex-col items-center justify-center rounded-2xl border border-[#1e1e30] bg-[#0e0e14] px-6 py-8 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04]">
            <Icon name="receipt_long" className="text-xl text-slate-500" />
          </div>
          <p className="mb-1 text-base font-black text-white">No {mainTab} orders</p>
          <p className="max-w-sm text-sm leading-6 text-slate-500">
            Nothing here right now. Try another filter or start a new trade.
          </p>
        </div>
      ) : (
        <div className="flex w-full flex-col gap-3">
          {filtered.map((order) => (
            <Link
              key={order.id}
              href={`/p2p/order/${order.id}`}
              prefetch={false}
              className="group block rounded-2xl border border-white/[0.06] bg-[#0f0f16] px-4 py-4 transition hover:border-white/[0.10] hover:bg-[#13131b] lg:px-5"
            >
              {/* Top: side + status */}
              <div className="mb-3 flex items-center justify-between gap-2">
                <span className="text-[15px] font-black text-white">
                  <span className={order.isBuyer ? "text-[#05b957]" : "text-red-500"}>{order.isBuyer ? "Buy" : "Sell"}</span> {order.crypto}
                </span>
                <P2PStatusBadge status={order.status} />
              </div>

              {/* Detail rows */}
              <div className="space-y-2.5">
                <Row label="Amount" value={formatFiat(Number(order.fiatAmount), order.fiat, { decimals: 2 })} strong />
                <Row label="Price" value={formatFiat(Number(order.pricePerUnit), order.fiat)} />
                <Row label={order.isBuyer ? "Received Quantity" : "Total Quantity"} value={`${Number(order.cryptoAmount).toFixed(2)} ${order.crypto}`} />
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
