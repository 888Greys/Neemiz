"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Icon } from "@/components/icon";

const NAV = [
  { href: "/admin",             label: "Overview",    icon: "dashboard",          group: "Monitor" },
  { href: "/admin/activity",    label: "Activity",    icon: "monitoring",         group: "Monitor" },
  { href: "/admin/users",       label: "Customers",   icon: "groups",             group: "Operate" },
  { href: "/admin/p2p",         label: "P2P desk",    icon: "handshake",          group: "Operate" },
  { href: "/admin/withdrawals", label: "Approvals",   icon: "approval",           group: "Operate" },
  { href: "/admin/broadcast",   label: "Broadcast",   icon: "campaign",           group: "Operate" },
  { href: "/admin/profits",     label: "Finance",     icon: "account_balance",    group: "Analyze" },
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

        <nav className="flex gap-1 overflow-x-auto px-3 py-3 lg:flex-1 lg:flex-col lg:overflow-visible lg:px-3 lg:py-5">
            {NAV.map(({ href, label, icon, group }, index) => {
              const active = pathname === href || (href !== "/admin" && pathname.startsWith(href));
              const showGroup = index === 0 || NAV[index - 1].group !== group;
              return (
                <div key={href}>
                  {showGroup && <p className="mb-2 mt-5 hidden px-2 text-[9px] font-black uppercase tracking-[0.18em] text-slate-600 first:mt-0 lg:block">{group}</p>}
                  <Link
                    href={href}
                    className={`group flex shrink-0 items-center gap-3 rounded-lg px-2.5 py-2.5 transition-colors ${
                      active
                        ? "bg-[#087cff]/14 text-white ring-1 ring-inset ring-[#087cff]/30"
                        : "text-slate-500 hover:bg-white/[0.05] hover:text-slate-200"
                    }`}
                  >
                    <span className={`flex h-8 w-8 items-center justify-center rounded-md ${active ? "bg-[#087cff] text-white" : "bg-white/[0.04] text-slate-600 group-hover:text-slate-300"}`}>
                      <Icon name={icon} size={15} />
                    </span>
                    <span className="hidden min-w-0 lg:block">
                      <span className="block text-[11px] font-black">{label}</span>
                    </span>
                    <span className="text-[10px] font-bold lg:hidden">{label}</span>
                  </Link>
                </div>
              );
            })}
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
