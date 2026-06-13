"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/icon";

const NAV = [
  { href: "/p2p", label: "Market", detail: "Browse verified offers", icon: "storefront" },
  { href: "/p2p/express", label: "Express", detail: "Auto-match instantly", icon: "bolt" },
  { href: "/p2p/orders", label: "Orders", detail: "Track settlements", icon: "receipt_long" },
  { href: "/p2p/merchant", label: "Merchant", detail: "Ads, escrow and rails", icon: "verified_user" },
];

export function P2PTerminalShell({
  children,
  title,
  eyebrow,
  description,
}: {
  children: React.ReactNode;
  title: string;
  eyebrow: string;
  description: string;
}) {
  const pathname = usePathname();

  return (
    <div className="flex h-full min-h-0 bg-[#06070a]">
      <aside className="hidden w-56 shrink-0 flex-col border-r border-white/[0.07] bg-[linear-gradient(180deg,#0d1017,#080a0f)] lg:flex">
        <div className="border-b border-white/[0.06] px-5 py-5">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500 text-white shadow-[0_10px_30px_rgba(8,124,255,.25)]">
              <Icon name="swap_horiz" className="text-[19px]" />
            </span>
            <div>
              <p className="text-xs font-black text-white">P2P Terminal</p>
              <p className="text-[8px] font-black uppercase tracking-[0.2em] text-emerald-400">Escrow online</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-1 p-3">
          <p className="mb-3 px-3 text-[8px] font-black uppercase tracking-[0.22em] text-slate-700">Workspace</p>
          {NAV.map((item) => {
            const active = item.href === "/p2p" ? pathname === "/p2p" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`group flex items-center gap-3 rounded-xl px-3 py-3 transition ${
                  active
                    ? "bg-blue-500/[0.12] text-white ring-1 ring-inset ring-blue-400/20"
                    : "text-slate-500 hover:bg-white/[0.04] hover:text-slate-200"
                }`}
              >
                <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${active ? "bg-blue-500 text-white" : "bg-white/[0.035] text-slate-600"}`}>
                  <Icon name={item.icon} className="text-[16px]" />
                </span>
                <span className="min-w-0">
                  <span className="block text-[11px] font-black">{item.label}</span>
                  <span className="mt-0.5 block truncate text-[8px] text-slate-600">{item.detail}</span>
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-white/[0.06] p-4">
          <div className="rounded-xl border border-emerald-400/10 bg-emerald-400/[0.04] p-3">
            <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-wider text-emerald-400">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
              Escrow protected
            </div>
            <p className="mt-1.5 text-[9px] leading-4 text-slate-600">Balances and active orders are checked before every match.</p>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="shrink-0 lg:hidden">
          <P2PMobileNavigation />
        </div>
        <header className="hidden shrink-0 items-center justify-between border-b border-white/[0.06] bg-[#090b10]/90 px-6 py-3 backdrop-blur lg:flex">
          <div>
            <p className="text-[8px] font-black uppercase tracking-[0.22em] text-blue-400">{eyebrow}</p>
            <h1 className="mt-0.5 text-lg font-black tracking-tight text-white">{title}</h1>
            <p className="text-[9px] text-slate-600">{description}</p>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-white/[0.07] bg-white/[0.025] px-3 py-1.5 text-[9px] font-black text-slate-500">
            <Icon name="shield" className="text-[13px] text-emerald-400" />
            LIVE RISK CHECKS
          </div>
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">{children}</main>
      </div>
    </div>
  );
}

function P2PMobileNavigation() {
  const pathname = usePathname();
  return (
    <div className="no-scrollbar flex gap-1 overflow-x-auto border-b border-white/[0.07] bg-[#0b0d13] p-2">
      {NAV.map((item) => {
        const active = item.href === "/p2p" ? pathname === "/p2p" : pathname.startsWith(item.href);
        return (
          <Link key={item.href} href={item.href} className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-[10px] font-black ${active ? "bg-blue-500 text-white" : "text-slate-500"}`}>
            <Icon name={item.icon} className="text-[14px]" />
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}
