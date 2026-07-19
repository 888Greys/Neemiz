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
import type { ProfileView } from "@/components/profile-modal";
import { OPEN_PROFILE_EVENT, type OpenProfileView } from "@/lib/open-profile";
import { peekPendingPromo, redeemPromoClient } from "@/lib/pending-promo";
import { PromoSuccessHost, showPromoSuccess } from "@/components/promo-success";
import { NavBadgeContext } from "@/lib/nav-badge-context";
import { PhonePromptModal } from "@/components/phone-prompt-modal";
import { readNavRecents, trackNavRecent, type NavRecent } from "@/lib/nav-recents";
import { COMPANY } from "@/lib/company";
import { useIsBinarySurface } from "@/lib/site-config-context";
import { useWalletBalance } from "@/lib/use-wallet-balance";
import { useCurrency } from "@/lib/currency-context";
import { BalanceVisibilityProvider, useBalanceVisibility } from "@/lib/balance-visibility";

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

type AppShellProps = {
  children: React.ReactNode;
  rightPanel?: React.ReactNode;
  mainBg?: string;
  hideFooter?: boolean;
  fullHeight?: boolean;
  /** Desktop left rail — off by default (top nav covers the same links). Pass false to restore. */
  hideSidebar?: boolean;
  /** Full-bleed game surfaces: no logo/bell header, no mobile bottom nav. */
  immersive?: boolean;
};

export function AppShell({ children, rightPanel, mainBg, hideFooter = false, fullHeight = false, hideSidebar = true, immersive = false }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const binaryOnly = useIsBinarySurface();
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
  // Start collapsed on both server and first client render to avoid a hydration
  // mismatch, then sync the persisted preference from localStorage after mount.
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [recents, setRecents] = useState<NavRecent[]>([]);
  useEffect(() => {
    const stored = localStorage.getItem("sidebar-collapsed");
    if (stored !== null) setSidebarCollapsed(stored === "true");
    setRecents(readNavRecents());
  }, []);
  useEffect(() => {
    setRecents(trackNavRecent(pathname));
  }, [pathname]);
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
  // Social sign-ups land with ?verified=1 (set by /auth/callback). Show a brief
  // "Email verified ✓" confirmation ahead of the (hard-blocking) phone step.
  const [verifiedIntro, setVerifiedIntro]     = useState(false);

  useEffect(() => {
    if (searchParams.get("verified") !== "1") return;
    setVerifiedIntro(true);
    // Strip the param so a refresh doesn't replay the intro.
    const params = new URLSearchParams(Array.from(searchParams.entries()));
    params.delete("verified");
    const qs = params.toString();
    window.history.replaceState(null, "", qs ? `${pathname}?${qs}` : pathname);
  }, [searchParams, pathname]);

  useEffect(() => {
    if (isSignedIn && user) {
      const hasPhoneInAuth = !!(
        user.phone
        || user.user_metadata?.phone_number
        || user.email?.endsWith("@phone.nezeem.com")
        || user.email?.endsWith("@phone.binaryoptionske.com")
      );
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

  useEffect(() => {
    function onOpenProfile(e: Event) {
      const detail = (e as CustomEvent<{ view?: OpenProfileView }>).detail;
      const view = detail?.view;
      openProfile(view ? (view as ProfileView) : undefined);
    }
    window.addEventListener(OPEN_PROFILE_EVENT, onOpenProfile);
    return () => window.removeEventListener(OPEN_PROFILE_EVENT, onOpenProfile);
  }, []);

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

  // Immersive / Binary surfaces open the drawer via a window event so trade
  // chrome can keep a Menu escape hatch without a bottom dock.
  useEffect(() => {
    if (!immersive && !binaryOnly) return;
    const open = () => setMobileMenuOpen(true);
    window.addEventListener("neemiz:open-menu", open);
    return () => window.removeEventListener("neemiz:open-menu", open);
  }, [immersive, binaryOnly]);

  if (isLogin) return <>{children}</>;

  return (
    <BetslipProvider>
    <AuthModalContext.Provider value={{ openLogin: () => setLoginOpen(true), openRegister: () => setRegisterOpen(true), openWallet: () => setWalletOpen(true) }}>
    <NavBadgeContext.Provider value={navBadgeContext}>
    <BalanceVisibilityProvider>
    <div className={`min-h-screen overflow-x-hidden text-on-surface ${binaryOnly ? "bg-black" : "bg-background"}`}>
      {/* Same top chrome on every surface — logo, balance, profile, bell.
          BinaryKE: flush Olymp-style bar (see trader.css .bok-shell-header). */}
      <header className={`flex fixed z-50 items-center overflow-visible ${
        binaryOnly
          ? "bok-shell-header left-0 right-0 top-0 h-[calc(3.25rem+env(safe-area-inset-top))] px-3 pt-[env(safe-area-inset-top)] border-b border-white/[0.08] bg-black/90 backdrop-blur-xl lg:h-[4.5rem] lg:pt-0 lg:bg-black lg:backdrop-blur-none"
          : "left-3 right-3 top-[max(0.5rem,env(safe-area-inset-top))] h-10 rounded-full border border-white/[0.05] bg-[#18191d]/50 px-2.5 shadow-[0_4px_16px_rgba(0,0,0,0.25)] backdrop-blur-xl lg:left-0 lg:right-0 lg:top-0 lg:h-20 lg:max-w-[100vw] lg:rounded-none lg:border-x-0 lg:border-t-0 lg:border-b lg:border-white/[0.06] lg:bg-[#151518] lg:px-0 lg:shadow-none lg:backdrop-blur-none"
      }`}>
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
          <div className="flex min-w-0 items-center gap-2 lg:gap-6">
            {/* Binary / immersive: Deriv-style hamburger in the top pill (no bottom nav). */}
            {(binaryOnly || immersive) && (
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                title="Menu"
                aria-label="Open menu"
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-slate-200 transition hover:bg-white/[0.08] active:scale-[0.97] lg:hidden"
              >
                <Icon name="menu" className="text-[22px]" />
              </button>
            )}
            <BrandLogo href={binaryOnly ? "/binary" : "/dashboard"} size="sm" />
            <nav className={`hidden items-center gap-0.5 p-1 text-sm font-black md:flex ${
              binaryOnly
                ? "rounded-full bg-white/[0.04] ring-1 ring-white/[0.08]"
                : "rounded-2xl bg-[#18191d] ring-1 ring-white/[0.06]"
            }`}>
              {binaryOnly ? (
                <TopNavLink href="/binary" icon="candlestick_chart" label="Trade" pathname={pathname} />
              ) : (
                <>
                  <TopNavLink href="/dashboard" icon="home" label="Home" pathname={pathname} />
                  <TopNavLink href="/sports" icon="sports_soccer" label="Sports" pathname={pathname} />
                  <TopNavLink href="/p2p" icon="swap_horiz" label="P2P" pathname={pathname} />
                  <TopNavLink href="/aviator" icon="rocket_launch" label="Aviator" pathname={pathname} />
                  <TopNavLink href="/lucky-spin" icon="casino" label="Spin" pathname={pathname} />
                  <TopNavLink href="/predictions" icon="online_prediction" label="Polymarket" pathname={pathname} />
                  <TopNavLink href="/binary" icon="candlestick_chart" label="Binary" pathname={pathname} />
                  <TopNavLink href="/forex" icon="currency_exchange" label="Forex" pathname={pathname} />
                </>
              )}
            </nav>
          </div>
          {isSignedIn ? (
            <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
              <HeaderBalanceChip onOpen={() => openWallet()} />
              {/* Wallet icon — desktop (mobile has it in the bottom nav) */}
              <button
                type="button"
                onClick={() => openWallet()}
                title="Wallet"
                aria-label="Open wallet"
                className="hidden h-9 w-9 shrink-0 place-items-center rounded-full bg-[#18191d] text-slate-300 ring-1 ring-white/[0.08] transition hover:bg-[#22242a] hover:text-white lg:grid"
              >
                <Icon name="account_balance_wallet" className="text-[20px]" />
              </button>
              {/* Small profile icon (mobile) */}
              <button
                type="button"
                onClick={() => setProfileOpen(true)}
                title="Profile"
                aria-label="Profile"
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#18191d] text-slate-300 ring-1 ring-white/[0.08] transition hover:bg-[#22242a] hover:text-white sm:h-9 sm:w-9 lg:hidden"
              >
                <Icon name="person" fill className="text-[18px] sm:text-[20px]" />
              </button>
              <NotificationsBell />
              {/* Profile — desktop, top-right */}
              <button
                type="button"
                onClick={() => setProfileOpen(true)}
                title="Profile"
                aria-label="Profile"
                className="hidden shrink-0 rounded-full ring-1 ring-white/[0.07] transition hover:ring-white/20 lg:block"
              >
                <UserAvatar src={avatarUrl} initials={initials} className="h-9 w-9" />
              </button>
            </div>
          ) : (
            <div className="flex min-w-0 shrink-0 items-center gap-1.5 sm:gap-2 md:gap-3">
              <button
                onClick={() => setLoginOpen(true)}
                className={
                  binaryOnly
                    ? "bok-auth-login rounded-full px-3 py-2 text-[11px] font-black text-white transition hover:bg-white/[0.06] active:scale-[0.97] sm:px-4 sm:text-xs md:px-5 md:text-sm"
                    : "rounded-lg bg-white/[0.06] px-2.5 py-2 text-[11px] font-black text-slate-200 ring-1 ring-white/[0.08] transition hover:bg-white/[0.1] hover:text-white active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20 focus-visible:ring-offset-2 focus-visible:ring-offset-[#151518] sm:px-3 sm:text-xs md:rounded-2xl md:px-6 md:py-3 md:text-base"
                }
                type="button"
              >
                Login
              </button>
              <button
                onClick={() => setRegisterOpen(true)}
                className={
                  binaryOnly
                    ? "bok-auth-join rounded-full px-3 py-2 text-[11px] font-black transition active:scale-[0.97] sm:px-4 sm:text-xs md:px-5 md:text-sm"
                    : "rounded-lg bg-emerald-800 px-2.5 py-2 text-[11px] font-black text-emerald-50 transition hover:bg-emerald-700 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#151518] sm:px-3 sm:text-xs md:rounded-2xl md:px-6 md:py-3 md:text-base"
                }
                type="button"
              >
                <span className="sm:hidden">{binaryOnly ? "Start" : "Join"}</span>
                <span className="hidden sm:inline">{binaryOnly ? "Try for free" : "Registration"}</span>
              </button>
            </div>
          )}
        </div>
      </header>

      <div className={`flex overflow-hidden ${
        binaryOnly ? "bok-shell-main-pad pt-[calc(3.25rem+env(safe-area-inset-top))] lg:pt-[4.5rem]" : "pt-14 lg:pt-20"
      } ${immersive || fullHeight ? "h-[100dvh]" : "h-screen"}`}>
        {!hideSidebar && (
        <aside
          className={`hidden shrink-0 overflow-hidden border-r border-white/[0.06] bg-[#151518] transition-[width] duration-300 ease-out lg:block ${
            sidebarCollapsed ? "w-[78px]" : "w-[280px]"
          }`}
        >
          <Sidebar collapsed={sidebarCollapsed} onToggle={toggleSidebar} pathname={pathname} tab={currentTab} recents={recents} />
        </aside>
        )}

        <main ref={mainRef} data-app-scroll="true" className={`no-scrollbar min-w-0 flex-1 overflow-x-hidden ${immersive || fullHeight ? "overflow-hidden pb-0" : `overflow-y-auto lg:pb-0 pb-32`} ${mainBg ?? "bg-background"}`}>
          {fullHeight || immersive ? (
            <div className="h-full min-h-0 min-w-0 max-w-full overflow-hidden">{children}</div>
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
      {mobileMenuOpen && <MobileMenuDrawer onClose={() => setMobileMenuOpen(false)} onOpenLogin={() => { setMobileMenuOpen(false); setLoginOpen(true); }} onOpenRegister={() => { setMobileMenuOpen(false); setRegisterOpen(true); }} onOpenProfile={() => { setMobileMenuOpen(false); setProfileInitialView(undefined); setProfileOpen(true); }} onOpenWallet={(tab) => { setMobileMenuOpen(false); openWallet(tab); }} recents={recents} />}
      {missingPhone && <PhonePromptModal verifiedIntro={verifiedIntro} onComplete={handlePhoneComplete} />}

      {rightPanel && isSportsPage && <MobileBetslipSheet>{rightPanel}</MobileBetslipSheet>}
      {!immersive && (
      <nav className="fixed inset-x-0 bottom-0 z-50 flex h-[calc(3.5rem+env(safe-area-inset-bottom))] items-center justify-around gap-1 border-t border-white/[0.08] bg-[#1c1c1e]/96 px-1 pb-[env(safe-area-inset-bottom)] pt-0.5 backdrop-blur-xl lg:hidden">
        {mobileNav.map((item) => {
          const activePath = item.activePath ?? (item.href ?? "").split("?")[0].split("#")[0];
          // Panel tabs (binary's Markets/Trade/Positions) share one route and are
          // distinguished by the `?panel=` value, so match on panel rather than
          // path — otherwise every same-route tab would light up at once.
          // Tab tabs (Sports / Live) work the same way via `?tab=`.
          const isPanelTab = item.panel !== undefined;
          const isQueryTab = item.tab !== undefined;
          const pathNow = pendingPath ?? pathname;
          const active = isPanelTab
            ? pathname.startsWith(activePath) && currentPanel === item.panel
            : isQueryTab
              ? pathname.startsWith(activePath) && currentTab === item.tab
              : item.label === "P2P"
                ? pathNow === "/p2p" || pathNow.startsWith("/p2p/express")
                : item.label === "Orders"
                  ? pathNow.startsWith("/p2p/order") || pathNow.startsWith("/p2p/orders")
                  : activePath === pathNow;
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

          if (item.action === "profile") {
            return (
              <button
                key={item.label}
                type="button"
                className="flex h-full min-w-0 flex-1 flex-col items-center justify-center rounded text-[9px] text-on-surface-variant focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#087cff]/70 focus-visible:ring-inset"
                onClick={() => openProfile()}
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
      )}
    </div>
    </BalanceVisibilityProvider>
    </NavBadgeContext.Provider>
    </AuthModalContext.Provider>
    </BetslipProvider>
  );
}

function HeaderBalanceChip({ onOpen }: { onOpen: () => void }) {
  const binaryOnly = useIsBinarySurface();
  const { balance } = useWalletBalance();
  const { convert, currency: displayCurrency, code } = useCurrency();
  const { hidden, toggle } = useBalanceVisibility();

  const shown = convert(balance).toLocaleString(displayCurrency.locale, {
    minimumFractionDigits: displayCurrency.decimals,
    maximumFractionDigits: displayCurrency.decimals,
  });

  return (
    <div className={`flex items-center gap-1 rounded-full py-1 pl-3 pr-1.5 ${
      binaryOnly
        ? "bok-balance-chip"
        : "bg-[#18191d] ring-1 ring-white/[0.08]"
    }`}>
      <button
        type="button"
        onClick={onOpen}
        aria-label="Open wallet"
        title="Wallet"
        className="flex items-baseline gap-1 text-left"
      >
        <span className="text-[13px] font-black tabular-nums tracking-wide text-white">
          {hidden ? "* * *" : shown}
        </span>
        <span className={`text-[10px] font-bold ${binaryOnly ? "text-[var(--bok-lime,#b8ff2a)]" : "text-slate-400"}`}>{code}</span>
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          toggle();
        }}
        aria-label={hidden ? "Show balance" : "Hide balance"}
        title={hidden ? "Show balance" : "Hide balance"}
        className="grid h-5 w-5 shrink-0 place-items-center rounded-full text-slate-500 transition hover:text-white"
      >
        <Icon name={hidden ? "visibility_closed" : "visibility"} className="text-[12px]" />
      </button>
    </div>
  );
}

function TopNavLink({ href, icon, label, pathname }: { href: string; icon: string; label: string; pathname: string }) {
  const router = useRouter();
  const binaryOnly = useIsBinarySurface();
  const active = href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href);

  return (
    <Link
      href={href}
      prefetch={false}
      onPointerEnter={() => router.prefetch(href)}
      onFocus={() => router.prefetch(href)}
      className={`flex items-center gap-1.5 px-4 py-2.5 transition-all duration-150 focus-visible:outline-none ${
        binaryOnly
          ? `rounded-full ${
              active
                ? "bg-[var(--bok-lime,#b8ff2a)] text-[var(--bok-lime-ink,#0a0f00)]"
                : "text-white/60 hover:bg-white/[0.06] hover:text-white"
            }`
          : `rounded-xl focus-visible:ring-2 focus-visible:ring-[#087cff]/70 focus-visible:ring-offset-1 focus-visible:ring-offset-[#18191d] ${
              active
                ? "bg-gradient-to-b from-[#2b8bff] to-[#0a6ef0] text-white ring-1 ring-inset ring-white/15"
                : "text-slate-400 hover:bg-white/[0.06] hover:text-white"
            }`
      }`}
    >
      <Icon name={icon} fill={active} className="text-[17px]" />
      {label}
    </Link>
  );
}

function UserAvatar({ src, initials, className }: { src?: string | null; initials: string; className: string }) {
  const binaryOnly = useIsBinarySurface();
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
    <span className={`${className} flex items-center justify-center rounded-full text-sm font-black ${
      binaryOnly ? "bok-avatar-fallback" : "bg-[#087cff] text-white"
    }`}>
      {initials}
    </span>
  );
}

function sidebarItemActive(pathname: string, href: string, tab = "") {
  const [path, query] = href.split("?");
  const q = new URLSearchParams(query ?? "");
  const hrefTab = q.get("tab");

  if (hrefTab === "live") return pathname.startsWith("/sports") && tab === "live";
  if (hrefTab === "ads") {
    // Ads tab (default merchant landing) — not Profile / Payments.
    return (
      pathname.startsWith("/p2p/merchant") &&
      tab !== "profile" &&
      tab !== "payments" &&
      tab !== "escrow" &&
      (tab === "ads" || tab === "")
    );
  }
  if (path === "/sports") return pathname.startsWith("/sports") && tab !== "live";
  if (path === "/my-bets") return pathname.startsWith("/my-bets");
  if (path === "/p2p/orders") {
    return pathname.startsWith("/p2p/orders") || pathname.startsWith("/p2p/order/");
  }
  if (path === "/p2p") {
    // Browse / Express only — Ads & Orders are separate flat items.
    if (pathname.startsWith("/p2p/merchant") || pathname.startsWith("/p2p/orders") || pathname.startsWith("/p2p/order/")) {
      return false;
    }
    return pathname === "/p2p" || pathname.startsWith("/p2p/express") || pathname.startsWith("/p2p?");
  }
  if (path === "/polymarket" || path === "/predictions") {
    return pathname.startsWith("/polymarket") || pathname.startsWith("/predictions");
  }
  if (path === "/dashboard") return pathname === "/dashboard";
  return pathname.startsWith(path);
}

function Sidebar({
  collapsed,
  pathname,
  tab,
}: {
  collapsed: boolean;
  onToggle: () => void;
  pathname: string;
  tab: string;
  recents: NavRecent[];
}) {
  const binaryOnly = useIsBinarySurface();
  return (
    <div className="relative flex h-full flex-col">
      <div className={`no-scrollbar flex-1 overflow-y-auto py-5 ${collapsed ? "px-2" : "px-4"}`}>
        {!collapsed && (
          <p className="mb-1.5 px-2 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-600">Explore</p>
        )}
        <div className="space-y-0.5">
          {binaryOnly ? (
            <StandaloneSidebarItem collapsed={collapsed} href="/binary" icon="candlestick_chart" label="Trade" pathname={pathname} tab={tab} />
          ) : (
            <>
              <StandaloneSidebarItem collapsed={collapsed} href="/sports" icon="sports_soccer" label="Sports" pathname={pathname} tab={tab} />
              <StandaloneSidebarItem collapsed={collapsed} href="/sports?tab=live" icon="sensors" label="Live" pathname={pathname} tab={tab} />
              <StandaloneSidebarItem collapsed={collapsed} href="/my-bets" icon="receipt_long" label="My Bets" pathname={pathname} tab={tab} />
              <StandaloneSidebarItem collapsed={collapsed} href="/p2p" icon="swap_horiz" label="P2P" pathname={pathname} tab={tab} />
              <StandaloneSidebarItem collapsed={collapsed} href="/p2p/merchant?tab=ads" icon="campaign" label="Ads" pathname={pathname} tab={tab} />
              <StandaloneSidebarItem collapsed={collapsed} href="/p2p/orders" icon="list_alt" label="Orders" pathname={pathname} tab={tab} />
              <StandaloneSidebarItem collapsed={collapsed} href="/polymarket" icon="online_prediction" label="Polymarket" pathname={pathname} tab={tab} />
              <StandaloneSidebarItem collapsed={collapsed} href="/binary" icon="candlestick_chart" label="Binary" pathname={pathname} tab={tab} />
              <StandaloneSidebarItem collapsed={collapsed} href="/forex" icon="currency_exchange" label="Forex" pathname={pathname} tab={tab} />
              <StandaloneSidebarItem collapsed={collapsed} href="/aviator" icon="rocket_launch" label="Aviator" pathname={pathname} tab={tab} badge="HOT" />
              <StandaloneSidebarItem collapsed={collapsed} href="/lucky-spin" icon="casino" label="Lucky Spin" pathname={pathname} tab={tab} />
            </>
          )}
        </div>
      </div>
    </div>
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
  tab = "",
}: {
  badge?: string;
  collapsed: boolean;
  href: string;
  icon: string;
  label: string;
  onClick?: () => void;
  pathname: string;
  tab?: string;
}) {
  const binaryOnly = useIsBinarySurface();
  const active = !onClick && sidebarItemActive(pathname, href, tab);
  const cls = `flex items-center rounded-lg text-[12px] font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-offset-[#1b1c20] ${
    binaryOnly ? "focus-visible:ring-[rgba(184,255,42,0.55)]" : "focus-visible:ring-[#087cff]/70"
  } ${
    collapsed ? "justify-center px-1.5 py-2" : "gap-2 px-2 py-1.5"
  } ${active ? "bg-[#3a3b41] text-white" : "text-slate-300 hover:bg-white/[0.05] hover:text-white"}`;

  const inner = (
    <>
      <Icon name={icon} fill={active} className={`text-[18px] ${
        active
          ? binaryOnly ? "text-[var(--bok-lime,#b8ff2a)]" : "text-[#087cff]"
          : "text-slate-400"
      }`} />
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

function MobileMenuDrawer({
  onClose,
  onOpenLogin,
  onOpenRegister,
  onOpenProfile,
  onOpenWallet,
  recents,
}: {
  onClose: () => void;
  onOpenLogin: () => void;
  onOpenRegister: () => void;
  onOpenProfile: () => void;
  onOpenWallet: (tab?: "home" | "deposit" | "send" | "withdraw" | "history") => void;
  recents: NavRecent[];
}) {
  const { isSignedIn, signOut } = useSupabaseAuth();
  const { balance } = useWalletBalance();
  const { convert, currency: displayCurrency, code: displayCode } = useCurrency();
  const { hidden: balanceHidden, toggle: toggleBalanceHidden } = useBalanceVisibility();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const binaryOnly = useIsBinarySurface();
  const tab = searchParams.get("tab") ?? "";
  const isActive = (href: string) => sidebarItemActive(pathname, href, tab);
  const [q, setQ] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [lang, setLang] = useState("English");

  useEffect(() => {
    const stored = localStorage.getItem("preferred-language");
    if (stored) setLang(stored);
  }, []);

  // Ads / Orders live in the P2P bottom bar — keep P2P itself as a product escape hatch.
  const exploreItems: Array<{ href: string; icon: string; label: string; badge?: string }> = binaryOnly
    ? [{ href: "/binary", icon: "candlestick_chart", label: "Trade" }]
    : [
        { href: "/sports", icon: "sports_soccer", label: "Sports" },
        { href: "/sports?tab=live", icon: "sensors", label: "Live" },
        { href: "/my-bets", icon: "receipt_long", label: "My Bets" },
        { href: "/p2p", icon: "swap_horiz", label: "P2P" },
        { href: "/predictions", icon: "online_prediction", label: "Polymarket" },
        { href: "/binary", icon: "candlestick_chart", label: "Binary" },
        { href: "/forex", icon: "currency_exchange", label: "Forex" },
        { href: "/aviator", icon: "rocket_launch", label: "Aviator", badge: "HOT" },
        { href: "/lucky-spin", icon: "casino", label: "Lucky Spin" },
      ];

  const quickChips = binaryOnly
    ? [{ label: "Trade", href: "/binary" }]
    : [
        { label: "Aviator", href: "/aviator" },
        { label: "Binary", href: "/binary" },
        { label: "Forex", href: "/forex" },
        { label: "Sports", href: "/sports" },
        { label: "Lucky Spin", href: "/lucky-spin" },
      ];

  const onBinary = pathname.startsWith("/binary");
  // Markets open from the Vol row in the trader — keep Positions as a menu escape hatch.
  const shortcuts = binaryOnly
    ? [{ label: "Positions", icon: "swap_vert", href: "/binary?panel=positions" }]
    : onBinary
      ? [
          { label: "Positions", icon: "swap_vert", href: "/binary?panel=positions" },
          { label: "My Bets", icon: "receipt_long", href: "/my-bets" },
        ]
      : [{ label: "My Bets", icon: "receipt_long", href: "/my-bets" }];

  const term = q.trim().toLowerCase();
  const filteredExplore = term
    ? exploreItems.filter((i) => i.label.toLowerCase().includes(term))
    : exploreItems;

  return (
    <div className={`fixed inset-0 z-[60] flex animate-fade-in flex-col lg:hidden ${
      binaryOnly ? "bok-mobile-drawer bg-black" : "bg-[#151518]"
    }`}>
      <div className="flex items-center gap-2.5 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3">
        <button
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/[0.05] text-slate-300 transition hover:bg-white/[0.1] hover:text-white"
          onClick={() => (searchOpen ? (setSearchOpen(false), setQ("")) : onClose())}
          type="button"
          aria-label={searchOpen ? "Back" : "Close menu"}
        >
          <Icon name={searchOpen ? "arrow_back" : "close"} className="text-[18px]" />
        </button>
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-full bg-white/[0.05] px-3.5">
          <Icon name="search" className="text-[18px] text-slate-500" />
          <input
            value={q}
            onFocus={() => setSearchOpen(true)}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search anything"
            className="h-10 min-w-0 flex-1 bg-transparent text-[14px] text-white outline-none placeholder:text-slate-500"
          />
          {q && (
            <button type="button" onClick={() => setQ("")} aria-label="Clear" className="shrink-0 text-slate-500 hover:text-white">
              <Icon name="close" className="text-[16px]" />
            </button>
          )}
        </div>
        {!searchOpen && (
          <button
            type="button"
            onClick={() => setLangOpen(true)}
            className="shrink-0 rounded-full bg-white/[0.05] px-3 py-2 text-[12px] font-bold text-slate-300 transition hover:bg-white/[0.1] hover:text-white"
          >
            {lang}
          </button>
        )}
      </div>

      {searchOpen ? (
        <div className="no-scrollbar flex-1 overflow-y-auto px-4 pb-6">
          {term ? (
            <nav className="space-y-0.5">
              {filteredExplore.map((item) => (
                <MobileDrawerLink
                  key={item.href}
                  href={item.href}
                  icon={item.icon}
                  label={item.label}
                  badge={item.badge}
                  active={isActive(item.href)}
                  onClick={onClose}
                />
              ))}
              {filteredExplore.length === 0 && (
                <p className="py-10 text-center text-[13px] font-semibold text-slate-500">
                  Nothing matches “{q.trim()}”
                </p>
              )}
            </nav>
          ) : (
            <>
              <div className="mb-6 flex flex-wrap gap-2">
                {quickChips.map((c) => (
                  <Link
                    key={c.label}
                    href={c.href}
                    prefetch={false}
                    onClick={onClose}
                    className={`rounded-full bg-white/[0.05] px-3.5 py-2 text-[13px] font-bold transition hover:bg-white/[0.09] ${
                      binaryOnly ? "text-[var(--bok-lime,#b8ff2a)]" : "text-emerald-400"
                    }`}
                  >
                    {c.label}
                  </Link>
                ))}
              </div>

              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                Quick actions
              </p>
              <div className="mb-6 grid grid-cols-2 gap-2.5">
                {shortcuts.map((s) => (
                  <Link
                    key={s.label}
                    href={s.href}
                    prefetch={false}
                    onClick={onClose}
                    className="flex flex-col gap-4 rounded-xl bg-white/[0.03] p-3.5 ring-1 ring-white/[0.06] transition hover:bg-white/[0.05]"
                  >
                    <Icon name={s.icon} className="text-[22px] text-slate-400" />
                    <span className="text-[14px] font-bold text-white">{s.label}</span>
                  </Link>
                ))}
              </div>

              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                Explore our products
              </p>
              <Link
                href="/p2p"
                prefetch={false}
                onClick={onClose}
                className="flex items-center gap-3 overflow-hidden rounded-xl bg-gradient-to-br from-[#0a5fbf]/25 to-[#1c1c1e] p-4 ring-1 ring-white/[0.06]"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-[16px] font-black leading-tight text-white">Skip the hassle. Cash out now.</span>
                  <span className="mt-1 block text-[12px] leading-snug text-slate-400">
                    Direct payouts to your bank, card or mobile money — no waiting for a buyer.
                  </span>
                </span>
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-emerald-500/15 text-emerald-400">
                  <Icon name="payments" fill className="text-[24px]" />
                </span>
              </Link>
            </>
          )}
        </div>
      ) : (
        <div className="no-scrollbar flex-1 overflow-y-auto px-4 pb-6">
          {!isSignedIn && (
            binaryOnly ? (
              <section className="mb-5 space-y-3">
                <button
                  onClick={onOpenRegister}
                  className="bok-dialog-cta w-full py-3.5 text-[14px]"
                  type="button"
                >
                  Start for free
                </button>
                <button
                  onClick={onOpenLogin}
                  className="flex w-full items-center justify-center gap-2 py-2.5 text-[13px] font-bold text-[var(--bok-lime,#b8ff2a)] transition hover:opacity-85"
                  type="button"
                >
                  <Icon name="person" className="text-[18px]" />
                  Login
                </button>
              </section>
            ) : (
              <section className="mb-5 grid grid-cols-2 gap-2">
                <button
                  onClick={onOpenLogin}
                  className="rounded-xl bg-white/[0.06] py-3 text-[13px] font-bold text-white"
                  type="button"
                >
                  Log in
                </button>
                <button
                  onClick={onOpenRegister}
                  className="rounded-xl bg-[#087cff] py-3 text-[13px] font-bold text-white"
                  type="button"
                >
                  Register
                </button>
              </section>
            )
          )}

          {isSignedIn && (
            <div className={`mb-4 rounded-2xl p-4 ${
              binaryOnly
                ? "bok-drawer-wallet bg-white/[0.03] ring-1 ring-[rgba(184,255,42,0.22)]"
                : "bg-white/[0.03] ring-1 ring-white/[0.07]"
            }`}>
              <div className="flex w-full items-center gap-2">
                <button
                  type="button"
                  onClick={() => onOpenWallet()}
                  className="min-w-0 flex-1 text-left"
                >
                  <span className={`block text-[10px] font-bold uppercase tracking-[0.14em] ${
                    binaryOnly ? "text-[var(--bok-lime,#b8ff2a)]/70" : "text-slate-500"
                  }`}>Wallet balance</span>
                  <span className="mt-0.5 block text-[22px] font-black leading-none tabular-nums tracking-wide text-white">
                    {balanceHidden
                      ? "* * * *"
                      : convert(balance).toLocaleString(displayCurrency.locale, {
                          minimumFractionDigits: displayCurrency.decimals,
                          maximumFractionDigits: displayCurrency.decimals,
                        })}
                    <span className={`ml-1.5 text-[12px] font-bold ${
                      binaryOnly ? "text-[var(--bok-lime,#b8ff2a)]" : "text-slate-500"
                    }`}>{displayCode}</span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={toggleBalanceHidden}
                  aria-label={balanceHidden ? "Show balance" : "Hide balance"}
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-slate-500 transition hover:text-white"
                >
                  <Icon name={balanceHidden ? "visibility_closed" : "visibility"} className="text-[17px]" />
                </button>
                <button
                  type="button"
                  onClick={() => onOpenWallet()}
                  aria-label="Open wallet"
                  className="grid h-8 w-8 shrink-0 place-items-center text-slate-600 transition hover:text-white"
                >
                  <Icon name="chevron_right" className="text-[18px]" />
                </button>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 border-t border-white/[0.06] pt-4">
                {([
                  { tab: "deposit", label: "Deposit", icon: "arrow_downward" },
                  { tab: "withdraw", label: "Withdraw", icon: "arrow_upward" },
                  { tab: "history", label: "History", icon: "history" },
                ] as const).map((a) => (
                  <button
                    key={a.tab}
                    type="button"
                    onClick={() => onOpenWallet(a.tab)}
                    className={`flex flex-col items-center gap-2 rounded-xl py-3 text-[11px] font-semibold transition ${
                      binaryOnly
                        ? "bg-white/[0.04] text-slate-200 hover:bg-[rgba(184,255,42,0.1)] hover:text-white"
                        : "bg-white/[0.04] text-slate-300 hover:bg-white/[0.07] hover:text-white"
                    }`}
                  >
                    <Icon name={a.icon} className={`text-[19px] ${
                      binaryOnly ? "text-[var(--bok-lime,#b8ff2a)]" : "text-slate-400"
                    }`} />
                    {a.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
            Explore
          </p>
          <nav className="space-y-0.5">
            {exploreItems.map((item) => (
              <MobileDrawerLink
                key={item.href}
                href={item.href}
                icon={item.icon}
                label={item.label}
                badge={item.badge}
                active={isActive(item.href)}
                onClick={onClose}
              />
            ))}
          </nav>
        </div>
      )}

      {!searchOpen && (
        <div className="border-t border-white/[0.06] px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
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
      )}

      {langOpen && (
        <LanguageSheet
          current={lang}
          onClose={() => setLangOpen(false)}
          onSelect={(name) => {
            setLang(name);
            localStorage.setItem("preferred-language", name);
            setLangOpen(false);
            if (name !== "English") toast.info(name, "Full translations are on the way.");
          }}
        />
      )}
    </div>
  );
}

const MENU_LANGUAGES: Array<{ label: string; sub: string }> = [
  { label: "English", sub: "English" },
  { label: "简体中文(SC)", sub: "Simplified Chinese" },
  { label: "繁體中文(TC)", sub: "Traditional Chinese" },
  { label: "Português brasileiro", sub: "Brazilian Portuguese" },
  { label: "한국어", sub: "Korean" },
  { label: "Français", sub: "French" },
  { label: "Español", sub: "Spanish" },
  { label: "Русский", sub: "Russian" },
];

function LanguageSheet({ current, onClose, onSelect }: { current: string; onClose: () => void; onSelect: (name: string) => void }) {
  const binaryOnly = useIsBinarySurface();
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/65" onClick={onClose}>
      <div
        className={`flex max-h-[80dvh] w-full max-w-md flex-col rounded-t-2xl pb-[max(0.75rem,env(safe-area-inset-bottom))] ${
          binaryOnly ? "bg-black ring-1 ring-white/[0.08]" : "bg-[#1c1c1e]"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between px-5 py-3">
          <h2 className="text-[17px] font-bold text-white">Languages</h2>
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-full bg-white/[0.06] text-slate-400 hover:text-white"
            aria-label="Close"
          >
            <Icon name="close" className="text-[18px]" />
          </button>
        </div>
        <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-3 pb-2">
          {MENU_LANGUAGES.map((l) => {
            const active = l.label === current;
            const soon = l.label !== "English";
            return (
              <button
                key={l.label}
                type="button"
                disabled={soon}
                onClick={() => { if (!soon) onSelect(l.label); }}
                className={`flex w-full items-center justify-between rounded-xl px-4 py-3 text-left transition ${
                  active
                    ? binaryOnly
                      ? "bg-[var(--bok-lime,#b8ff2a)] text-[var(--bok-lime-ink,#0a0f00)]"
                      : "bg-emerald-500 text-white"
                    : soon ? "cursor-not-allowed" : "text-slate-200 hover:bg-white/[0.05]"
                }`}
              >
                <span className={soon ? "opacity-45" : ""}>
                  <span className="block text-[15px] font-bold">{l.label}</span>
                  <span className={`block text-[12px] font-medium ${active ? "text-white/80" : "text-slate-500"}`}>{l.sub}</span>
                </span>
                {active ? (
                  <Icon name="check" className="text-[18px]" />
                ) : soon ? (
                  <span className="rounded-md bg-white/[0.06] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                    Coming soon
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function MobileDrawerLink({ active, badge, href, icon, label, nested, onClick }: { active?: boolean; badge?: string; href?: string; icon: string; label: string; nested?: boolean; onClick: () => void }) {
  const binaryOnly = useIsBinarySurface();
  const cls = `flex w-full items-center gap-3 rounded-lg py-2.5 text-left transition active:scale-[0.99] ${
    nested ? "py-2" : ""
  } ${active ? "text-white" : "text-slate-300 active:bg-white/[0.03]"}`;
  const accent = binaryOnly ? "text-[var(--bok-lime,#b8ff2a)]" : "text-[#087cff]";
  const dot = binaryOnly ? "bg-[var(--bok-lime,#b8ff2a)]" : "bg-[#087cff]";
  const inner = (
    <>
      <Icon
        name={icon}
        className={`${nested ? "text-[16px]" : "text-[20px]"} ${active ? accent : "text-slate-500"}`}
      />
      <span className={`flex-1 font-bold ${nested ? "text-[13px]" : "text-[14px]"} ${active ? "text-white" : ""}`}>
        {label}
      </span>
      {badge && (
        <span className="rounded-md bg-[#ff1979]/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[#ff1979]">
          {badge}
        </span>
      )}
      {active && !nested && <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />}
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
  const infoLinks = [
    { label: "About", href: "/about" },
    { label: "Terms of Service", href: "/terms" },
    { label: "Privacy Policy", href: "/privacy" },
    { label: "Responsible Gaming", href: "/responsible-gaming" },
  ];
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
    <footer className="border-t border-white/[0.06] bg-[#121214]">
      <div className="mx-auto grid gap-10 px-6 py-12 xl:px-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1.1fr]">
        {/* Brand + company */}
        <div className="flex flex-col gap-4">
          <div>
            <div className="mb-1.5 text-xl font-black tracking-tight text-white">Nezeem</div>
            <p className="max-w-sm text-[12px] leading-relaxed text-slate-500">
              Sports, Aviator, predictions, P2P, binary &amp; forex — one Smart Wallet.
            </p>
          </div>

          <div className="rounded-xl bg-white/[0.03] px-3.5 py-3 ring-1 ring-white/[0.06]">
            <p className="text-[11px] font-black uppercase tracking-[0.12em] text-slate-500">
              Operated by
            </p>
            <p className="mt-1 text-[13px] font-bold text-slate-200">{COMPANY.legalName}</p>
            <p className="mt-0.5 text-[11px] text-slate-500">Company No. {COMPANY.companyNumber}</p>
            <address className="mt-2 not-italic text-[12px] leading-relaxed text-slate-400">
              {COMPANY.registeredOffice.building}<br />
              {COMPANY.registeredOffice.street}, {COMPANY.registeredOffice.locality}<br />
              {COMPANY.registeredOffice.county}, {COMPANY.registeredOffice.country}<br />
              {COMPANY.registeredOffice.postal}
            </address>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={COMPANY.social.telegram}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Telegram"
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#229ED9]/15 text-[#229ED9] transition hover:bg-[#229ED9]/25"
            >
              <TelegramIcon />
            </a>
            <a
              href={COMPANY.social.telegram}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[12px] font-semibold text-slate-400 transition hover:text-white"
            >
              @nezeemofficial
            </a>
          </div>
        </div>

        {/* Information */}
        <div>
          <h4 className="mb-4 text-[10px] font-black uppercase tracking-[0.14em] text-slate-600">
            Information
          </h4>
          <ul className="space-y-2.5">
            {infoLinks.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="text-[13px] text-slate-500 transition hover:text-white">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Products */}
        <div>
          <h4 className="mb-4 text-[10px] font-black uppercase tracking-[0.14em] text-slate-600">
            Products
          </h4>
          <ul className="space-y-2.5">
            {products.map((l) => (
              <li key={l.label}>
                <Link href={l.href} className="text-[13px] text-slate-500 transition hover:text-white">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Contact */}
        <div className="flex flex-col gap-4">
          <h4 className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-600">
            Contact
          </h4>
          <div className="flex flex-col gap-2">
            <a
              href={`mailto:${COMPANY.emails.business}`}
              className="flex items-center gap-2 text-[12px] text-slate-400 transition hover:text-white"
            >
              <Icon name="mail" className="text-[15px] text-slate-600" />
              {COMPANY.emails.business}
            </a>
            <a
              href={`mailto:${COMPANY.emails.partners}`}
              className="flex items-center gap-2 text-[12px] text-slate-400 transition hover:text-white"
            >
              <Icon name="handshake" className="text-[15px] text-slate-600" />
              {COMPANY.emails.partners}
            </a>
            <a
              href={COMPANY.social.telegram}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-[12px] text-slate-400 transition hover:text-white"
            >
              <span className="text-[#229ED9]"><TelegramIcon /></span>
              Telegram support
            </a>
          </div>
          <div className="mt-1 flex items-start gap-2.5 rounded-xl bg-amber-400/[0.06] px-3 py-2.5 ring-1 ring-amber-400/10">
            <span className="mt-0.5 flex h-6 w-8 shrink-0 items-center justify-center rounded border border-amber-400/30 text-[10px] font-black text-amber-300">
              18+
            </span>
            <p className="text-[11px] leading-snug text-slate-400">
              Gambling involves risk. Play responsibly.{" "}
              <Link href="/responsible-gaming" className="text-amber-300/90 underline-offset-2 hover:underline">
                Learn more
              </Link>
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.05] px-6 py-4 xl:px-10">
        <p className="text-[11px] text-slate-600">
          © {new Date().getFullYear()} {COMPANY.brand} · {COMPANY.legalName}. All rights reserved.
        </p>
        <p className="text-[11px] text-slate-600">18+ only · Play responsibly</p>
      </div>
    </footer>
  );
}
