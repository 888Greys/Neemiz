"use client";

import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSupabaseAuth } from "@/lib/supabase/auth-context";
import { mobileNav } from "@/lib/mock-data";
import { BrandLogo } from "@/components/brand-logo";
import { Icon } from "@/components/icon";
import { LoginModal } from "@/components/login-modal";
import { RegisterModal } from "@/components/register-modal";
import { ProfileModal } from "@/components/profile-modal";
import { WalletModal } from "@/components/wallet-modal";
import { toast } from "@/lib/toast";
import { NotificationsBell } from "@/components/notifications-dropdown";
import { AuthModalContext } from "@/lib/auth-modal-context";
import { BetslipProvider, useBetslip } from "@/lib/betslip-context";
import { useWalletBalance } from "@/lib/use-wallet-balance";

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
};

export function AppShell({ children, rightPanel, mainBg, hideFooter = false, fullHeight = false }: AppShellProps) {
  const pathname = usePathname();
  const isLogin = pathname === "/login";
  const isSportsPage = pathname.startsWith("/sports");
  const { isSignedIn, user } = useSupabaseAuth();
  const meta = user?.user_metadata ?? {};
  const displayName = meta.username ?? meta.first_name ?? user?.email?.split("@")[0] ?? "User";
  const initials = displayName.charAt(0).toUpperCase();
  const avatarUrl = typeof meta.avatar_url === "string" ? meta.avatar_url : typeof meta.picture === "string" ? meta.picture : null;
  const { balance, currency, refresh: refreshWalletBalance } = useWalletBalance();
  const fmtBalance = isSignedIn
    ? `${currency === "KES" ? "KSh" : currency} ${balance.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : null;
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window === "undefined") return true;
    const stored = localStorage.getItem("sidebar-collapsed");
    return stored === null ? true : stored === "true";
  });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loginOpen, setLoginOpen]             = useState(false);
  const [registerOpen, setRegisterOpen]       = useState(false);
  const [profileOpen, setProfileOpen]         = useState(false);
  const [profileInitialView, setProfileInitialView] = useState<string | undefined>(undefined);
  const [walletOpen, setWalletOpen]           = useState(false);

  function openProfile(view?: string) {
    setProfileInitialView(view);
    setProfileOpen(true);
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
  }, [pathname]);

  if (isLogin) return <>{children}</>;

  return (
    <BetslipProvider>
    <AuthModalContext.Provider value={{ openLogin: () => setLoginOpen(true), openRegister: () => setRegisterOpen(true), openWallet: () => setWalletOpen(true) }}>
    <div className="min-h-screen overflow-x-hidden bg-background text-on-surface">
      <header className="fixed left-0 right-0 top-0 z-50 flex h-14 max-w-[100vw] items-center overflow-visible bg-[#111113] px-3 lg:h-20 lg:px-0">
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
                {/* Balance → full wallet page (balance, deposit, withdraw, history) */}
                <Link
                  href="/wallet"
                  className="flex items-center gap-1.5 rounded-2xl px-2.5 py-1.5 sm:px-4 sm:py-2 transition hover:bg-[#22242a]"
                >
                  <Icon name="account_balance_wallet" fill className="text-[15px] text-[#087cff]" />
                  <span className="text-xs sm:text-sm font-black text-white">{fmtBalance}</span>
                </Link>
                {/* Quick deposit shortcut */}
                <button
                  type="button"
                  onClick={() => setWalletOpen(true)}
                  className="my-1 mr-1 hidden rounded-lg bg-[#05b957] px-2.5 py-1 text-xs font-black text-white transition hover:bg-[#06d169] sm:inline"
                >
                  Deposit
                </button>
              </div>
              <NotificationsBell />
            </div>
          ) : (
            <div className="flex min-w-0 shrink-0 items-center gap-1.5 sm:gap-2 md:gap-3">
              <button
                onClick={() => setLoginOpen(true)}
                className="rounded-lg bg-[#28292d] px-2.5 py-2 text-[11px] font-black text-white transition hover:bg-[#34353b] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#087cff]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#111113] sm:px-3 sm:text-xs md:rounded-2xl md:px-6 md:py-3 md:text-base"
                type="button"
              >
                Login
              </button>
              <button
                onClick={() => setRegisterOpen(true)}
                className="rounded-lg bg-[#05b957] px-2.5 py-2 text-[11px] font-black text-white transition hover:bg-[#08c963] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#05b957]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#111113] sm:px-3 sm:text-xs md:rounded-2xl md:px-6 md:py-3 md:text-base"
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
        <aside
          className={`hidden shrink-0 overflow-hidden border-r border-white/10 bg-[#1b1c20] transition-[width] duration-300 ease-out lg:block ${
            sidebarCollapsed ? "w-[78px]" : "w-[280px]"
          }`}
        >
          <Sidebar collapsed={sidebarCollapsed} onToggle={toggleSidebar} pathname={pathname} onOpenWallet={() => setWalletOpen(true)} onOpenBonuses={() => openProfile("bonuses")} onOpenSupport={() => openProfile("support")} />
        </aside>

        <main ref={mainRef} data-app-scroll="true" className={`no-scrollbar min-w-0 flex-1 overflow-x-hidden overflow-y-auto lg:pl-3 lg:pb-0 ${fullHeight ? "pb-14 lg:overflow-hidden" : "pb-32"} ${mainBg ?? "bg-background"}`}>
          {fullHeight ? (
            <div className="h-full min-w-0 max-w-full overflow-x-hidden lg:h-[calc(100vh-5rem)]">{children}</div>
          ) : (
            <div className="flex min-h-screen min-w-0 max-w-full flex-col overflow-x-hidden">
              <div className="min-w-0 flex-1">{children}</div>
              {!hideFooter && <AppFooter />}
            </div>
          )}
        </main>

        {rightPanel && <aside className="hidden w-80 shrink-0 bg-surface-container-lowest lg:flex">{rightPanel}</aside>}
      </div>

      {loginOpen && <LoginModal onClose={() => setLoginOpen(false)} onSwitchToRegister={() => { setLoginOpen(false); setRegisterOpen(true); }} />}
      {registerOpen && <RegisterModal onClose={() => setRegisterOpen(false)} onSwitchToLogin={() => { setRegisterOpen(false); setLoginOpen(true); }} />}
      {profileOpen && <ProfileModal onClose={() => { setProfileOpen(false); setProfileInitialView(undefined); }} onOpenWallet={() => { setProfileOpen(false); setWalletOpen(true); }} initialView={profileInitialView as Parameters<typeof ProfileModal>[0]["initialView"]} />}
      {walletOpen && <WalletModal onClose={() => setWalletOpen(false)} onDepositConfirmed={refreshWalletBalance} />}
      {mobileMenuOpen && <MobileMenuDrawer onClose={() => setMobileMenuOpen(false)} onOpenLogin={() => { setMobileMenuOpen(false); setLoginOpen(true); }} onOpenRegister={() => { setMobileMenuOpen(false); setRegisterOpen(true); }} onOpenProfile={() => { setMobileMenuOpen(false); setProfileOpen(true); }} onOpenWallet={() => { setMobileMenuOpen(false); setWalletOpen(true); }} onOpenBonuses={() => { setMobileMenuOpen(false); openProfile("bonuses"); }} onOpenSupport={() => { setMobileMenuOpen(false); openProfile("support"); }} />}

      {rightPanel && isSportsPage && <MobileBetslipSheet>{rightPanel}</MobileBetslipSheet>}
      <nav className="fixed bottom-0 left-0 right-0 z-50 flex h-14 items-center justify-around border-t border-white/10 bg-[#111113] px-1 shadow-lg lg:hidden">
        {mobileNav.map((item) => {
          const activePath = "activePath" in item ? item.activePath : (item.href ?? "").split("?")[0].split("#")[0];
          const active = activePath === pathname;
          if (item.label === "Menu") {
            return (
              <button key={item.label} className="flex h-full min-w-0 flex-1 flex-col items-center justify-center rounded text-[9px] text-on-surface-variant focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#087cff]/70 focus-visible:ring-inset" onClick={() => setMobileMenuOpen(true)} type="button">
                <Icon name={item.icon} className="text-[20px]" />
                <span className="mt-0.5 font-bold leading-none">{item.label}</span>
              </button>
            );
          }


          return (
            <Link key={item.label} href={item.href ?? "/"} className={`flex h-full min-w-0 flex-1 flex-col items-center justify-center rounded text-[9px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#087cff]/70 focus-visible:ring-inset ${active ? "text-[#087cff]" : "text-on-surface-variant"}`}>
              <Icon name={item.icon} fill={active} className="text-[20px]" />
              <span className="mt-0.5 max-w-full truncate font-bold leading-none">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
    </AuthModalContext.Provider>
    </BetslipProvider>
  );
}

function TopNavLink({ href, icon, label, pathname }: { href: string; icon: string; label: string; pathname: string }) {
  const active = href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href);

  return (
    <Link
      href={href}
      className={`flex items-center gap-1.5 rounded-xl px-4 py-2.5 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#087cff]/70 focus-visible:ring-offset-1 focus-visible:ring-offset-[#18191d] ${
        active
          ? "bg-[#087cff] text-white shadow-[0_4px_16px_rgba(8,124,255,.35)]"
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

function Sidebar({ collapsed, onToggle, onOpenWallet, onOpenBonuses, onOpenSupport, pathname }: { collapsed: boolean; onToggle: () => void; onOpenWallet: () => void; onOpenBonuses: () => void; onOpenSupport: () => void; pathname: string }) {
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
          <SidebarItem collapsed={collapsed} href="/sports?tab=Top" icon="local_fire_department" label="Top" pathname={pathname} suppressActive />
          <SidebarItem collapsed={collapsed} href="/sports?tab=Live" icon="sensors" label="Live" pathname={pathname} suppressActive />
          <SidebarItem collapsed={collapsed} href="/sports?tab=Esports" icon="sports_esports" label="Esports" pathname={pathname} suppressActive />
          <SidebarItem collapsed={collapsed} href="/sports?tab=Sports" icon="calendar_month" label="All Sports" pathname={pathname} suppressActive />
          <SidebarItem collapsed={collapsed} href="/sports?tab=Markets" icon="trending_up" label="Markets" pathname={pathname} suppressActive />
          <SidebarItem collapsed={collapsed} href="/my-bets" icon="receipt_long" label="My Bets" pathname={pathname} />
        </SidebarGroup>

        {/* Aviator */}
        <StandaloneSidebarItem collapsed={collapsed} href="/aviator" icon="rocket_launch" label="Aviator" pathname={pathname} badge="HOT" />

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
          <StandaloneSidebarItem collapsed={collapsed} href="/wallet" icon="account_balance_wallet" label="Wallet" pathname={pathname} />
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

        <div className={`mb-4 flex items-center gap-1.5 ${collapsed ? "flex-col" : ""}`}>
          <a
            href={`https://wa.me/${process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP ?? "254700000000"}`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="WhatsApp"
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#2d2f35] text-white transition hover:bg-white/[0.08]"
          >
            <Icon name="chat" fill className="text-[19px]" />
          </a>
          <a
            href="https://t.me/NeezemSupport"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Telegram"
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#2d2f35] text-white transition hover:bg-white/[0.08]"
          >
            <TelegramIcon />
          </a>
          <a
            href="https://instagram.com/nezeem"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Instagram"
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#2d2f35] text-white transition hover:bg-white/[0.08]"
          >
            <Icon name="photo_camera" fill className="text-[19px]" />
          </a>
          {!collapsed && (
            <button
              type="button"
              onClick={() => toast.info("Language", "More language options are coming soon!")}
              className="ml-auto flex h-9 items-center gap-1 rounded-xl bg-[#2d2f35] px-2.5 text-xs font-bold transition hover:bg-white/[0.08]"
            >
              <span className="text-base leading-none">🇬🇧</span>
              EN
              <Icon name="expand_more" className="text-[18px]" />
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={onOpenSupport}
          className={`flex w-full items-center rounded-2xl transition hover:bg-white/[0.03] ${collapsed ? "justify-center" : "gap-3"}`}
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#2d2f35]">
            <Icon name="support_agent" fill className="text-[19px]" />
          </span>
          {!collapsed && (
            <>
              <span className="flex-1 text-left text-base font-black">Support</span>
              <span className="rounded-full bg-[#087cff] px-2.5 py-0.5 text-xs font-black text-white">24/7</span>
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
      title={collapsed ? label : undefined}
      className={className}
    >
      {content}
    </Link>
  );
}

function NestedSidebarItem({ href, icon, label, truncate }: { href: string; icon: string; label: string; truncate?: boolean }) {
  return (
    <Link href={href} className="flex items-center gap-3 rounded-lg px-2 py-2 text-sm font-bold text-slate-300 transition hover:bg-white/[0.05] hover:text-white">
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
    <Link href={href} title={collapsed ? label : undefined} className={cls}>
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

function MobileMenuDrawer({ onClose, onOpenLogin, onOpenRegister, onOpenProfile, onOpenWallet, onOpenBonuses, onOpenSupport }: { onClose: () => void; onOpenLogin: () => void; onOpenRegister: () => void; onOpenProfile: () => void; onOpenWallet: () => void; onOpenBonuses: () => void; onOpenSupport: () => void }) {
  const { isSignedIn, user, signOut } = useSupabaseAuth();
  const router = useRouter();
  const { balance, currency } = useWalletBalance();
  const meta = user?.user_metadata ?? {};
  const displayName = meta.username ?? meta.first_name ?? user?.email?.split("@")[0] ?? "User";
  const initials = displayName.charAt(0).toUpperCase();
  const avatarUrl = typeof meta.avatar_url === "string" ? meta.avatar_url : typeof meta.picture === "string" ? meta.picture : null;
  const fmtBalance = isSignedIn
    ? `${currency === "KES" ? "KSh" : currency} ${balance.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : null;

  const [openGroups, setOpenGroups] = useState({
    sports: false,
    p2p: false,
  });

  return (
    <div className="fixed inset-0 z-[60] bg-black/65 animate-fade-in lg:hidden">
      <aside className="animate-drawer-in relative flex h-full w-[72vw] max-w-[310px] min-w-[255px] flex-col bg-[#1b1c20] shadow-2xl">
        <button className="absolute -right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-[#3a3d45] text-white" onClick={onClose} type="button" aria-label="Close menu">
          <Icon name="close" className="text-[18px]" />
        </button>

        <div className="no-scrollbar flex-1 overflow-y-auto p-2">
          {isSignedIn ? (
            /* ── Signed-in user header ── */
            <div className="mb-3">
              <button
                type="button"
                onClick={onOpenProfile}
                className="flex w-full items-center gap-3 rounded-xl bg-[#28292d] px-3 py-2.5 transition hover:bg-[#32343b]"
              >
                <UserAvatar src={avatarUrl} initials={initials} className="h-9 w-9 shrink-0" />
                <div className="min-w-0 flex-1 text-left">
                  <p className="truncate text-[13px] font-black text-white">{displayName}</p>
                  <p className="text-[10px] text-slate-500">View profile</p>
                </div>
                <Icon name="chevron_right" className="text-[16px] text-slate-500" />
              </button>
              <Link
                href="/wallet"
                onClick={onClose}
                className="mt-1.5 flex w-full items-center justify-between rounded-xl bg-gradient-to-r from-[#087cff]/20 to-[#16171d] px-3 py-2.5 ring-1 ring-[#087cff]/20 transition hover:ring-[#087cff]/40"
              >
                <div className="flex items-center gap-2">
                  <Icon name="account_balance_wallet" fill className="text-[15px] text-[#087cff]" />
                  <span className="text-xs font-black text-white">{fmtBalance}</span>
                </div>
                <span className="rounded-lg bg-[#05b957] px-3 py-1 text-[10px] font-black text-white">Open Wallet</span>
              </Link>
            </div>
          ) : (
            /* ── Guest header ── */
            <div className="mb-2 flex gap-2">
              <button onClick={onOpenLogin} className="flex flex-1 items-center gap-2 rounded-xl bg-[#28292d] px-3 py-2 text-left" type="button">
                <Icon name="person" fill className="text-[16px] text-slate-300" />
                <span className="text-xs font-black">Log in</span>
              </button>
              <button onClick={onOpenRegister} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#05b957] px-3 py-2" type="button">
                <span className="text-xs font-black text-white">Register</span>
              </button>
            </div>
          )}

          <button
            type="button"
            className="mb-4 flex h-[54px] w-full items-center justify-between overflow-hidden rounded-xl bg-gradient-to-r from-[#044947] to-[#05605d] bg-cover bg-center px-3"
            onClick={onOpenWallet}
            style={{ backgroundImage: `linear-gradient(90deg, rgba(4,73,71,.88), rgba(5,96,93,.52)), url(${tempAssets.freebet})` }}
          >
            <span className="text-xs font-black leading-tight">
              Free<br />money
            </span>
            <Icon name="payments" className="text-[38px] text-white/80" />
          </button>

          {/* Sports */}
          <MobileDrawerGroup icon="sports_soccer" isOpen={openGroups.sports} label="Sports" onToggle={() => setOpenGroups((v) => ({ ...v, sports: !v.sports }))}>
            <MobileDrawerLink href="/sports?tab=Top" icon="local_fire_department" label="Top" onClick={onClose} />
            <MobileDrawerLink href="/sports?tab=Live" icon="sensors" label="Live" onClick={onClose} />
            <MobileDrawerLink href="/sports?tab=Esports" icon="sports_esports" label="Esports" onClick={onClose} />
            <MobileDrawerLink href="/sports?tab=Sports" icon="calendar_month" label="All Sports" onClick={onClose} />
            <MobileDrawerLink href="/sports?tab=Markets" icon="trending_up" label="Markets" onClick={onClose} />
            <MobileDrawerLink href="/my-bets" icon="receipt_long" label="My Bets" onClick={onClose} />
          </MobileDrawerGroup>

          {/* Aviator */}
          <MobileDrawerLink href="/aviator" icon="rocket_launch" label="Aviator" badge="HOT" onClick={onClose} />

          {/* Polymarket */}
          <MobileDrawerLink href="/polymarket" icon="online_prediction" label="Polymarket" onClick={onClose} />

          {/* P2P */}
          <MobileDrawerGroup icon="swap_horiz" isOpen={openGroups.p2p} label="P2P" onToggle={() => setOpenGroups((v) => ({ ...v, p2p: !v.p2p }))}>
            <MobileDrawerLink href="/p2p" icon="storefront" label="Browse Ads" onClick={onClose} />
            <MobileDrawerLink href="/p2p/merchant" icon="verified_user" label="Merchant Center" onClick={onClose} />
            <MobileDrawerLink href="/p2p/orders" icon="receipt_long" label="My Orders" onClick={onClose} />
          </MobileDrawerGroup>

          {/* Trading */}
          <MobileDrawerLink href="/binary" icon="candlestick_chart" label="Binary" onClick={onClose} />
          <MobileDrawerLink href="/forex" icon="currency_exchange" label="Forex" onClick={onClose} />

          <div className="my-3 border-t border-white/10" />

          <div className="space-y-1">
            <MobileDrawerLink href="/wallet" icon="account_balance_wallet" label="Wallet" onClick={onClose} />
            <MobileDrawerLink icon="redeem" label="Bonuses" badge="1" onClick={onOpenBonuses} />
            <MobileDrawerLink icon="campaign" label="Promotions" onClick={() => { onClose(); toast.info("Promotions", "Seasonal promotions and free bets are launching soon!"); }} />
          </div>
        </div>

        <div className="border-t border-white/10 p-2">
          <div className="mb-2 flex items-center gap-1">
            <a href={`https://wa.me/${process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP ?? "254700000000"}`} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp" className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#2d2f35] text-white transition hover:bg-white/[0.08]">
              <Icon name="chat" fill className="text-[17px]" />
            </a>
            <a href="https://t.me/NeezemSupport" target="_blank" rel="noopener noreferrer" aria-label="Telegram" className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#2d2f35] text-white transition hover:bg-white/[0.08]">
              <TelegramIcon />
            </a>
            <a href="https://instagram.com/nezeem" target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#2d2f35] text-white transition hover:bg-white/[0.08]">
              <Icon name="photo_camera" fill className="text-[17px]" />
            </a>
            <button
              type="button"
              onClick={() => { onClose(); toast.info("Language", "More language options are coming soon!"); }}
              className="ml-auto flex h-8 items-center gap-1 rounded-lg bg-[#2d2f35] px-2 text-[10px] font-black transition hover:bg-white/[0.08]"
            >
              <span>🇬🇧</span> EN
            </button>
          </div>

          <button type="button" onClick={onOpenSupport} className="flex w-full items-center gap-2 rounded-xl transition hover:bg-white/[0.03]">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#2d2f35]">
              <Icon name="support_agent" fill className="text-[17px]" />
            </span>
            <span className="flex-1 text-left text-xs font-black">Support</span>
            <span className="rounded-full bg-[#087cff] px-2 py-0.5 text-[10px] font-black">24/7</span>
          </button>

          {isSignedIn && (
            <button
              type="button"
              className="mt-2 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-red-400 transition hover:bg-red-500/10"
              onClick={async () => {
                onClose();
                await signOut();
                toast.info("Signed out", "See you next time!");
                router.push("/");
              }}
            >
              <Icon name="logout" className="text-[16px]" />
              <span className="text-xs font-black">Sign Out</span>
            </button>
          )}
        </div>
      </aside>
    </div>
  );
}

function MobileDrawerGroup({ children, icon, isOpen, label, onToggle }: { children: React.ReactNode; icon: string; isOpen: boolean; label: string; onToggle: () => void }) {
  return (
    <section className="mb-1">
      <button className="flex w-full items-center gap-2 rounded-lg px-1 py-2 text-left text-xs font-black" onClick={onToggle} type="button">
        <Icon name={icon} fill className="text-[16px] text-slate-400" />
        <span className="flex-1">{label}</span>
        <Icon name={isOpen ? "keyboard_arrow_up" : "keyboard_arrow_down"} className="text-[17px] text-slate-400" />
      </button>
      <div className={`overflow-hidden transition-all duration-200 ease-out ${isOpen ? "max-h-[280px] opacity-100" : "max-h-0 opacity-0"}`}>
        <div className="ml-3 border-l border-white/10 pl-2">{children}</div>
      </div>
    </section>
  );
}

function MobileDrawerLink({ badge, href, icon, label, onClick }: { badge?: string; href?: string; icon: string; label: string; onClick: () => void }) {
  const cls = "flex items-center gap-2 rounded-lg px-1 py-2 text-[11px] font-black text-slate-200";
  const inner = (
    <>
      <Icon name={icon} fill className="text-[16px] text-slate-400" />
      <span className="flex-1">{label}</span>
      {badge && <span className="rounded-full bg-[#ff1979] px-2 py-0.5 text-[9px]">{badge}</span>}
    </>
  );
  if (!href) {
    return <button type="button" className={cls} onClick={onClick}>{inner}</button>;
  }
  return (
    <Link href={href} className={cls} onClick={onClick}>
      {inner}
    </Link>
  );
}

/* ── Mobile Betslip Sheet ───────────────────────────────── */
function MobileBetslipSheet({ children }: { children: React.ReactNode }) {
  const { bets } = useBetslip();
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* FAB — sits just above the bottom nav */}
      <div className="fixed bottom-[84px] left-0 right-0 z-40 flex justify-center lg:hidden pointer-events-none">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="pointer-events-auto flex items-center gap-2.5 rounded-full bg-[#16171d] pl-4 pr-3 py-2.5 ring-1 ring-white/[0.12] shadow-[0_4px_24px_rgba(0,0,0,.5)] transition active:scale-[0.97]"
        >
          <Icon name="receipt_long" fill className={`text-[18px] ${bets.length > 0 ? "text-[#087cff]" : "text-slate-500"}`} />
          <span className={`text-[13px] font-black ${bets.length > 0 ? "text-white" : "text-slate-400"}`}>
            Betslip
          </span>
          {bets.length > 0 ? (
            <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#087cff] px-1.5 text-[10px] font-black text-white">
              {bets.length}
            </span>
          ) : (
            <Icon name="expand_less" className="text-[16px] text-slate-500" />
          )}
        </button>
      </div>

      {/* Bottom sheet */}
      {open && (
        <div className="fixed bottom-14 left-0 right-0 top-0 z-[45] lg:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/70 animate-fade-in"
            onClick={() => setOpen(false)}
          />
          {/* Sheet */}
          <div className="animate-sheet-in absolute bottom-0 left-0 right-0 flex h-[calc(100dvh-3.5rem)] max-h-[calc(93dvh-3.5rem)] flex-col rounded-t-3xl bg-[#0d0e11] shadow-2xl">
            {/* Handle bar */}
            <div className="flex shrink-0 items-center justify-between px-4 pt-3 pb-1">
              <div className="mx-auto h-1 w-10 rounded-full bg-white/[0.15]" />
            </div>
            {/* Close row */}
            <div className="flex shrink-0 items-center justify-between border-b border-white/[0.07] px-4 pb-2">
              <span className="text-[11px] font-black uppercase tracking-widest text-slate-500">Betslip</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-white/[0.07] text-slate-400 transition hover:bg-white/[0.12] hover:text-white"
              >
                <Icon name="close" className="text-[16px]" />
              </button>
            </div>
            {/* Betslip content */}
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
    { label: "Predictions", href: "/predictions" },
    { label: "P2P Trading", href: "/p2p" },
    { label: "Binary", href: "/binary" },
    { label: "Forex", href: "/forex" },
    { label: "Smart Wallet", href: "/wallet" },
  ];

  return (
    <footer className="border-t border-white/[0.06] bg-[#0d0e11]">
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

export function BetSlip() {
  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex border-b border-outline-variant">
        <button className="flex-1 border-b-2 border-primary bg-surface-variant/30 py-3 text-sm font-semibold text-primary">
          Betslip <span className="ml-1 rounded-full bg-primary px-2 py-0.5 text-[10px] text-on-primary">2</span>
        </button>
        <button className="flex-1 py-3 text-sm font-semibold text-on-surface-variant">My Bets</button>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {[
          ["Real Madrid vs Man City", "Real Madrid (Match Result)", "1.85"],
          ["Arsenal vs Liverpool", "Over 2.5 Goals", "1.86"],
        ].map(([event, pick, odds]) => (
          <div key={pick} className="relative rounded border border-outline-variant bg-surface-container p-3">
            <button className="absolute right-2 top-2 text-on-surface-variant">
              <Icon name="close" className="text-[16px]" />
            </button>
            <div className="mb-1 text-xs text-on-surface-variant">{event}</div>
            <div className="pr-6 text-sm font-bold text-on-surface">{pick}</div>
            <div className="mt-3 flex justify-between border-t border-outline-variant/50 pt-2 text-sm">
              <span className="text-on-surface-variant">Odds</span>
              <span className="font-mono font-bold text-primary">{odds}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="border-t border-outline-variant bg-surface-container p-4">
        <div className="mb-2 flex justify-between">
          <span className="text-on-surface-variant">Total Odds</span>
          <span className="font-mono text-lg font-bold">3.45</span>
        </div>
        <div className="relative my-3">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-on-surface-variant">$</span>
          <input className="w-full rounded border border-outline-variant bg-surface-dim py-2 pl-8 pr-4 font-mono outline-none focus:border-primary" placeholder="Stake amount" type="number" />
        </div>
        <div className="mb-4 flex justify-between">
          <span className="text-on-surface-variant">Est. Payout</span>
          <span className="font-mono text-lg font-bold text-[#22C55E]">--</span>
        </div>
        <button className="w-full rounded bg-primary-container py-3 font-semibold text-on-primary-container transition hover:bg-primary">Place Bet</button>
      </div>
    </div>
  );
}
