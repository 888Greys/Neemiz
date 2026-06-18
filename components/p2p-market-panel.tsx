"use client";

import Link from "next/link";
import { Icon } from "@/components/icon";

// ─── Trading Guide ────────────────────────────────────────────────────────────

function TradingGuideBlock() {
  const items = [
    { icon: "price_check", text: "Check the price", sub: "Compare the rate and order limits before opening a trade." },
    { icon: "account_balance", text: "Pay only in-order", sub: "Use the payment account shown on the order screen." },
    { icon: "lock_open", text: "Release after receipt", sub: "Sellers should confirm funds in their account first." },
  ];

  return (
    <div className="overflow-hidden rounded-xl border border-white/[0.06] bg-[#111118]">
      <div className="flex items-center justify-between border-b border-white/[0.06] px-3 py-3">
        <div>
          <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">Before you trade</p>
          <p className="mt-0.5 text-[10px] font-semibold text-slate-600">Fast checks for safer P2P orders</p>
        </div>
        <div className="grid h-8 w-8 place-items-center rounded-xl bg-[#087cff]/10 text-[#55aaff]">
          <Icon name="rule" className="text-[18px]" />
        </div>
      </div>

      <div className="divide-y divide-white/[0.05]">
        {items.map(({ icon, text, sub }) => (
          <div key={text} className="flex items-start gap-2.5 px-3 py-2.5">
            <div className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-white/[0.04] text-slate-300">
              <Icon name={icon} className="text-[15px]" />
            </div>
            <div className="min-w-0">
              <p className="text-[12px] font-black text-white">{text}</p>
              <p className="mt-0.5 text-[10px] leading-tight text-slate-600">{sub}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

export function P2PMarketPanel() {
  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto no-scrollbar px-3 py-5">

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

      {/* Trading guide */}
      <TradingGuideBlock />
    </div>
  );
}
