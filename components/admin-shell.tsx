"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Icon } from "@/components/icon";

// Sidebar IA. Top-level stays compact: the six market deep-dives live inside one
// collapsible "Markets" group instead of six permanent rows. On desktop it's a
// fixed left rail; on mobile it's an off-canvas drawer opened from the top bar.
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
      { type: "link", href: "/admin/p2p-backing", label: "P2P backing", icon: "account_balance_wallet" },
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
      { type: "link", href: "/admin/crypto-balances", label: "Crypto balances", icon: "account_balance" },
    ],
  },
];

function isActive(pathname: string, href: string) {
  return pathname === href || (href !== "/admin" && pathname.startsWith(href));
}

function NavLink({ href, label, icon, active, indent, badge }: Leaf & { active: boolean; indent?: boolean; badge?: number | null }) {
  return (
    <Link
      href={href}
      className={`group flex items-center gap-3 rounded-lg px-2.5 py-2.5 transition-colors ${indent ? "ml-3.5" : ""} ${
        active
          ? "bg-[#087cff]/14 text-white ring-1 ring-inset ring-[#087cff]/30"
          : "text-slate-500 hover:bg-white/[0.05] hover:text-slate-200"
      }`}
    >
      <span className={`flex items-center justify-center rounded-md ${indent ? "h-7 w-7" : "h-8 w-8"} ${active ? "bg-[#087cff] text-white" : "bg-white/[0.04] text-slate-600 group-hover:text-slate-300"}`}>
        <Icon name={icon} size={indent ? 14 : 15} />
      </span>
      <span className="min-w-0 flex-1 text-[12px] font-black">{label}</span>
      {badge != null && badge > 0 && (
        <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1.5 text-[9px] font-black text-white ring-1 ring-amber-500/30">
          {badge}
        </span>
      )}
    </Link>
  );
}

export function AdminShell({ children, adminEmail }: { children: React.ReactNode; adminEmail?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  // Markets opens automatically when you're already on a market page.
  const [marketsOpen, setMarketsOpen] = useState(() => pathname.startsWith("/admin/markets"));
  const [pendingCount, setPendingCount] = useState<number | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  useEffect(() => {
    fetch("/api/admin/withdrawals")
      .then((r) => r.ok ? r.json() : [])
      .then((data) => {
        if (Array.isArray(data)) setPendingCount(data.length);
      })
      .catch(() => {});
  }, []);

  async function exitAdmin() {
    await fetch("/api/admin/signout", { method: "POST" });
    router.push("/");
  }

  return (
    <div className="admin-root min-h-screen text-white lg:flex">
      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-white/[0.08] bg-[#0b0d12]/95 px-4 backdrop-blur lg:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
          className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/[0.05] text-slate-300 active:scale-95"
        >
          <Icon name="menu" size={20} />
        </button>
        <Link href="/admin" className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#087cff] text-white"><Icon name="shield" size={15} /></div>
          <span className="text-[13px] font-black tracking-tight">Nezeem Admin</span>
        </Link>
        <span className="flex h-6 items-center gap-1 rounded-md border border-emerald-400/15 bg-emerald-400/[0.07] px-2 text-[9px] font-black text-emerald-300">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" /> LIVE
        </span>
      </header>

      {/* Mobile drawer backdrop */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden" onClick={() => setMobileOpen(false)} aria-hidden />
      )}

      <aside
        className={`admin-sidebar fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-white/[0.08] bg-[#0b0d12] transition-transform duration-200 ease-out lg:z-40 lg:w-64 lg:translate-x-0 lg:bg-transparent ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
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
          {/* Close (mobile only) */}
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            aria-label="Close menu"
            className="flex h-8 w-8 items-center justify-center rounded-md bg-white/[0.05] text-slate-400 lg:hidden"
          >
            <Icon name="close" size={18} />
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-4">
          {SECTIONS.map((section, si) => (
            <div key={section.name}>
              <p className={`mb-2 px-2 text-[9px] font-black uppercase tracking-[0.18em] text-slate-600 ${si === 0 ? "" : "mt-5"}`}>{section.name}</p>
              {section.nodes.map((node) => {
                if (node.type === "link") {
                  return (
                    <NavLink
                      key={node.href}
                      href={node.href}
                      label={node.label}
                      icon={node.icon}
                      active={isActive(pathname, node.href)}
                      badge={node.href === "/admin/withdrawals" ? pendingCount : undefined}
                    />
                  );
                }
                // tree (Markets)
                const parentActive = pathname.startsWith(node.base);
                return (
                  <div key={node.label}>
                    <button
                      type="button"
                      onClick={() => setMarketsOpen((o) => !o)}
                      className={`group flex w-full items-center gap-3 rounded-lg px-2.5 py-2.5 transition-colors ${
                        parentActive && !marketsOpen ? "bg-[#087cff]/14 text-white ring-1 ring-inset ring-[#087cff]/30" : "text-slate-500 hover:bg-white/[0.05] hover:text-slate-200"
                      }`}
                      aria-expanded={marketsOpen}
                    >
                      <span className={`flex h-8 w-8 items-center justify-center rounded-md ${parentActive && !marketsOpen ? "bg-[#087cff] text-white" : "bg-white/[0.04] text-slate-600 group-hover:text-slate-300"}`}>
                        <Icon name={node.icon} size={15} />
                      </span>
                      <span className="min-w-0 flex-1 text-left text-[12px] font-black">{node.label}</span>
                      <Icon name="expand_more" size={16} className={`text-slate-600 transition-transform ${marketsOpen ? "rotate-180" : ""}`} />
                    </button>
                    {marketsOpen && node.children.map((c) => (
                      <NavLink key={c.href} href={c.href} label={c.label} icon={c.icon} active={isActive(pathname, c.href)} indent />
                    ))}
                  </div>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="border-t border-white/[0.08] p-3">
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

      <main className="admin-main min-w-0 flex-1 lg:ml-60">
        {pathname !== "/admin/new" && (
          <div className="mx-auto w-full max-w-[1640px] px-3 pt-3 sm:px-6 lg:px-6">
            <Link
              href="/admin/new"
              className="group flex flex-col gap-3 rounded-lg border border-blue-400/20 bg-blue-500/[0.055] px-4 py-3 text-left shadow-[inset_0_1px_0_rgba(255,255,255,.04)] transition hover:border-blue-300/35 hover:bg-blue-500/[0.085] sm:flex-row sm:items-center sm:justify-between"
            >
              <span className="flex min-w-0 items-start gap-3">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-blue-300/20 bg-blue-400/10 text-blue-300">
                  <Icon name="auto_awesome" size={16} />
                </span>
                <span className="min-w-0">
                  <span className="block text-[12px] font-black text-white">New admin console is ready</span>
                  <span className="mt-0.5 block text-[10px] font-semibold text-slate-400">
                    Preview the redesigned Nezeem operations workspace before it replaces this console.
                  </span>
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-1.5 text-[10px] font-black text-blue-300 transition group-hover:text-white">
                Open new console <Icon name="arrow_forward" size={13} />
              </span>
            </Link>
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
