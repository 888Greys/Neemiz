"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { MoneyClient } from "@/components/admin-money-client";
import { AdminProfitsClient } from "@/components/admin-profits-client";
import { Icon } from "@/components/icon";

// Unified "Money" surface. Cashflow/treasury (the redesigned Money screen) and
// the daily P&L statement (the old Finance/Profits screen) are now two tabs of
// one page rather than two overlapping nav items.
type Tab = "cashflow" | "pnl";

export function AdminTreasuryClient() {
  const initial = useSearchParams().get("tab") === "pnl" ? "pnl" : "cashflow";
  const [tab, setTab] = useState<Tab>(initial);

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: "cashflow", label: "Cashflow", icon: "payments" },
    { id: "pnl", label: "P&L", icon: "account_balance" },
  ];

  return (
    <div>
      {/* Slim tab strip — must NOT use `admin-page` (its min-height:100vh would
          push the tab content a full viewport down, since the child below is
          itself an `admin-page`). */}
      <div className="mx-auto w-full max-w-[1640px] px-3 pt-4 sm:px-6">
        <div className="flex gap-0.5 rounded-lg border border-white/[0.08] bg-white/[0.02] p-0.5">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[11px] font-black transition ${tab === t.id ? "bg-[#087cff] text-white" : "text-slate-500 hover:text-slate-300"}`}
            >
              <Icon name={t.icon} size={13} /> {t.label}
            </button>
          ))}
        </div>
      </div>
      {tab === "cashflow" ? <MoneyClient /> : <AdminProfitsClient />}
    </div>
  );
}
