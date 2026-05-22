"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/icon";
import { useSupabaseAuth } from "@/lib/supabase/auth-context";

const TABS = [
  { href: "/p2p",          label: "Browse",          icon: "storefront" },
  { href: "/p2p/orders",   label: "My Orders",       icon: "receipt_long" },
  { href: "/p2p/merchant", label: "Merchant Center",  icon: "verified_user" },
];

export function P2PSubNav() {
  const pathname    = usePathname();
  const { isSignedIn } = useSupabaseAuth();

  // Determine active tab — order room counts as "My Orders"
  const effectivePath = pathname.startsWith("/p2p/order/") ? "/p2p/orders" : pathname;

  return (
    <div className="border-b border-white/[0.07] bg-[#0a0b0f]">
      <div className="flex w-full items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center">
          {TABS.map((t) => {
            const active = t.href === "/p2p"
              ? effectivePath === "/p2p"
              : effectivePath.startsWith(t.href);
            return (
              <Link
                key={t.href}
                href={t.href}
                className={`flex items-center gap-1.5 px-4 py-3.5 text-sm font-bold border-b-2 transition-all ${
                  active
                    ? "border-[#087cff] text-white"
                    : "border-transparent text-slate-500 hover:text-slate-300"
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
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#087cff]/10 border border-[#087cff]/20 text-[#087cff] text-xs font-black hover:bg-[#087cff]/20 transition-colors"
          >
            <Icon name="add_business" className="text-sm" />
            <span className="hidden sm:inline">Post Ad</span>
          </Link>
        )}
      </div>
    </div>
  );
}
