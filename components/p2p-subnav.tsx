"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon } from "@/components/icon";
import { useSupabaseAuth } from "@/lib/supabase/auth-context";
import { useNavBadge } from "@/lib/nav-badge-context";

const TABS = [
  {
    href: "/p2p",
    label: "P2P",
    icon: "storefront",
    match: (p: string, _tab: string) => p === "/p2p" || p.startsWith("/p2p/express"),
  },
  {
    href: "/p2p/orders",
    label: "Orders",
    icon: "receipt_long",
    match: (p: string, _tab: string) => p.startsWith("/p2p/orders") || p.startsWith("/p2p/order/"),
  },
  {
    href: "/p2p/merchant?tab=ads",
    label: "Ads",
    icon: "campaign",
    match: (p: string, tab: string) => p.startsWith("/p2p/merchant") && tab !== "profile",
  },
  {
    href: "/p2p/merchant?tab=profile",
    label: "Profile",
    icon: "person",
    match: (p: string, tab: string) => p.startsWith("/p2p/merchant") && tab === "profile",
  },
];

export function P2PSubNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab") ?? "";
  const { isSignedIn } = useSupabaseAuth();
  const navBadge = useNavBadge();
  const [orderCount, setOrderCount] = useState(0);

  useEffect(() => {
    if (!isSignedIn) {
      setOrderCount(0);
      navBadge?.setBadge("Orders", 0);
      return;
    }
    let cancelled = false;
    const tick = async () => {
      fetch("/api/p2p/merchant/profile", { method: "POST" }).catch(() => {});
      try {
        const r = await fetch("/api/p2p/orders/active-count");
        if (!r.ok) return;
        const d = (await r.json()) as { count?: number };
        const n = d.count ?? 0;
        if (!cancelled) {
          setOrderCount(n);
          navBadge?.setBadge("Orders", n);
        }
      } catch {
        /* ignore */
      }
    };
    tick();
    const id = setInterval(() => {
      if (document.visibilityState === "visible") tick();
    }, 60000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [isSignedIn, pathname, navBadge]);

  return (
    <div className="mx-auto hidden w-full max-w-6xl px-3 pt-2 sm:px-4 lg:block lg:px-3">
      <div className="flex w-full items-center justify-between rounded-lg border border-white/[0.06] bg-[#18191f] px-1.5 py-1">
        <div className="no-scrollbar flex items-center overflow-x-auto">
          {TABS.map((t) => {
            const active = t.match(pathname, tab);
            return (
              <Link
                key={t.href}
                href={t.href}
                prefetch={false}
                className={`relative flex h-9 items-center gap-2 rounded-md px-3 text-[13px] font-bold transition-all lg:h-8 lg:px-3 ${
                  active
                    ? "bg-[#087cff] text-white shadow-lg shadow-[#087cff]/20"
                    : "text-slate-500 hover:bg-white/[0.04] hover:text-slate-300"
                }`}
              >
                <Icon name={t.icon} fill={active} className="text-[16px]" />
                <span className="hidden sm:inline">{t.label}</span>
                {t.label === "Orders" && orderCount > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-[13px] min-w-[13px] items-center justify-center rounded-full bg-red-500 px-0.5 text-[8px] font-black leading-none text-white ring-1 ring-[#18191f]">
                    {orderCount > 9 ? "9+" : orderCount}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
