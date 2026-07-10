"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useSupabaseAuth } from "@/lib/supabase/auth-context";
import { getMobileNav } from "@/lib/mock-data";
import { BrandLogo } from "@/components/brand-logo";
import { Icon } from "@/components/icon";
import { toast } from "@/lib/toast";
import { NotificationsBell } from "@/components/notifications-dropdown";
import { BroadcastBanner } from "@/components/broadcast-banner";
import { AuthModalContext } from "@/lib/auth-modal-context";
import { BetslipProvider, useBetslip } from "@/lib/betslip-context";
import { useWalletBalance } from "@/lib/use-wallet-balance";
import type { ProfileView } from "@/components/profile-modal";
import { MONEY_LOCALE, CURRENCY_SYMBOL } from "@/lib/currency";
import { useMoney } from "@/lib/currency-context";
import { CurrencySwitcher } from "@/components/currency-switcher";
import { peekPendingPromo, redeemPromoClient } from "@/lib/pending-promo";
import { PromoSuccessHost, showPromoSuccess } from "@/components/promo-success";
import { NavBadgeContext } from "@/lib/nav-badge-context";
import { PhonePromptModal } from "@/components/phone-prompt-modal";

const LoginModal = dynamic(
  () => import("@/components/login-modal").then((mod) => mod.LoginModal),
  { ssr: false },
);
const RegisterModal = dynamic(
  () => import("@/components/register-modal").then((mod) => mod.RegisterModal),
  { ssr: false },
);
const ProfileModal = dynamic(
  () => import("@/components/profile-modal").then((mod) => mod.ProfileModal),
  { ssr: false },
);
const WalletSheet = dynamic(
  () => import("@/components/wallet-sheet").then((mod) => mod.WalletSheet),
  { ssr: false },
);

const tempAssets = {
  appInstall: "https://v3.bundlecdn.com/b02632/plain/bonus/app-install/phone-small-v1.png",
  freebet: "https://v3.bundlecdn.com/b02632/plain/betting/brand-freebet.png",
};

type AppShellProps = {
  children: React.ReactNode;
  rightPanel?: React.ReactNode;
  mainBg?: string;
  hideFooter?: boolean;
  fullHeight?: boolean;
  hideSidebar?: boolean;
};

export function AppShell({ children, rightPanel, mainBg, hideFooter = false, fullHeight = false, hideSidebar = true }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  // Bottom-nav tab set is section-aware (binary gets Markets/Trade/Positions);
  // `currentPanel` drives active-state for same-route panel tabs.
  const mobileNav = getMobileNav(pathname);
  const currentPanel = searchParams.get("panel") ?? "";
  const currentTab = searchParams.get("tab") ?? "";
  const isLogin = pathname === "/login";
  const isSportsPage = pathname.startsWith("/sports");
  const { isSignedIn, user } = useSupabaseAuth();
  const meta = user?.user_metadata ?? {};
  const displayName = meta.username ?? meta.first_name ?? user?.email?.split("@")[0] ?? "User";
  const initials = displayName.charAt(0).toUpperCase();
  const avatarUrl = typeof meta.avatar_url === "string" ? meta.avatar_url : typeof meta.picture === "string" ? meta.picture : null;
  const { balance, currency } = useWalletBalance();
  const money = useMoney();
  // KES is the canonical ledger balance — convert it to the user's chosen
  // display currency. Non-KES (crypto) balances are shown in their own unit.
  const fmtBalance = isSignedIn
    ? (currency === "KES"
        ? money.format(balance)
        : `${currency} ${balance.toLocaleString(MONEY_LOCALE, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
    : null;
  // Start collapsed on both server and first client render to avoid a hydration
  // mismatch, then sync the persisted preference from localStorage after mount.
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  useEffect(() => {
    const stored = localStorage.getItem("sidebar-collapsed");
    if (stored !== null) setSidebarCollapsed(stored === "true");
  }, []);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loginOpen, setLoginOpen]             = useState(false);
  const [registerOpen, setRegisterOpen]       = useState(false);
  const [profileOpen, setProfileOpen]         = useState(false);
  const [profileInitialView, setProfileInitialView] = useState<ProfileView | undefined>(undefined);
  const [walletOpen, setWalletOpen]           = useState(false);
  const [walletInitialTab, setWalletInitialTab] = useState<"home" | "deposit" | "send" | "withdraw" | "history">("home");
  // Optimistic nav target: highlight the tapped tab instantly (before the route
  // actually arrives), then fall back to the real pathname once it lands.
  const [pendingPath, setPendingPath]         = useState<string | null>(null);
  const [navBadges, setNavBadges]             = useState<Record<string, number>>({});
  const [checkingPhone, setCheckingPhone]     = useState(false);
  const [missingPhone, setMissingPhone]       = useState(false);

  useEffect(() => {
    if (isSignedIn && user) {
      const hasPhoneInAuth = !!(user.phone || user.user_metadata?.phone_number || user.email?.endsWith("@phone.nezeem.com"));
      if (hasPhoneInAuth) {
        setMissingPhone(false);
        return;
      }

      setCheckingPhone(true);
      fetch("/api/account/mpesa")
        .then(async (res) => {
          // A 401 here means the server doesn't see a valid session even though
          // the client thinks it's signed in (stale/expired session cookie). That
          // is NOT "missing phone" — don't pop the Link-Phone modal on it, or the
          // user gets a spurious prompt that then fails with "Unauthorized".
          if (res.status === 401) { setMissingPhone(false); return; }
          if (!res.ok) return; // transient server error — leave state unchanged
          const data = await res.json().catch(() => ({}));
          setMissingPhone(!data.phone);
        })
        .catch(() => {})
        .finally(() => setCheckingPhone(false));
    } else {
      setMissingPhone(false);
    }
  }, [isSignedIn, user]);

  // Apply a promo code stashed at signup (e.g. OAuth redirect) once the session is live.
  useEffect(() => {
    if (!isSignedIn) return;
    if (!peekPendingPromo()) return;
    let cancelled = false;
    void (async () => {
      const result = await redeemPromoClient();
      if (cancelled || !result.ok || !result.amount || !result.code) return;
      showPromoSuccess({ amount: result.amount, code: result.code });
    })();
    return () => { cancelled = true; };
  }, [isSignedIn]);

  const handlePhoneComplete = useCallback((phone: string) => {
    setMissingPhone(false);
    window.dispatchEvent(new CustomEvent("wallet-refresh"));
  }, []);
  const setNavBadge = useCallback((key: string, count: number) => {
    setNavBadges((current) => {
      const nextCount = Math.max(0, Math.floor(count));
      if ((current[key] ?? 0) === nextCount) return current;
      if (nextCount === 0) {
        const { [key]: _, ...rest } = current;
        return rest;
      }
      return { ...current, [key]: nextCount };
    });
  }, []);
  const navBadgeContext = useMemo(
    () => ({ badges: navBadges, setBadge: setNavBadge }),
    [navBadges, setNavBadge],
  );

  function openProfile(view?: ProfileView) {
    setProfileInitialView(view);
    setProfileOpen(true);
  }

  function openWallet(tab: "home" | "deposit" | "send" | "withdraw" | "history" = "home") {
    setWalletInitialTab(tab);
    setWalletOpen(true);
  }

  const toggleSidebar = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("sidebar-collapsed", String(next));
      return next;
    });
  };

  const mainRef = useRef<HTMLElement>(null);
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0, behavior: "instant" });
    setPendingPath(null); // route arrived — clear the optimistic highlight
  }, [pathname]);

  if (isLogin) return <>{children}</>;

  return (
    <BetslipProvider>
    <AuthModalContext.Provider value={{ openLogin: () => setLoginOpen(true), openRegister: () => setRegisterOpen(true), openWallet: () => setWalletOpen(true) }}>
    <NavBadgeContext.Provider value={navBadgeContext}>
    <div className="min-h-screen overflow-x-hidden bg-background text-on-surface">
      <header className="fixed left-0 right-0 top-0 z-50 flex h-14 max-w-[100vw] items-center overflow-visible border-b border-white/[0.06] bg-[#151518] px-3 lg:h-20 lg:px-0">
        {!hideSidebar && (
        <div
          className={`hidden h-full shrink-0 items-center border-r border-white/10 px-3 transition-[width] duration-300 ease-out lg:flex ${
            sidebarCollapsed ? "w-[78px] justify-center" : "w-[280px] gap-2"
          }`}
        >
          {sidebarCollapsed ? (
            <button
              onClick={toggleSidebar}
              type="button"
              title="Expand sidebar"
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#34363b] text-slate-300 transition hover:bg-[#424550] hover:text-white"
            >
              <Icon name="keyboard_double_arrow_right" className="text-[20px]" />
            </button>
          ) : isSignedIn ? (
            <button onClick={() => setProfileOpen(true)} type="button" className="flex min-w-0 flex-1 items-center gap-2.5 rounded-xl px-2 py-2 transition hover:bg-white/[0.05]">
              <UserAvatar src={avatarUrl} initials={initials} className="h-9 w-9 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-black text-white">{displayName}</div>
                <div className="truncate text-[10px] text-slate-500">ID {user?.id?.slice(-8).toUpperCase()}</div>
              </div>
            </button>
          ) : (
            <button onClick={() => setLoginOpen(true)} className="flex min-w-0 flex-1 items-center gap-2.5 rounded-xl text-left transition hover:bg-white/[0.03] px-2 py-2" type="button">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#34363b] text-slate-300">
                <Icon name="person" fill className="text-[22px]" />
              </span>
              <span className="flex-1 text-[13px] font-black">Log in</span>
            </button>
          )}
          {!sidebarCollapsed && (
            <button
              onClick={toggleSidebar}
              type="button"
              title="Collapse sidebar"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.05] text-slate-400 transition hover:bg-white/[0.1] hover:text-white"
            >
              <Icon name="keyboard_double_arrow_left" className="text-[20px]" />
            </button>
          )}
        </div>
        )}

        <div className="flex min-w-0 flex-1 items-center justify-between gap-2 lg:gap-5 lg:px-6">
          <div className="flex min-w-0 items-center gap-6">
            <BrandLogo href="/dashboard" size="sm" />
            <nav className="hidden items-center gap-0.5 rounded-2xl bg-[#18191d] p-1 ring-1 ring-white/[0.06] text-sm font-black md:flex">
              <TopNavLink href="/dashboard" icon="home" label="Home" pathname={pathname} />
              <TopNavLink href="/sports" icon="sports_soccer" label="Sports" pathname={pathname} />
              <TopNavLink href="/p2p" icon="swap_horiz" label="P2P" pathname={pathname} />
              <TopNavLink href="/aviator" icon="rocket_launch" label="Aviator" pathname={pathname} />
              <TopNavLink href="/predictions" icon="online_prediction" label="Polymarket" pathname={pathname} />
              <TopNavLink href="/binary" icon="candlestick_chart" label="Binary" pathname={pathname} />
              <TopNavLink href="/forex" icon="currency_exchange" label="Forex" pathname={pathname} />
            </nav>
          </div>
          {isSignedIn ? (
            <div className="flex shrink-0 items-center gap-2">
              <div className="flex items-center rounded-2xl bg-[#18191d] ring-1 ring-white/[0.07]">
                {/* Balance → floating wallet (deposit, withdraw, send, history) */}
                <button
                  type="button"
                  onClick={() => openWallet()}
                  className="flex items-center gap-1.5 rounded-2xl px-2.5 py-1.5 sm:px-4 sm:py-2 transition hover:bg-[#22242a]"
                >
                  <Icon name="account_balance_wallet" fill className="text-[15px] text-[#087cff]" />
                  <span className="hidden text-sm font-black text-white sm:inline">{fmtBalance}</span>
                </button>
                {/* Quick deposit shortcut */}
                <button
                  type="button"
                  onClick={() => openWallet()}
                  className="my-1 mr-1 hidden rounded-lg bg-emerald-800 px-2.5 py-1 text-xs font-black text-emerald-100 transition hover:bg-emerald-700 sm:inline"
                >
                  Deposit
                </button>
              </div>
              <div className="hidden md:block">
                <CurrencySwitcher />
              </div>
              <NotificationsBell />
              {/* Profile entry point — needed on desktop when the sidebar (which
                  used to hold the avatar) is hidden. */}
              {hideSidebar && (
                <button
                  type="button"
                  onClick={() => setProfileOpen(true)}
                  title="Profile"
                  className="hidden lg:block shrink-0 rounded-full ring-1 ring-white/[0.07] transition hover:ring-white/20"
                >
                  <UserAvatar src={avatarUrl} initials={initials} className="h-9 w-9" />
                </button>
              )}
            </div>
          ) : (
            <div className="flex min-w-0 shrink-0 items-center gap-1.5 sm:gap-2 md:gap-3">
              <button
                onClick={() => setLoginOpen(true)}
                className="rounded-lg bg-white/[0.06] px-2.5 py-2 text-[11px] font-black text-slate-200 ring-1 ring-white/[0.08] transition hover:bg-white/[0.1] hover:text-white active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20 focus-visible:ring-offset-2 focus-visible:ring-offset-[#151518] sm:px-3 sm:text-xs md:rounded-2xl md:px-6 md:py-3 md:text-base"
                type="button"
              >
                Login
              </button>
              <button
                onClick={() => setRegisterOpen(true)}
                className="rounded-lg bg-emerald-800 px-2.5 py-2 text-[11px] font-black text-emerald-50 transition hover:bg-emerald-700 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#151518] sm:px-3 sm:text-xs md:rounded-2xl md:px-6 md:py-3 md:text-base"
                type="button"
              >
                <span className="sm:hidden">Join</span>
                <span className="hidden sm:inline">Registration</span>
              </button>
            </div>
          )}
        </div>
      </header>

      <div className="flex h-screen overflow-hidden pt-14 lg:pt-20">
        {!hideSidebar && (
        <aside
          className={`hidden shrink-0 overflow-hidden border-r border-white/[0.06] bg-[#151518] transition-[width] duration-300 ease-out lg:block ${
            sidebarCollapsed ? "w-[78px]" : "w-[280px]"
          }`}
        >
          <Sidebar collapsed={sidebarCollapsed} onToggle={toggleSidebar} pathname={pathname} onOpenWallet={() => openWallet()} onOpenBonuses={() => openProfile("bonuses")} onOpenProfile={() => { setProfileInitialView(undefined); setProfileOpen(true); }} />
        </aside>
        )}

        <main ref={mainRef} data-app-scroll="true" className={`no-scrollbar min-w-0 flex-1 overflow-x-hidden overflow-y-auto lg:pl-3 lg:pb-0 ${fullHeight ? "pb-14 lg:overflow-hidden" : "pb-32"} ${mainBg ?? "bg-background"}`}>
          {fullHeight ? (
            <div className="h-full min-w-0 max-w-full overflow-x-hidden lg:h-[calc(100vh-5rem)]">{children}</div>
          ) : (
            <div className="flex min-h-screen min-w-0 max-w-full flex-col overflow-x-hidden">
              <BroadcastBanner />
              <div className="min-w-0 flex-1">{children}</div>
              {!hideFooter && <AppFooter />}
            </div>
          )}
        </main>

        {rightPanel && (
          <aside className="hidden w-80 shrink-0 border-l border-white/[0.06] bg-[#151518] lg:flex">
            {rightPanel}
          </aside>
        )}
      </div>

      {loginOpen && <LoginModal onClose={() => setLoginOpen(false)} onSwitchToRegister={() => { setLoginOpen(false); setRegisterOpen(true); }} />}
      {registerOpen && <RegisterModal onClose={() => setRegisterOpen(false)} onSwitchToLogin={() => { setRegisterOpen(false); setLoginOpen(true); }} />}
      {profileOpen && <ProfileModal onClose={() => { setProfileOpen(false); setProfileInitialView(undefined); }} onOpenWallet={(tab) => { setProfileOpen(false); openWallet(tab); }} initialView={profileInitialView} />}
      {walletOpen && <WalletSheet onClose={() => setWalletOpen(false)} initialTab={walletInitialTab} />}
      <PromoSuccessHost />
      {mobileMenuOpen && <MobileMenuDrawer onClose={() => setMobileMenuOpen(false)} onOpenLogin={() => { setMobileMenuOpen(false); setLoginOpen(true); }} onOpenRegister={() => { setMobileMenuOpen(false); setRegisterOpen(true); }} onOpenProfile={() => { setMobileMenuOpen(false); setProfileInitialView(undefined); setProfileOpen(true); }} />}
      {missingPhone && <PhonePromptModal onComplete={handlePhoneComplete} />}

      {rightPanel && isSportsPage && <MobileBetslipSheet>{rightPanel}</MobileBetslipSheet>}
      <nav className="fixed bottom-0 left-0 right-0 z-50 flex h-14 items-center justify-around border-t border-white/[0.06] bg-[#151518] px-1 lg:hidden">
        {mobileNav.map((item) => {
          const activePath = item.activePath ?? (item.href ?? "").split("?")[0].split("#")[0];
          // Panel tabs (binary's Markets/Trade/Positions) share one route and are
          // distinguished by the `?panel=` value, so match on panel rather than
          // path — otherwise every same-route tab would light up at once.
          // Tab tabs (Sports / Live) work the same way via `?tab=`.
          const isPanelTab = item.panel !== undefined;
          const isQueryTab = item.tab !== undefined;
          const active = isPanelTab
            ? pathname.startsWith(activePath) && currentPanel === item.panel
            : isQueryTab
              ? pathname.startsWith(activePath) && currentTab === item.tab
              : activePath === (pendingPath ?? pathname);
          const navigating = !isPanelTab && !isQueryTab && pendingPath === activePath && pathname !== activePath;
          if (item.label === "Menu") {
            return (
              <button key={item.label} className="flex h-full min-w-0 flex-1 flex-col items-center justify-center rounded text-[9px] text-on-surface-variant focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#087cff]/70 focus-visible:ring-inset" onClick={() => setMobileMenuOpen(true)} type="button">
                <Icon name={item.icon} className="text-[20px]" />
                <span className="mt-0.5 font-bold leading-none">{item.label}</span>
              </button>
            );
          }

          if (item.action === "wallet") {
            return (
              <button
                key={item.label}
                type="button"
                className="flex h-full min-w-0 flex-1 flex-col items-center justify-center rounded text-[9px] text-on-surface-variant focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#087cff]/70 focus-visible:ring-inset"
                onClick={() => openWallet()}
              >
                <Icon name={item.icon} className="text-[20px]" />
                <span className="mt-0.5 font-bold leading-none">{item.label}</span>
              </button>
            );
          }


          return (
            <Link
              key={item.label}
              href={item.href ?? "/"}
              prefetch={false}
              onClick={() => { if (activePath !== pathname) setPendingPath(activePath); }}
              className={`flex h-full min-w-0 flex-1 flex-col items-center justify-center rounded text-[9px] transition-colors duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#087cff]/70 focus-visible:ring-inset ${active ? "text-[#087cff]" : "text-on-surface-variant"}`}
            >
              <span className="relative">
                <Icon name={item.icon} fill={active} className={`text-[20px] ${navigating ? "animate-pulse" : ""}`} />
                {(navBadges[item.panel ?? item.label] ?? 0) > 0 && (
                  <span className="absolute -right-2 -top-2 grid min-w-4 h-4 place-items-center rounded-full bg-red-500 px-1 text-[9px] font-black leading-none text-white ring-2 ring-[#151518]">
                    {(navBadges[item.panel ?? item.label] ?? 0) > 99 ? "99+" : navBadges[item.panel ?? item.label]}
                  </span>
                )}
              </span>
              <span className="mt-0.5 max-w-full truncate font-bold leading-none">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
    </NavBadgeContext.Provider>
    </AuthModalContext.Provider>
    </BetslipProvider>
  );
}

function TopNavLink({ href, icon, label, pathname }: { href: string; icon: string; label: string; pathname: string }) {
  const router = useRouter();
  const active = href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href);

  return (
    <Link
      href={href}
      prefetch={false}
      onPointerEnter={() => router.prefetch(href)}
      onFocus={() => router.prefetch(href)}
      className={`flex items-center gap-1.5 rounded-xl px-4 py-2.5 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#087cff]/70 focus-visible:ring-offset-1 focus-visible:ring-offset-[#18191d] ${
        active
          ? "bg-gradient-to-b from-[#2b8bff] to-[#0a6ef0] text-white ring-1 ring-inset ring-white/15"
          : "text-slate-400 hover:bg-white/[0.06] hover:text-white"
      }`}
    >
      <Icon name={icon} fill={active} className="text-[17px]" />
      {label}
    </Link>
  );
}

function UserAvatar({ src, initials, className }: { src?: string | null; initials: string; className: string }) {
  if (src) {
    return (
      <img
        src={src}
        alt=""
        referrerPolicy="no-referrer"
        className={`${className} rounded-full object-cover`}
      />
    );
  }

  return (
    <span className={`${className} flex items-center justify-center rounded-full bg-[#087cff] text-sm font-black text-white`}>
      {initials}
    </span>
  );
}

function Sidebar({ collapsed, onToggle, onOpenWallet, onOpenBonuses, onOpenProfile, pathname }: { collapsed: boolean; onToggle: () => void; onOpenWallet: () => void; onOpenBonuses: () => void; onOpenProfile: () => void; pathname: string }) {
  const [openGroups, setOpenGroups] = useState({
    sports: true,
    p2p: false,
  });

  const toggleGroup = (group: keyof typeof openGroups) => {
    setOpenGroups((current) => ({ ...current, [group]: !current[group] }));
  };

  return (
    <div className="relative flex h-full flex-col">

      <div className={`no-scrollbar flex-1 overflow-y-auto py-5 ${collapsed ? "px-2" : "px-4"}`}>
        {/* Sports */}
        <SidebarGroup collapsed={collapsed} icon="sports_soccer" isOpen={openGroups.sports} onToggle={() => toggleGroup("sports")} title="Sports">
          <SidebarItem collapsed={collapsed} href="/sports" icon="sports_soccer" label="Sports" pathname={pathname} suppressActive />
          <SidebarItem collapsed={collapsed} href="/sports?tab=live" icon="sensors" label="Live" pathname={pathname} suppressActive />
          <SidebarItem collapsed={collapsed} href="/my-bets" icon="receipt_long" label="My Bets" pathname={pathname} />
        </SidebarGroup>

        {/* Aviator */}
        <StandaloneSidebarItem collapsed={collapsed} href="/aviator" icon="rocket_launch" label="Aviator" pathname={pathname} badge="HOT" />

        {/* Lucky Spin */}
        <StandaloneSidebarItem collapsed={collapsed} href="/lucky-spin" icon="casino" label="Lucky Spin" pathname={pathname} />

        {/* Polymarket */}
        <StandaloneSidebarItem collapsed={collapsed} href="/polymarket" icon="online_prediction" label="Polymarket" pathname={pathname} />

        {/* P2P */}
        <SidebarGroup collapsed={collapsed} icon="swap_horiz" isOpen={openGroups.p2p} onToggle={() => toggleGroup("p2p")} title="P2P">
          <SidebarItem collapsed={collapsed} href="/p2p" icon="storefront" label="Browse Ads" pathname={pathname} direct />
          <SidebarItem collapsed={collapsed} href="/p2p/merchant" icon="verified_user" label="Merchant Center" pathname={pathname} direct />
          <SidebarItem collapsed={collapsed} href="/p2p/orders" icon="receipt_long" label="My Orders" pathname={pathname} direct />
        </SidebarGroup>

        {/* Trading */}
        <StandaloneSidebarItem collapsed={collapsed} href="/binary" icon="candlestick_chart" label="Binary" pathname={pathname} />
        <StandaloneSidebarItem collapsed={collapsed} href="/forex" icon="currency_exchange" label="Forex" pathname={pathname} />

        <div className={`${collapsed ? "mx-1" : "-mx-4"} my-4 border-t border-white/10`} />

        {/* Utility */}
        <div className="space-y-1">
          <StandaloneSidebarItem collapsed={collapsed} href="/wallet" icon="account_balance_wallet" label="Wallet" pathname={pathname} onClick={onOpenWallet} />
          <StandaloneSidebarItem collapsed={collapsed} href="/wallet" icon="redeem" label="Bonuses" pathname={pathname} badge="1" onClick={onOpenBonuses} />
          <StandaloneSidebarItem collapsed={collapsed} href="/dashboard" icon="campaign" label="Promotions" pathname={pathname} onClick={() => toast.info("Promotions", "Seasonal promotions and free bets are launching soon!")} />
        </div>
      </div>

      <div className={`border-t border-white/10 ${collapsed ? "p-2" : "p-4"}`}>
        <button
          type="button"
          onClick={() => toast.info("Nezeem for Windows", "The desktop app is coming soon! You'll be notified on launch.")}
          className={`mb-2 flex w-full items-center rounded-2xl bg-[#32343b] transition hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:ring-offset-1 focus-visible:ring-offset-[#1b1c20] ${collapsed ? "justify-center p-2" : "gap-2.5 p-2.5"}`}
        >
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-500 bg-cover bg-center text-white"
            style={{ backgroundImage: `url(${tempAssets.appInstall})` }}
          >
            <Icon name="desktop_windows" fill className="text-[21px]" />
          </span>
          {!collapsed && (
            <>
              <span className="min-w-0 flex-1 text-left">
                <span className="block text-xs font-black leading-4">Nezeem for Windows</span>
                <span className="block text-[11px] leading-4 text-slate-300">Instant access to the platform</span>
              </span>
              <Icon name="chevron_right" className="text-[22px] text-slate-300" />
            </>
          )}
        </button>

        <button
          type="button"
          onClick={onOpenProfile}
          className={`flex w-full items-center rounded-2xl bg-white/[0.03] ring-1 ring-white/[0.07] transition hover:bg-white/[0.04] ${
            collapsed ? "justify-center p-2" : "gap-3 px-3 py-2.5"
          }`}
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#087cff]/15 text-[#75b8ff]">
            <Icon name="person" fill className="text-[18px]" />
          </span>
          {!collapsed && (
            <>
              <span className="min-w-0 flex-1 text-left">
                <span className="block text-[13px] font-black text-white">Profile</span>
                <span className="block text-[10px] font-bold text-slate-500">Account & security</span>
              </span>
              <Icon name="chevron_right" className="text-[16px] text-slate-600" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}

function SidebarGroup({
  collapsed,
  icon,
  isOpen,
  onToggle,
  title,
  children,
}: {
  collapsed: boolean;
  icon: string;
  isOpen: boolean;
  onToggle: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-3">
      <button
        className={`mb-1 flex w-full items-center rounded-lg text-left text-slate-200 transition hover:bg-white/[0.04] ${
          collapsed ? "justify-center p-1.5" : "gap-2 px-2 py-1"
        }`}
        onClick={onToggle}
        type="button"
        aria-expanded={isOpen}
      >
        <span className="flex h-6 w-6 items-center justify-center text-slate-400">
          <Icon name={icon} fill className="text-[18px]" />
        </span>
        {!collapsed && (
          <>
            <span className="flex-1 text-[12px] font-black uppercase tracking-wide text-slate-400">{title}</span>
            <Icon name={isOpen ? "keyboard_arrow_up" : "keyboard_arrow_down"} className="text-[16px] text-slate-500" />
          </>
        )}
      </button>
      <div className={`overflow-hidden transition-all duration-200 ease-out ${isOpen ? "max-h-[280px] opacity-100" : "max-h-0 opacity-0"}`}>
        <div className={collapsed ? "space-y-0.5" : "ml-3 space-y-0.5 border-l border-white/10 pl-3"}>{children}</div>
      </div>
    </section>
  );
}

function SidebarItem({
  collapsed,
  href,
  icon,
  label,
  pathname,
  badge,
  direct,
  highlight,
  isOpen,
  muted,
  onToggle,
  suppressActive,
}: {
  collapsed: boolean;
  href: string;
  icon: string;
  label: string;
  pathname: string;
  badge?: string;
  direct?: boolean;
  highlight?: boolean;
  isOpen?: boolean;
  muted?: boolean;
  onToggle?: () => void;
  suppressActive?: boolean;
}) {
  const active = !suppressActive && (href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href.split("?")[0]));
  const content = (
    <>
      <Icon name={icon} fill={active || highlight} className={`text-[18px] ${highlight && !active ? "text-violet-400" : "text-slate-400"}`} />
      {!collapsed && (
        <>
          <span className="min-w-0 flex-1 whitespace-nowrap text-[12px]">{label}</span>
          {badge && <span className="rounded-full bg-[#ff1979] px-1.5 py-0.5 text-[9px] font-black text-white">{badge}</span>}
          <Icon name={direct ? "chevron_right" : isOpen === undefined ? "chevron_right" : isOpen ? "keyboard_arrow_up" : "keyboard_arrow_down"} className="text-[16px] text-slate-500" />
        </>
      )}
    </>
  );
  const className = `flex items-center rounded-lg font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#087cff]/70 focus-visible:ring-offset-1 focus-visible:ring-offset-[#1b1c20] ${
    collapsed ? "justify-center px-1.5 py-2" : "gap-2 px-2 py-1.5"
  } ${
    active && !muted
      ? "bg-[#3a3b41] text-white"
      : muted
        ? "pointer-events-none text-slate-500 opacity-50"
        : highlight && !active
          ? "text-violet-300 hover:bg-violet-500/10 hover:text-violet-200"
          : "text-slate-300 hover:bg-white/[0.05] hover:text-white"
  }`;

  if (onToggle) {
    return (
      <button
        className={`${className} w-full text-left`}
        onClick={onToggle}
        title={collapsed ? label : undefined}
        type="button"
        aria-expanded={isOpen}
      >
        {content}
      </button>
    );
  }

  return (
    <Link
      href={href}
      prefetch={false}
      title={collapsed ? label : undefined}
      className={className}
    >
      {content}
    </Link>
  );
}

function NestedSidebarItem({ href, icon, label, truncate }: { href: string; icon: string; label: string; truncate?: boolean }) {
  return (
    <Link href={href} prefetch={false} className="flex items-center gap-3 rounded-lg px-2 py-2 text-sm font-bold text-slate-300 transition hover:bg-white/[0.05] hover:text-white">
      <Icon name={icon} fill className="text-[19px] text-slate-400" />
      <span className={truncate ? "min-w-0 truncate" : ""}>{label}</span>
    </Link>
  );
}

function StandaloneSidebarItem({
  badge,
  collapsed,
  href,
  icon,
  label,
  onClick,
  pathname,
}: {
  badge?: string;
  collapsed: boolean;
  href: string;
  icon: string;
  label: string;
  onClick?: () => void;
  pathname: string;
}) {
  const active = pathname.startsWith(href.split("?")[0]) && href !== "/dashboard#promotions";
  const cls = `flex items-center rounded-lg text-[12px] font-black transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#087cff]/70 focus-visible:ring-offset-1 focus-visible:ring-offset-[#1b1c20] ${
    collapsed ? "justify-center px-1.5 py-2" : "gap-2 px-2 py-1.5"
  } ${active ? "bg-[#3a3b41] text-white" : "text-slate-300 hover:bg-white/[0.05] hover:text-white"}`;

  const inner = (
    <>
      <Icon name={icon} fill className="text-[18px] text-slate-400" />
      {!collapsed && (
        <>
          <span className="flex-1">{label}</span>
          {badge && <span className="rounded-full bg-[#ff1979] px-1.5 py-0.5 text-[9px] font-black text-white">{badge}</span>}
        </>
      )}
    </>
  );

  if (onClick) {
    return (
      <button type="button" title={collapsed ? label : undefined} onClick={onClick} className={cls}>
        {inner}
      </button>
    );
  }
  return (
    <Link href={href} prefetch={false} title={collapsed ? label : undefined} className={cls}>
      {inner}
    </Link>
  );
}

function TelegramIcon() {
  return (
    <svg aria-hidden="true" className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none">
      <path
        d="M20.7 4.1 3.9 10.6c-1.1.4-1.1 1.1-.2 1.4l4.3 1.3 1.7 5.2c.2.6.3.8.7.8.4 0 .6-.2.9-.5l2.1-2 4.4 3.2c.8.4 1.3.2 1.5-.8l2.7-12.8c.3-1.2-.5-1.7-1.3-1.3Z"
        fill="currentColor"
      />
      <path d="m8.7 13 8.8-5.6c.4-.3.8-.1.5.2l-7.1 6.5-.3 3.1-1.9-4.2Z" fill="#1b1c20" opacity=".55" />
    </svg>
  );
}

function MobileMenuDrawer({ onClose, onOpenLogin, onOpenRegister, onOpenProfile }: { onClose: () => void; onOpenLogin: () => void; onOpenRegister: () => void; onOpenProfile: () => void }) {
  const { isSignedIn, signOut } = useSupabaseAuth();
  const router = useRouter();
  const pathname = usePathname();
  const isActive = (href: string) => {
    const base = href.split("?")[0];
    return base === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(base);
  };

  const [openGroups, setOpenGroups] = useState({
    sports: false,
    p2p: false,
  });

  return (
    <div className="fixed inset-0 z-[60] animate-fade-in bg-black/70 lg:hidden" onClick={onClose}>
      <aside
        className="animate-drawer-in relative flex h-full w-[78vw] max-w-[320px] min-w-[260px] flex-col bg-[#151518]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-2">
          <BrandLogo size="sm" />
          <button
            className="grid h-8 w-8 place-items-center rounded-full text-slate-500 transition hover:bg-white/[0.06] hover:text-white"
            onClick={onClose}
            type="button"
            aria-label="Close menu"
          >
            <Icon name="close" className="text-[18px]" />
          </button>
        </div>

        <div className="no-scrollbar flex-1 overflow-y-auto px-5 pb-6">
          {!isSignedIn && (
            <section className="mb-5 grid grid-cols-2 gap-2">
              <button
                onClick={onOpenLogin}
                className="rounded-xl bg-white/[0.06] py-2.5 text-[13px] font-bold text-white"
                type="button"
              >
                Log in
              </button>
              <button
                onClick={onOpenRegister}
                className="rounded-xl bg-[#087cff] py-2.5 text-[13px] font-bold text-white"
                type="button"
              >
                Register
              </button>
            </section>
          )}

          <p className="mb-2 text-[12px] font-semibold uppercase tracking-[0.16em] text-slate-500">
            Explore
          </p>
          <nav className="space-y-0.5">
            <MobileDrawerGroup icon="sports_soccer" isOpen={openGroups.sports} label="Sports" onToggle={() => setOpenGroups((v) => ({ ...v, sports: !v.sports }))}>
              <MobileDrawerLink nested href="/sports" icon="sports_soccer" label="Sports" onClick={onClose} />
              <MobileDrawerLink nested href="/sports?tab=live" icon="sensors" label="Live" onClick={onClose} />
            </MobileDrawerGroup>

            <MobileDrawerLink href="/aviator" icon="rocket_launch" label="Aviator" badge="HOT" active={isActive("/aviator")} onClick={onClose} />
            <MobileDrawerLink href="/lucky-spin" icon="casino" label="Lucky Spin" active={isActive("/lucky-spin")} onClick={onClose} />
            <MobileDrawerLink href="/predictions" icon="online_prediction" label="Polymarket" active={isActive("/predictions")} onClick={onClose} />
            <MobileDrawerLink href="/binary" icon="candlestick_chart" label="Binary" active={isActive("/binary")} onClick={onClose} />

            <MobileDrawerGroup icon="swap_horiz" isOpen={openGroups.p2p} label="P2P" onToggle={() => setOpenGroups((v) => ({ ...v, p2p: !v.p2p }))}>
              <MobileDrawerLink nested href="/p2p" icon="storefront" label="Browse Ads" active={pathname === "/p2p"} onClick={onClose} />
              <MobileDrawerLink nested href="/p2p/merchant" icon="verified_user" label="Merchant Center" active={isActive("/p2p/merchant")} onClick={onClose} />
              <MobileDrawerLink nested href="/p2p/orders" icon="receipt_long" label="My Orders" active={isActive("/p2p/orders")} onClick={onClose} />
            </MobileDrawerGroup>

            <MobileDrawerLink href="/forex" icon="currency_exchange" label="Forex" active={isActive("/forex")} onClick={onClose} />
          </nav>

          <div className="my-4 border-t border-white/[0.06]" />

          <MobileDrawerLink href="/my-bets" icon="receipt_long" label="My Bets" active={isActive("/my-bets")} onClick={onClose} />
        </div>

        <div className="border-t border-white/[0.06] px-5 py-3">
          <button
            type="button"
            onClick={onOpenProfile}
            className="flex w-full items-center gap-3 py-2.5 text-left"
          >
            <Icon name="person" className="text-[20px] text-slate-400" />
            <span className="flex-1 text-[14px] font-bold text-white">Profile</span>
            <Icon name="chevron_right" className="text-[18px] text-slate-600" />
          </button>

          {isSignedIn && (
            <button
              type="button"
              className="flex w-full items-center gap-3 py-2.5 text-left"
              onClick={async () => {
                onClose();
                await signOut();
                toast.info("Signed out", "See you next time!");
                router.push("/");
              }}
            >
              <Icon name="logout" className="text-[20px] text-red-400" />
              <span className="flex-1 text-[14px] font-bold text-red-400">Sign out</span>
            </button>
          )}
        </div>
      </aside>
    </div>
  );
}

function MobileDrawerGroup({ children, icon, isOpen, label, onToggle }: { children: React.ReactNode; icon: string; isOpen: boolean; label: string; onToggle: () => void }) {
  return (
    <section>
      <button
        className="flex w-full items-center gap-3 rounded-lg py-2.5 text-left transition active:bg-white/[0.03]"
        onClick={onToggle}
        type="button"
      >
        <Icon name={icon} className="text-[20px] text-slate-400" />
        <span className="flex-1 text-[14px] font-bold text-white">{label}</span>
        <Icon name={isOpen ? "expand_less" : "expand_more"} className="text-[18px] text-slate-600" />
      </button>
      <div className={`overflow-hidden transition-all duration-200 ease-out ${isOpen ? "max-h-[280px] opacity-100" : "max-h-0 opacity-0"}`}>
        <div className="ml-8 border-l border-white/[0.06] pl-3">{children}</div>
      </div>
    </section>
  );
}

function MobileDrawerLink({ active, badge, href, icon, label, nested, onClick }: { active?: boolean; badge?: string; href?: string; icon: string; label: string; nested?: boolean; onClick: () => void }) {
  const cls = `flex w-full items-center gap-3 rounded-lg py-2.5 text-left transition active:scale-[0.99] ${
    nested ? "py-2" : ""
  } ${active ? "text-white" : "text-slate-300 active:bg-white/[0.03]"}`;
  const inner = (
    <>
      <Icon
        name={icon}
        className={`${nested ? "text-[16px]" : "text-[20px]"} ${active ? "text-[#087cff]" : "text-slate-500"}`}
      />
      <span className={`flex-1 font-bold ${nested ? "text-[13px]" : "text-[14px]"} ${active ? "text-white" : ""}`}>
        {label}
      </span>
      {badge && (
        <span className="rounded-md bg-[#ff1979]/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[#ff1979]">
          {badge}
        </span>
      )}
      {active && !nested && <span className="h-1.5 w-1.5 rounded-full bg-[#087cff]" />}
    </>
  );
  if (!href) {
    return <button type="button" className={cls} onClick={onClick}>{inner}</button>;
  }
  return (
    <Link href={href} prefetch={false} className={cls} onClick={onClick}>
      {inner}
    </Link>
  );
}

/* ── Mobile Betslip Sheet ───────────────────────────────── */
function MobileBetslipSheet({ children }: { children: React.ReactNode }) {
  const { bets } = useBetslip();
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const combinedOdds = bets.reduce((acc, b) => acc * (parseFloat(b.value) || 1), 1);

  const requestClose = useCallback(() => {
    if (closing) return;
    setClosing(true);
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => {
      setOpen(false);
      setClosing(false);
      closeTimer.current = null;
    }, 220);
  }, [closing]);

  useEffect(() => {
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!open || closing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") requestClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, closing, requestClose]);

  return (
    <>
      {/* FAB — compact pill above bottom nav */}
      <div className="pointer-events-none fixed bottom-[84px] left-0 right-0 z-40 flex justify-center lg:hidden">
        <button
          type="button"
          onClick={() => {
            if (closing) return;
            setOpen(true);
          }}
          className={`pointer-events-auto flex items-center gap-2.5 rounded-full py-2.5 pl-4 pr-3 shadow-[0_4px_20px_rgba(0,0,0,.45)] transition active:scale-[0.97] ${
            bets.length > 0
              ? "bg-[#0a5fbf] ring-1 ring-white/[0.1]"
              : "bg-white/[0.03] ring-1 ring-white/[0.12]"
          }`}
        >
          <Icon
            name="receipt_long"
            fill
            className={`text-[18px] ${bets.length > 0 ? "text-white" : "text-slate-500"}`}
          />
          <span className={`text-[13px] font-black ${bets.length > 0 ? "text-white" : "text-slate-400"}`}>
            Betslip
          </span>
          {bets.length > 0 ? (
            <>
              <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-white/20 px-1.5 text-[10px] font-black text-white">
                {bets.length}
              </span>
              <span className="rounded-full bg-black/20 px-2 py-0.5 font-mono text-[11px] font-black tabular-nums text-white">
                @{combinedOdds.toFixed(2)}
              </span>
            </>
          ) : (
            <Icon name="expand_less" className="text-[16px] text-slate-500" />
          )}
        </button>
      </div>

      {open && (
        <div className="fixed bottom-14 left-0 right-0 top-0 z-[45] lg:hidden">
          <div
            className={`absolute inset-0 bg-black/70 ${
              closing ? "animate-sheet-backdrop-out" : "animate-sheet-backdrop-in"
            }`}
            onClick={requestClose}
          />
          <div
            className={`absolute bottom-0 left-0 right-0 flex h-[calc(100dvh-3.5rem)] max-h-[calc(93dvh-3.5rem)] flex-col rounded-t-2xl bg-[#151518] shadow-2xl ring-1 ring-white/[0.06] ${
              closing ? "animate-sheet-out" : "animate-sheet-in"
            }`}
          >
            <div className="relative flex shrink-0 items-center justify-center border-b border-white/10 px-3 pb-2 pt-2">
              <button
                type="button"
                onClick={requestClose}
                className="flex w-full flex-col items-center gap-2 py-1"
                aria-label="Close betslip"
              >
                <span className="h-1 w-10 rounded-full bg-white/20" />
              </button>
              <button
                type="button"
                onClick={requestClose}
                className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/[0.06] text-slate-400 transition hover:bg-white/[0.1] hover:text-white active:scale-95"
                aria-label="Close betslip"
              >
                <Icon name="close" className="text-[16px]" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
          </div>
        </div>
      )}
    </>
  );
}

/* ── Footer ─────────────────────────────────────────────── */
function AppFooter() {
  const socials: { label: string; tg?: boolean; mat?: string; svg?: React.ReactNode; vb?: string }[] = [
    { label: "WhatsApp",  svg: <path d="M17.5 14.4c-.3-.1-1.7-.8-2-1-.3-.1-.5-.1-.7.1-.2.3-.8 1-.9 1.2-.2.2-.3.2-.6.1-.3-.1-1.3-.5-2.4-1.5-.9-.8-1.5-1.8-1.6-2-.2-.3 0-.5.1-.6l.5-.6c.1-.2.1-.3.2-.5 0-.2 0-.4-.1-.5-.1-.1-.7-1.6-1-2.2-.2-.6-.5-.5-.7-.5H8c-.2 0-.5.1-.7.3-.3.3-1 1-1 2.4s1 2.8 1.1 3c.1.2 2 3 4.8 4.2.7.3 1.2.4 1.6.5.7.2 1.3.2 1.8.1.5-.1 1.7-.7 1.9-1.4.2-.6.2-1.2.1-1.3-.1-.1-.3-.2-.6-.3zm-5.4 7.3h-.1a10.4 10.4 0 0 1-5.3-1.5l-.4-.2-3.7 1 1-3.6-.3-.4a10.5 10.5 0 1 1 8.8 4.7zm0-20C5.4 1.7 1 6.2 1 11.7c0 1.9.5 3.7 1.4 5.2L1 22l5.2-1.4a10.3 10.3 0 0 0 5 1.3c5.5 0 10-4.5 10-10S17.7 1.7 12.1 1.7z" />, vb: "0 0 24 24" },
    { label: "Telegram",  tg: true },
    { label: "Instagram", mat: "photo_camera" },
    { label: "Facebook",  svg: <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />, vb: "0 0 24 24" },
    { label: "X",         svg: <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.737-8.835L2.25 2.25h6.865l4.258 5.622L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z" />, vb: "0 0 20 20" },
  ];

  const infoLinks = ["Rules", "Promotions", "Partner program", "Responsible Gaming", "Privacy Policy", "Terms of Service"];
  const products = [
    { label: "Sports Betting", href: "/sports" },
    { label: "Aviator", href: "/aviator" },
    { label: "Lucky Spin", href: "/lucky-spin" },
    { label: "Predictions", href: "/predictions" },
    { label: "P2P Trading", href: "/p2p" },
    { label: "Binary", href: "/binary" },
    { label: "Forex", href: "/forex" },
    { label: "Smart Wallet", href: "/wallet" },
  ];

  return (
    <footer className="border-t border-white/[0.06] bg-[#151518]">
      {/* ── Main body ── */}
      <div className="mx-auto grid gap-12 px-6 py-12 xl:px-10 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr]">

        {/* Brand column */}
        <div className="flex flex-col gap-5">
          <div>
            <div className="mb-2 text-xl font-black tracking-tight text-white">Nezeem</div>
            <p className="text-[12px] leading-[1.7] text-slate-500">
              Sports betting, Aviator, Polymarket predictions,<br className="hidden sm:block" /> P2P trading, Binary &amp; Forex, and a Smart Wallet<br className="hidden sm:block" /> — one seamless platform.
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            {socials.map((s) => (
              <button key={s.label} type="button" aria-label={s.label}
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.05] text-slate-500 transition hover:bg-white/[0.09] hover:text-white"
              >
                {s.tg ? <TelegramIcon /> : s.mat ? (
                  <Icon name={s.mat} fill className="text-[15px]" />
                ) : (
                  <svg viewBox={s.vb} className="h-3.5 w-3.5" fill="currentColor">{s.svg}</svg>
                )}
              </button>
            ))}
          </div>
          {/* Contact */}
          <div className="flex flex-col gap-1.5">
            <a href="mailto:business@nezeem.com" className="flex items-center gap-2 text-[11px] text-slate-500 transition hover:text-white">
              <Icon name="mail" className="text-[14px] text-slate-600" />
              business@nezeem.com
            </a>
            <a href="mailto:partners@nezeem.com" className="flex items-center gap-2 text-[11px] text-slate-500 transition hover:text-white">
              <Icon name="handshake" className="text-[14px] text-slate-600" />
              partners@nezeem.com
            </a>
          </div>
        </div>

        {/* Information */}
        <div>
          <h4 className="mb-5 text-[10px] font-black uppercase tracking-[0.14em] text-slate-600">Information</h4>
          <ul className="space-y-3">
            {infoLinks.map((l) => (
              <li key={l}>
                <Link href="#" className="text-[13px] text-slate-500 transition hover:text-white">{l}</Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Products */}
        <div>
          <h4 className="mb-5 text-[10px] font-black uppercase tracking-[0.14em] text-slate-600">Products</h4>
          <ul className="space-y-3">
            {products.map((l) => (
              <li key={l.label}>
                <Link href={l.href} className="text-[13px] text-slate-500 transition hover:text-white">{l.label}</Link>
              </li>
            ))}
          </ul>
        </div>

        {/* App + Support */}
        <div className="flex flex-col gap-4">
          <h4 className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-600">Get the app</h4>
          <Link href="#" className="group flex items-center gap-3 rounded-xl bg-white/[0.04] p-3 ring-1 ring-white/[0.06] transition hover:bg-white/[0.07] hover:ring-white/[0.12]">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#05b957]/15 text-[#05b957]">
              <Icon name="phone_iphone" fill className="text-[20px]" />
            </span>
            <div>
              <div className="text-xs font-black text-white">Mobile App</div>
              <div className="text-[10px] text-slate-500">Android &amp; iOS</div>
            </div>
            <Icon name="chevron_right" className="ml-auto text-[18px] text-slate-600 transition group-hover:text-slate-400" />
          </Link>
          <Link href="#" className="group flex items-center gap-3 rounded-xl bg-white/[0.04] p-3 ring-1 ring-white/[0.06] transition hover:bg-white/[0.07] hover:ring-white/[0.12]">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#087cff]/15 text-[#087cff]">
              <Icon name="desktop_windows" fill className="text-[20px]" />
            </span>
            <div>
              <div className="text-xs font-black text-white">Windows App</div>
              <div className="text-[10px] text-slate-500">Desktop</div>
            </div>
            <Icon name="chevron_right" className="ml-auto text-[18px] text-slate-600 transition group-hover:text-slate-400" />
          </Link>
          <button type="button" className="mt-1 flex items-center gap-3 rounded-xl bg-white/[0.04] p-3 ring-1 ring-white/[0.06] text-left transition hover:bg-white/[0.07]">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] text-slate-300">
              <Icon name="support_agent" fill className="text-[20px]" />
            </span>
            <div className="flex-1">
              <div className="text-xs font-black text-white">Support</div>
              <div className="text-[10px] text-slate-500">Available 24/7</div>
            </div>
            <span className="rounded-full bg-[#05b957] px-2 py-0.5 text-[9px] font-black text-white">LIVE</span>
          </button>
        </div>
      </div>

      {/* ── Bottom bar ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.05] px-6 py-4 xl:px-10">
        <p className="text-[11px] text-slate-600">© 2026 Nezeem. All rights reserved. Play responsibly. 18+ only.</p>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-slate-600">Licensed &amp; regulated</span>
          <span className="flex h-6 w-8 items-center justify-center rounded border border-white/10 text-[10px] font-black text-slate-500">18+</span>
        </div>
      </div>
    </footer>
  );
}
