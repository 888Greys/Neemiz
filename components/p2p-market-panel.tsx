"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Icon } from "@/components/icon";
import { useSupabaseAuth } from "@/lib/supabase/auth-context";

// ─── My Orders ────────────────────────────────────────────────────────────────

interface Order {
  id:          string;
  crypto:      string;
  cryptoAmount:number;
  fiatAmount:  number;
  status:      string;
  side:        "buy" | "sell"; // buyer or seller perspective
  createdAt:   string;
}

const ORDER_STATUS_STYLE: Record<string, string> = {
  PENDING:   "bg-amber-500/10 text-amber-400 border-amber-500/20",
  PAID:      "bg-blue-500/10 text-blue-400 border-blue-500/20",
  RELEASED:  "bg-[#05b957]/10 text-[#05b957] border-[#05b957]/20",
  CANCELLED: "bg-white/5 text-slate-600 border-white/10",
  DISPUTED:  "bg-red-500/10 text-red-400 border-red-500/20",
  EXPIRED:   "bg-white/5 text-slate-600 border-white/10",
};

function MyOrders({ userId }: { userId: string }) {
  const [orders,  setOrders]  = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/p2p/orders?limit=3")
      .then((r) => r.ok ? r.json() : [])
      .then((data) => setOrders(Array.isArray(data) ? data.slice(0, 3) : []))
      .catch(() => setOrders([]))
      .finally(() => setLoading(false));
  }, [userId]);

  return (
    <div className="overflow-hidden rounded-xl border border-white/[0.06] bg-[#111118]">
      <div className="flex items-center justify-between px-3 pt-3 pb-2">
        <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest">My Orders</p>
        <Link href="/p2p/orders" prefetch={false} className="text-[10px] text-[#087cff] hover:text-blue-300 font-bold transition-colors">
          View all
        </Link>
      </div>

      {loading ? (
        <div className="space-y-2 px-3 pb-3">
          {[1,2,3].map((i) => (
            <div key={i} className="h-10 rounded-xl bg-white/[0.03] animate-pulse" />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="px-3 pb-4 text-center">
          <Icon name="receipt_long" className="text-slate-700 text-2xl mb-1" />
          <p className="text-[11px] text-slate-600">No orders yet</p>
          <Link href="/p2p" prefetch={false} className="text-[10px] text-[#05b957] font-bold hover:underline">
            Start trading →
          </Link>
        </div>
      ) : (
        <div className="max-h-[148px] space-y-1.5 overflow-y-auto px-3 pb-3 pr-2 [scrollbar-width:thin]">
          {orders.map((o) => (
            <Link
              key={o.id}
              href={`/p2p/order/${o.id}`}
              prefetch={false}
              className="flex items-center gap-2 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.05] rounded-xl px-3 py-2 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-black text-white">
                    {Number(o.cryptoAmount).toLocaleString("en-US", { maximumFractionDigits: 4 })} {o.crypto}
                  </span>
                  <span className="text-[9px] text-slate-600">·</span>
                  <span className="text-[10px] text-slate-500">
                    KSh {Number(o.fiatAmount).toLocaleString("en-KE", { maximumFractionDigits: 0 })}
                  </span>
                </div>
              </div>
              <span className={`shrink-0 text-[9px] font-black px-1.5 py-0.5 rounded-full border ${ORDER_STATUS_STYLE[o.status] ?? ORDER_STATUS_STYLE.CANCELLED}`}>
                {o.status}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Merchant Center ──────────────────────────────────────────────────────────

interface MerchantInfo {
  isMerchant:      boolean;
  kycStatus:       string;
  isOnline:        boolean;
  displayName:     string;
  completedTrades: number;
  completionRate:  number;
  activeAds:       number;
}

function MerchantCenter({ userId }: { userId: string }) {
  const [info,    setInfo]    = useState<MerchantInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [toggling,setToggling]= useState(false);

  useEffect(() => {
    fetch("/api/p2p/merchant/profile")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => setInfo(d))
      .catch(() => setInfo(null))
      .finally(() => setLoading(false));
  }, [userId]);

  async function toggleOnline() {
    if (!info) return;
    setToggling(true);
    try {
      const res = await fetch("/api/p2p/merchant/online", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isOnline: !info.isOnline }),
      });
      if (res.ok) setInfo((prev) => prev ? { ...prev, isOnline: !prev.isOnline } : prev);
    } finally {
      setToggling(false);
    }
  }

  if (loading) {
    return (
      <div className="h-24 rounded-2xl bg-[#111118] border border-white/[0.06] animate-pulse" />
    );
  }

  // Not a merchant yet
  if (!info || !info.isMerchant) {
    return (
      <Link
        href="/p2p/merchant"
        prefetch={false}
        className="flex items-center gap-3 bg-[#087cff]/10 border border-[#087cff]/20 rounded-2xl px-4 py-3.5 hover:bg-[#087cff]/15 transition-colors"
      >
        <div className="w-8 h-8 rounded-xl bg-[#087cff]/20 flex items-center justify-center shrink-0">
          <Icon name="storefront" className="text-[#087cff] text-lg" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-black text-white">Become a Merchant</p>
          <p className="text-[10px] text-slate-500">Post ads · Earn on every trade</p>
        </div>
        <Icon name="arrow_forward" className="text-slate-600 text-sm shrink-0" />
      </Link>
    );
  }

  // Active merchant dashboard
  return (
    <div className="overflow-hidden rounded-xl border border-white/[0.06] bg-[#111118]">
      <div className="flex items-center justify-between px-3 pt-3 pb-2">
        <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Merchant Center</p>
        <Link href="/p2p/merchant" prefetch={false} className="text-[10px] text-[#087cff] hover:text-blue-300 font-bold transition-colors">
          Manage
        </Link>
      </div>

      {/* Merchant info */}
      <div className="space-y-3 px-3 pb-3">
        {/* Name + online toggle */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-black text-white">{info.displayName}</p>
            <p className="text-[10px] text-slate-600">{info.completedTrades} completed · {Number(info.completionRate).toFixed(0)}% rate</p>
          </div>
          <button
            onClick={toggleOnline}
            disabled={toggling}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[10px] font-black border transition-all ${
              info.isOnline
                ? "bg-[#05b957]/15 border-[#05b957]/30 text-[#05b957]"
                : "bg-white/[0.04] border-white/[0.08] text-slate-500"
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${info.isOnline ? "bg-[#05b957] animate-pulse" : "bg-slate-600"}`} />
            {info.isOnline ? "Online" : "Offline"}
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-1.5">
          <div className="rounded-lg border border-white/[0.05] bg-white/[0.03] px-2 py-2 text-center">
            <p className="text-sm font-black text-white">{info.activeAds}</p>
            <p className="text-[9px] text-slate-600">Ads</p>
          </div>
          <div className="rounded-lg border border-white/[0.05] bg-white/[0.03] px-2 py-2 text-center">
            <p className="text-sm font-black text-white">{info.completedTrades}</p>
            <p className="text-[9px] text-slate-600">Trades</p>
          </div>
          <div className="rounded-lg border border-white/[0.05] bg-white/[0.03] px-2 py-2 text-center">
            <p className="text-sm font-black text-[#05b957]">{Number(info.completionRate).toFixed(0)}%</p>
            <p className="text-[9px] text-slate-600">Done</p>
          </div>
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-2 gap-1.5">
          <Link href="/p2p/merchant?tab=ads" prefetch={false} className="flex items-center justify-center gap-1.5 bg-white/[0.04] border border-white/[0.06] rounded-xl py-2 text-[11px] font-black text-white hover:bg-white/[0.07] transition-colors">
            <Icon name="view_list" className="text-sm text-slate-400" />
            My Ads
          </Link>
          <Link href="/p2p/merchant?tab=deposit" prefetch={false} className="flex items-center justify-center gap-1.5 bg-white/[0.04] border border-white/[0.06] rounded-xl py-2 text-[11px] font-black text-white hover:bg-white/[0.07] transition-colors">
            <Icon name="account_balance_wallet" className="text-sm text-[#087cff]" />
            Deposit
          </Link>
        </div>
      </div>
    </div>
  );
}

// ─── Trust Signals ────────────────────────────────────────────────────────────

function TrustBlock() {
  const items = [
    { icon: "lock",          text: "Escrow-protected",    sub: "Crypto locked until payment confirmed" },
    { icon: "verified_user", text: "KYC verified",        sub: "All merchants are identity-verified" },
    { icon: "support_agent", text: "Dispute resolution",  sub: "Admin mediates any disputed trade" },
  ];

  return (
    <div className="space-y-2">
      {items.map(({ icon, text, sub }) => (
        <div key={text} className="flex items-start gap-3 bg-[#111118] border border-white/[0.05] rounded-xl px-3 py-2.5">
          <div className="w-7 h-7 rounded-lg bg-[#087cff]/10 flex items-center justify-center shrink-0 mt-0.5">
            <Icon name={icon} className="text-[#087cff] text-sm" />
          </div>
          <div>
            <p className="text-xs font-black text-white">{text}</p>
            <p className="text-[10px] text-slate-600 leading-tight mt-0.5">{sub}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

export function P2PMarketPanel() {
  const { user } = useSupabaseAuth();

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto no-scrollbar px-3 py-5">

      {/* Header */}
      <div className="flex items-center justify-between px-1">
        <p className="text-sm font-black text-white">P2P Market</p>
        <button
          onClick={() => window.location.reload()}
          className="p-1.5 rounded-lg text-slate-600 hover:text-white hover:bg-white/[0.06] transition-colors"
          title="Refresh"
        >
          <Icon name="refresh" className="text-base" />
        </button>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 gap-2">
        <Link
          href="/p2p"
          prefetch={false}
          className="flex flex-col items-center gap-1.5 bg-[#05b957]/10 border border-[#05b957]/20 rounded-xl py-3 hover:bg-[#05b957]/15 transition-colors"
        >
          <Icon name="add_circle" className="text-[#05b957] text-xl" />
          <span className="text-xs font-black text-white">Buy</span>
        </Link>
        <Link
          href="/p2p?side=SELL"
          prefetch={false}
          className="flex flex-col items-center gap-1.5 bg-red-500/10 border border-red-500/20 rounded-xl py-3 hover:bg-red-500/15 transition-colors"
        >
          <Icon name="remove_circle" className="text-red-400 text-xl" />
          <span className="text-xs font-black text-white">Sell</span>
        </Link>
      </div>

      {/* My Orders — only when signed in */}
      {user && <MyOrders userId={user.id} />}

      {/* Merchant Center — shows become-merchant CTA or dashboard */}
      {user
        ? <MerchantCenter userId={user.id} />
        : (
          <Link
            href="/p2p/merchant"
            prefetch={false}
            className="flex items-center gap-3 bg-[#087cff]/10 border border-[#087cff]/20 rounded-2xl px-4 py-3.5 hover:bg-[#087cff]/15 transition-colors"
          >
            <div className="w-8 h-8 rounded-xl bg-[#087cff]/20 flex items-center justify-center shrink-0">
              <Icon name="storefront" className="text-[#087cff] text-lg" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-black text-white">Become a Merchant</p>
              <p className="text-[10px] text-slate-500">Post ads · Earn on every trade</p>
            </div>
            <Icon name="arrow_forward" className="text-slate-600 text-sm shrink-0" />
          </Link>
        )
      }

      {/* Trust signals */}
      <TrustBlock />
    </div>
  );
}
