"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/icon";
import { useSupabaseAuth } from "@/lib/supabase/auth-context";

const TABS = [
  { href: "/p2p",          label: "Browse",          icon: "storefront" },
  { href: "/p2p/express",  label: "Express",         icon: "bolt" },
  { href: "/p2p/orders",   label: "My Orders",       icon: "receipt_long" },
  { href: "/p2p/merchant", label: "Merchant Center",  icon: "verified_user" },
];

export function P2PSubNav() {
  const pathname    = usePathname();
  const { isSignedIn } = useSupabaseAuth();

  // Determine active tab — order room counts as "My Orders"
  const effectivePath = pathname.startsWith("/p2p/order/") ? "/p2p/orders" : pathname;

  return (
    <div className="w-full px-3 pt-2 sm:px-4 lg:px-3">
      <div className="flex w-full items-center justify-between rounded-lg border border-[#1e1e30] bg-[#111118] px-1.5 py-1">
        <div className="no-scrollbar flex items-center overflow-x-auto">
          {TABS.map((t) => {
            const active = t.href === "/p2p"
              ? effectivePath === "/p2p"
              : effectivePath.startsWith(t.href);
            return (
              <Link
                key={t.href}
                href={t.href}
                className={`flex h-9 items-center gap-2 rounded-md px-3 text-sm font-black transition-all lg:h-8 lg:px-3 lg:text-[13px] ${
                  active
                    ? "bg-[#087cff] text-white shadow-lg shadow-[#087cff]/20"
                    : "text-slate-500 hover:bg-white/[0.04] hover:text-slate-300"
                }`}
              >
                <Icon name={t.icon} fill={active} className="text-[16px]" />
                <span className="hidden sm:inline">{t.label}</span>
              </Link>
            );
          })}
        </div>

        {/* Post Ad shortcut — only on browse, only if signed in */}
        {effectivePath === "/p2p" && isSignedIn && (
          <Link
            href="/p2p/merchant"
            className="flex h-8 shrink-0 items-center gap-1.5 rounded-md bg-white/[0.06] px-3 text-xs font-black text-white/70 transition-colors hover:bg-white/[0.1] hover:text-white"
          >
            <Icon name="add_business" className="text-sm" />
            <span className="hidden sm:inline">Post Ad</span>
          </Link>
        )}
      </div>
    </div>
  );
}
