"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Icon } from "@/components/icon";

const NAV = [
  { href: "/admin",             label: "Command center", icon: "grid_view" },
  { href: "/admin/activity",    label: "Product activity", icon: "bar_chart" },
  { href: "/admin/users",       label: "Users",          icon: "groups" },
  { href: "/admin/p2p",         label: "P2P operations", icon: "handshake" },
  { href: "/admin/withdrawals", label: "Approvals",      icon: "hourglass_top" },
  { href: "/admin/profits",     label: "Finance",        icon: "analytics" },
];

export function AdminShell({ children, adminEmail }: { children: React.ReactNode; adminEmail?: string }) {
  const pathname = usePathname();
  const router = useRouter();

  async function exitAdmin() {
    await fetch("/api/admin/signout", { method: "POST" });
    router.push("/");
  }

  return (
    <div className="min-h-screen bg-[#050608] text-white lg:flex">
      <aside className="border-b border-white/[0.06] bg-[#090b10] lg:fixed lg:inset-y-0 lg:left-0 lg:z-40 lg:flex lg:w-64 lg:flex-col lg:border-b-0 lg:border-r">
        <div className="flex h-16 items-center justify-between px-4 lg:px-5">
          <Link href="/admin" className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#087cff] shadow-[0_0_30px_rgba(8,124,255,.25)]">
              <Icon name="bolt" size={18} />
            </div>
            <div>
              <span className="block text-sm font-black tracking-tight">Nezeem Control</span>
              <span className="block text-[9px] font-bold uppercase tracking-[0.2em] text-emerald-400">Owner terminal</span>
            </div>
          </Link>
          <span className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Live
          </span>
        </div>

        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-1 lg:flex-col lg:overflow-visible lg:py-5">
            {NAV.map(({ href, label, icon }) => {
              const active = pathname === href || (href !== "/admin" && pathname.startsWith(href));
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-bold transition-colors ${
                    active
                      ? "bg-[#087cff]/15 text-[#62aeff] ring-1 ring-inset ring-[#087cff]/20"
                      : "text-slate-500 hover:bg-white/[0.04] hover:text-slate-300"
                  }`}
                >
                  <Icon name={icon} size={16} />
                  {label}
                </Link>
              );
            })}
        </nav>

        <div className="hidden border-t border-white/[0.06] p-4 lg:block">
          <p className="truncate text-[11px] font-bold text-slate-400">{adminEmail}</p>
          <p className="mb-3 mt-0.5 text-[9px] uppercase tracking-widest text-slate-700">2FA protected session</p>
          <button
            type="button"
            onClick={exitAdmin}
            className="flex w-full items-center gap-2 rounded-xl bg-white/[0.03] px-3 py-2.5 text-xs font-bold text-slate-500 transition hover:bg-white/[0.06] hover:text-white"
          >
            <Icon name="arrow_back" size={13} />
            Exit admin
          </button>
        </div>
      </aside>

      <main className="min-w-0 flex-1 lg:ml-64">{children}</main>
    </div>
  );
}
