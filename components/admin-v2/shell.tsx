"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Icon } from "@/components/icon";
import "./admin-v2.css";

// Redesigned admin shell ported from the Stitch "Owner Cockpit" export. Fixed
// 240px left rail + 56px top bar, dark Material palette. Rendered only under the
// /admin/new preview route for now; the current AdminShell stays untouched.

type NavItem = { label: string; icon: string; href: string };

// Every screen now lives inside the redesigned console (/admin/new/*).
const NAV: NavItem[] = [
  { label: "Cockpit", icon: "dashboard", href: "/admin/new" },
  { label: "Players", icon: "groups", href: "/admin/new/players" },
  { label: "P2P Ops", icon: "swap_horiz", href: "/admin/new/p2p" },
  { label: "Cash & payouts", icon: "payments", href: "/admin/new/withdrawals" },
  { label: "Markets", icon: "storefront", href: "/admin/new/markets/sports" },
  { label: "Broadcast", icon: "campaign", href: "/admin/new/broadcast" },
  { label: "Money", icon: "account_balance", href: "/admin/new/money" },
  { label: "Crypto", icon: "currency_bitcoin", href: "/admin/new/crypto" },
  { label: "Crypto balances", icon: "toll", href: "/admin/new/crypto-balances" },
  { label: "Deposit addresses", icon: "wallet", href: "/admin/new/deposit-addresses" },
  { label: "Risk", icon: "warning", href: "/admin/new/risk" },
  { label: "Ops", icon: "analytics", href: "/admin/new/ops" },
];

function navActive(pathname: string, href: string) {
  if (href === "/admin/new") return pathname === "/admin/new";
  // Markets has per-market sub-routes; keep the nav item active across all.
  if (href.startsWith("/admin/new/markets")) return pathname.startsWith("/admin/new/markets");
  return pathname === href || pathname.startsWith(href + "/");
}

export function AdminV2Shell({
  children,
  adminEmail,
}: {
  children: React.ReactNode;
  adminEmail?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [range, setRange] = useState("Today");

  async function exitAdmin() {
    await fetch("/api/admin/signout", { method: "POST" });
    router.push("/");
  }

  return (
    <div className="admin-v2 flex h-screen overflow-hidden text-[13px] antialiased">
      {/* Sidebar */}
      <nav className="fixed left-0 top-0 z-20 flex h-screen w-60 flex-col border-r border-[#424754] bg-[#201f20]">
        <div className="flex items-center gap-3 border-b border-[#424754] p-4">
          <div className="flex h-8 w-8 items-center justify-center rounded bg-[#adc6ff] font-bold text-[#002e6a]">N</div>
          <div>
            <h1 className="text-[16px] font-bold leading-tight text-[#e5e2e3]">Nezeem Admin</h1>
            <p className="text-[11px] font-semibold uppercase tracking-[0.05em] text-[#c2c6d6]">Owner Cockpit</p>
          </div>
        </div>
        <div className="flex flex-1 flex-col overflow-y-auto py-3">
          {NAV.map((item) => {
            const isActive = navActive(pathname, item.href);
            return (
              <Link
                key={item.label}
                href={item.href}
                className={`mx-2 mt-1 flex items-center gap-3 rounded px-4 py-2 transition-colors duration-200 first:mt-0 ${
                  isActive
                    ? "bg-[#3a4a5f] font-bold text-[#adc6ff]"
                    : "text-[#c2c6d6] hover:bg-[#353436]"
                }`}
                style={{ marginLeft: 8, marginRight: 8 }}
              >
                <Icon name={item.icon} size={18} />
                <span className="flex-1">{item.label}</span>
              </Link>
            );
          })}
          <div className="mx-4 mb-4 mt-auto border-t border-[#424754] pt-3">
            <button
              type="button"
              onClick={exitAdmin}
              className="flex w-full items-center gap-3 rounded px-4 py-2 text-[#c2c6d6] transition-colors duration-200 hover:bg-[#353436]"
            >
              <Icon name="logout" size={18} />
              Exit admin
            </button>
          </div>
        </div>
      </nav>

      {/* Main */}
      <main className="relative ml-60 flex h-screen w-[calc(100%-240px)] flex-1 flex-col">
        <header className="fixed right-0 top-0 z-10 flex h-14 w-[calc(100%-240px)] items-center justify-between border-b border-[#424754] bg-[#131314] px-4">
          <div className="flex items-center gap-4">
            <div className="text-[16px] font-semibold text-[#e5e2e3]">Nezeem Admin</div>
            <div className="flex items-center gap-2 rounded border border-[#424754] bg-[#0a0a0b] px-3 py-1">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
              <span className="text-[11px] font-semibold uppercase tracking-[0.05em] text-[#c2c6d6]">All Systems Operational</span>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="relative hidden lg:block">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#c2c6d6]">
                <Icon name="search" size={15} />
              </span>
              <input
                type="text"
                placeholder="Search users, TXs, markets..."
                className="w-64 rounded border border-[#424754] bg-[#0a0a0b] py-1.5 pl-9 pr-3 text-[13px] text-[#e5e2e3] outline-none transition-colors focus:border-[#3b82f6]"
              />
            </div>
            <select
              value={range}
              onChange={(e) => setRange(e.target.value)}
              className="appearance-none rounded border border-[#424754] bg-[#0a0a0b] py-1.5 pl-3 pr-8 text-[13px] text-[#e5e2e3] outline-none focus:border-[#3b82f6]"
            >
              <option>Today</option>
              <option>7D</option>
              <option>30D</option>
              <option>90D</option>
              <option>All Time</option>
            </select>
            <div className="flex items-center gap-3 border-l border-[#424754] pl-4 text-[#c2c6d6]">
              <span className="truncate text-[11px] font-semibold">{adminEmail}</span>
              <Icon name="person" size={18} />
            </div>
          </div>
        </header>

        <div className="mt-14 flex-1 overflow-y-auto p-6">{children}</div>
      </main>
    </div>
  );
}
