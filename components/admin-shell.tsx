"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Icon } from "@/components/icon";

const NAV = [
  { href: "/admin",               label: "Dashboard",  icon: "home" },
  { href: "/admin/p2p",           label: "P2P",        icon: "handshake" },
  { href: "/admin/users",         label: "Users",      icon: "group" },
  { href: "/admin/withdrawals",   label: "Approvals",  icon: "pending_actions" },
  { href: "/admin/profits",       label: "Profits",    icon: "trending_up" },
];

export function AdminShell({ children, adminEmail }: { children: React.ReactNode; adminEmail?: string }) {
  const pathname = usePathname();
  const router = useRouter();

  async function exitAdmin() {
    await fetch("/api/admin/signout", { method: "POST" });
    router.push("/");
  }

  return (
    <div className="min-h-screen bg-[#08080c] text-white flex flex-col">
      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-[#08080c]/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4">
          {/* Brand */}
          <Link href="/admin" className="flex items-center gap-2 shrink-0">
            <div className="h-6 w-6 rounded-lg bg-[#087cff]" />
            <span className="text-sm font-black text-white">Nezeem Admin</span>
          </Link>

          {/* Divider */}
          <div className="h-5 w-px bg-white/10" />

          {/* Nav links */}
          <nav className="flex items-center gap-1">
            {NAV.map(({ href, label, icon }) => {
              const active = pathname === href || (href !== "/admin" && pathname.startsWith(href));
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
                    active
                      ? "bg-white/[0.08] text-white"
                      : "text-slate-500 hover:text-slate-300 hover:bg-white/[0.04]"
                  }`}
                >
                  <Icon name={icon} size={13} />
                  {label}
                </Link>
              );
            })}
          </nav>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Email + exit */}
          {adminEmail && (
            <span className="hidden text-xs text-slate-600 sm:block truncate max-w-[160px]">
              {adminEmail}
            </span>
          )}
          <button
            type="button"
            onClick={exitAdmin}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-500 hover:text-slate-300 hover:bg-white/[0.04] transition-colors shrink-0"
          >
            <Icon name="arrow_back" size={13} />
            Exit admin
          </button>
        </div>
      </header>

      {/* Page content */}
      <main className="flex-1">
        {children}
      </main>
    </div>
  );
}
