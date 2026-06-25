"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Icon } from "@/components/icon";

// Sidebar IA. Top-level stays compact: the six market deep-dives live inside one
// collapsible "Markets" group instead of six permanent rows, so the rail never
// gets squeezed. On mobile the rail is a horizontal scroller, so the group's
// children render inline (the desktop toggle is hidden there).
type Leaf = { href: string; label: string; icon: string };
type Node =
  | { type: "link"; href: string; label: string; icon: string }
  | { type: "tree"; label: string; icon: string; base: string; children: Leaf[] };

const SECTIONS: { name: string; nodes: Node[] }[] = [
  {
    name: "Monitor",
    nodes: [
      { type: "link", href: "/admin", label: "Cockpit", icon: "dashboard" },
      // Players merges the old growth screen + user directory (two tabs).
      { type: "link", href: "/admin/players", label: "Players", icon: "groups_2" },
      {
        type: "tree", label: "Markets", icon: "stacked_bar_chart", base: "/admin/markets",
        children: [
          { href: "/admin/markets/sports", label: "Sports", icon: "sports_soccer" },
          { href: "/admin/markets/binary", label: "Binary", icon: "candlestick_chart" },
          { href: "/admin/markets/aviator", label: "Aviator", icon: "flight_takeoff" },
          { href: "/admin/markets/predictions", label: "Predictions", icon: "online_prediction" },
          { href: "/admin/markets/forex", label: "Forex", icon: "currency_exchange" },
          { href: "/admin/markets/p2p", label: "P2P desk", icon: "swap_horiz" },
        ],
      },
    ],
  },
  {
    name: "Operate",
    nodes: [
      { type: "link", href: "/admin/p2p", label: "P2P ops", icon: "handshake" },
      { type: "link", href: "/admin/withdrawals", label: "Approvals", icon: "approval" },
      { type: "link", href: "/admin/broadcast", label: "Broadcast", icon: "campaign" },
    ],
  },
  {
    name: "Analyze",
    nodes: [
      // Money merges cashflow/treasury + the daily P&L statement (two tabs).
      { type: "link", href: "/admin/money", label: "Money", icon: "payments" },
      { type: "link", href: "/admin/crypto", label: "Crypto", icon: "currency_bitcoin" },
    ],
  },
];

function isActive(pathname: string, href: string) {
  return pathname === href || (href !== "/admin" && pathname.startsWith(href));
}

function NavLink({ href, label, icon, active, indent }: Leaf & { active: boolean; indent?: boolean }) {
  return (
    <Link
      href={href}
      className={`group flex shrink-0 items-center gap-3 rounded-lg px-2.5 py-2.5 transition-colors ${indent ? "lg:ml-3.5" : ""} ${
        active
          ? "bg-[#087cff]/14 text-white ring-1 ring-inset ring-[#087cff]/30"
          : "text-slate-500 hover:bg-white/[0.05] hover:text-slate-200"
      }`}
    >
      <span className={`flex items-center justify-center rounded-md ${indent ? "h-7 w-7" : "h-8 w-8"} ${active ? "bg-[#087cff] text-white" : "bg-white/[0.04] text-slate-600 group-hover:text-slate-300"}`}>
        <Icon name={icon} size={indent ? 14 : 15} />
      </span>
      <span className="hidden min-w-0 text-[11px] font-black lg:block">{label}</span>
      <span className="text-[10px] font-bold lg:hidden">{label}</span>
    </Link>
  );
}

export function AdminShell({ children, adminEmail }: { children: React.ReactNode; adminEmail?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  // Markets opens automatically when you're already on a market page.
  const [marketsOpen, setMarketsOpen] = useState(() => pathname.startsWith("/admin/markets"));

  async function exitAdmin() {
    await fetch("/api/admin/signout", { method: "POST" });
    router.push("/");
  }

  return (
    <div className="admin-root min-h-screen text-white lg:flex">
      <aside className="admin-sidebar border-b border-white/[0.08] lg:fixed lg:inset-y-0 lg:left-0 lg:z-40 lg:flex lg:w-64 lg:flex-col lg:border-b-0 lg:border-r">
        <div className="flex h-16 items-center justify-between border-b border-white/[0.08] px-4 lg:px-5">
          <Link href="/admin" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#087cff] text-white shadow-[0_8px_24px_rgba(8,124,255,.32)]">
              <Icon name="shield" size={17} />
            </div>
            <div>
              <span className="block text-[13px] font-black tracking-tight">Nezeem Admin</span>
              <span className="block text-[9px] font-bold text-slate-500">Operations console</span>
            </div>
          </Link>
          <span className="flex h-7 items-center gap-1 rounded-md border border-emerald-400/15 bg-emerald-400/[0.07] px-2 text-[9px] font-black text-emerald-300">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" /> LIVE
          </span>
        </div>

        <nav className="flex gap-1 overflow-x-auto px-3 py-3 lg:flex-1 lg:flex-col lg:overflow-y-auto lg:px-3 lg:py-5">
          {SECTIONS.map((section, si) => (
            <div key={section.name} className="contents lg:block">
              <p className={`mb-2 hidden px-2 text-[9px] font-black uppercase tracking-[0.18em] text-slate-600 lg:block ${si === 0 ? "" : "mt-5"}`}>{section.name}</p>
              {section.nodes.map((node) => {
                if (node.type === "link") {
                  return <NavLink key={node.href} href={node.href} label={node.label} icon={node.icon} active={isActive(pathname, node.href)} />;
                }
                // tree (Markets)
                const parentActive = pathname.startsWith(node.base);
                return (
                  <div key={node.label} className="contents lg:block">
                    <button
                      type="button"
                      onClick={() => setMarketsOpen((o) => !o)}
                      className={`group hidden w-full items-center gap-3 rounded-lg px-2.5 py-2.5 transition-colors lg:flex ${
                        parentActive && !marketsOpen ? "bg-[#087cff]/14 text-white ring-1 ring-inset ring-[#087cff]/30" : "text-slate-500 hover:bg-white/[0.05] hover:text-slate-200"
                      }`}
                      aria-expanded={marketsOpen}
                    >
                      <span className={`flex h-8 w-8 items-center justify-center rounded-md ${parentActive && !marketsOpen ? "bg-[#087cff] text-white" : "bg-white/[0.04] text-slate-600 group-hover:text-slate-300"}`}>
                        <Icon name={node.icon} size={15} />
                      </span>
                      <span className="min-w-0 flex-1 text-left text-[11px] font-black">{node.label}</span>
                      <Icon name="expand_more" size={16} className={`text-slate-600 transition-transform ${marketsOpen ? "rotate-180" : ""}`} />
                    </button>
                    {node.children.map((c) => (
                      <div key={c.href} className={`contents ${marketsOpen ? "" : "lg:hidden"}`}>
                        <NavLink href={c.href} label={c.label} icon={c.icon} active={isActive(pathname, c.href)} indent />
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="hidden border-t border-white/[0.08] p-3 lg:block">
          <div className="mb-3 rounded-lg border border-white/[0.07] bg-white/[0.025] p-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-white/[0.07] text-[10px] font-black text-blue-300">OW</div>
              <div className="min-w-0">
                <p className="truncate text-[10px] font-black text-slate-300">{adminEmail}</p>
                <p className="mt-0.5 text-[9px] text-emerald-400">Owner session verified</p>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={exitAdmin}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-[10px] font-black text-slate-600 transition hover:bg-white/[0.04] hover:text-white"
          >
            <Icon name="arrow_back" size={13} />
            Exit admin
          </button>
        </div>
      </aside>

      <main className="admin-main min-w-0 flex-1 lg:ml-60">{children}</main>
    </div>
  );
}
