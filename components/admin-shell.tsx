"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Icon } from "@/components/icon";

const NAV = [
  { href: "/admin",             label: "Command center", detail: "Live platform overview", icon: "grid_view", group: "Overview" },
  { href: "/admin/activity",    label: "Product activity", detail: "Players and exposure", icon: "bar_chart", group: "Overview" },
  { href: "/admin/users",       label: "Users", detail: "Accounts and balances", icon: "groups", group: "Operations" },
  { href: "/admin/p2p",         label: "P2P operations", detail: "KYC, orders and wallets", icon: "handshake", group: "Operations" },
  { href: "/admin/withdrawals", label: "Approvals", detail: "Owner action queue", icon: "hourglass_top", group: "Operations" },
  { href: "/admin/profits",     label: "Finance", detail: "Cash flow and P&L", icon: "analytics", group: "Intelligence" },
];

export function AdminShell({ children, adminEmail }: { children: React.ReactNode; adminEmail?: string }) {
  const pathname = usePathname();
  const router = useRouter();

  async function exitAdmin() {
    await fetch("/api/admin/signout", { method: "POST" });
    router.push("/");
  }

  return (
    <div className="admin-root min-h-screen text-white lg:flex">
      <aside className="admin-sidebar border-b border-white/[0.07] lg:fixed lg:inset-y-0 lg:left-0 lg:z-40 lg:flex lg:w-60 lg:flex-col lg:border-b-0 lg:border-r">
        <div className="flex h-[72px] items-center justify-between border-b border-white/[0.06] px-4 lg:px-5">
          <Link href="/admin" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-gradient-to-br from-[#2692ff] to-[#075dd8] shadow-[0_10px_35px_rgba(8,124,255,.28)]">
              <Icon name="bolt" size={18} />
            </div>
            <div>
              <span className="block text-[13px] font-black tracking-tight">Nezeem Control</span>
              <span className="block text-[8px] font-black uppercase tracking-[0.24em] text-blue-400">Owner command</span>
            </div>
          </Link>
          <span className="flex items-center gap-1.5 rounded-full border border-emerald-400/15 bg-emerald-400/[0.06] px-2 py-1 text-[8px] font-black uppercase tracking-widest text-emerald-400">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" /> Live
          </span>
        </div>

        <nav className="flex gap-1 overflow-x-auto px-3 py-3 lg:flex-1 lg:flex-col lg:overflow-visible lg:px-3 lg:py-5">
            {NAV.map(({ href, label, detail, icon, group }, index) => {
              const active = pathname === href || (href !== "/admin" && pathname.startsWith(href));
              const showGroup = index === 0 || NAV[index - 1].group !== group;
              return (
                <div key={href}>
                  {showGroup && <p className="mb-2 mt-4 hidden px-3 text-[8px] font-black uppercase tracking-[0.22em] text-slate-700 first:mt-0 lg:block">{group}</p>}
                  <Link
                    href={href}
                    className={`group flex shrink-0 items-center gap-3 rounded-[14px] px-3 py-2.5 transition-all ${
                      active
                        ? "bg-blue-500/[0.12] text-white ring-1 ring-inset ring-blue-400/20 shadow-[0_12px_30px_rgba(0,0,0,.18)]"
                        : "text-slate-500 hover:bg-white/[0.04] hover:text-slate-200"
                    }`}
                  >
                    <span className={`flex h-8 w-8 items-center justify-center rounded-[10px] ${active ? "bg-blue-500 text-white shadow-[0_8px_20px_rgba(8,124,255,.25)]" : "bg-white/[0.035] text-slate-600 group-hover:text-slate-300"}`}>
                      <Icon name={icon} size={15} />
                    </span>
                    <span className="hidden min-w-0 lg:block">
                      <span className="block text-[11px] font-black">{label}</span>
                      <span className="mt-0.5 block truncate text-[8px] font-medium text-slate-600">{detail}</span>
                    </span>
                    <span className="text-[10px] font-bold lg:hidden">{label}</span>
                  </Link>
                </div>
              );
            })}
        </nav>

        <div className="hidden border-t border-white/[0.06] p-3 lg:block">
          <div className="mb-3 rounded-[14px] border border-white/[0.06] bg-white/[0.025] p-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-blue-500 text-[10px] font-black">OW</div>
              <div className="min-w-0">
                <p className="truncate text-[10px] font-black text-slate-300">{adminEmail}</p>
                <p className="mt-0.5 text-[8px] uppercase tracking-widest text-emerald-400">Secure owner session</p>
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
