"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { SignUpButton } from "@clerk/nextjs";
import { mobileNav } from "@/lib/mock-data";
import { BrandLogo } from "@/components/brand-logo";
import { Icon } from "@/components/icon";
import { LoginModal } from "@/components/login-modal";

const tempAssets = {
  appInstall: "https://v3.bundlecdn.com/b02632/plain/bonus/app-install/phone-small-v1.png",
  freebet: "https://v3.bundlecdn.com/b02632/plain/betting/brand-freebet.png",
};

type AppShellProps = {
  children: React.ReactNode;
  rightPanel?: React.ReactNode;
};

export function AppShell({ children, rightPanel }: AppShellProps) {
  const pathname = usePathname();
  const isLogin = pathname === "/login";
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window === "undefined") return true;
    const stored = localStorage.getItem("sidebar-collapsed");
    return stored === null ? true : stored === "true";
  });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);

  const toggleSidebar = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("sidebar-collapsed", String(next));
      return next;
    });
  };

  if (isLogin) return <>{children}</>;

  return (
    <div className="min-h-screen bg-background text-on-surface">
      <header className="fixed left-0 right-0 top-0 z-50 flex h-14 items-center bg-[#111113] px-3 lg:h-20 lg:px-0">
        <div
          className={`hidden h-full shrink-0 items-center border-r border-white/10 px-4 transition-[width] duration-300 ease-out lg:flex ${
            sidebarCollapsed ? "w-[78px] justify-center" : "w-[280px]"
          }`}
        >
          {sidebarCollapsed ? (
            <button onClick={() => setLoginOpen(true)} className="flex h-12 w-12 items-center justify-center rounded-full bg-[#34363b] text-slate-300" type="button">
              <Icon name="person" fill className="text-[28px]" />
            </button>
          ) : (
            <button onClick={() => setLoginOpen(true)} className="flex w-full items-center gap-3 rounded-2xl text-left transition hover:bg-white/[0.03]" type="button">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#34363b] text-slate-300">
                <Icon name="person" fill className="text-[32px]" />
              </span>
              <span className="flex-1 text-lg font-black">Log in</span>
              <Icon name="chevron_right" className="text-[32px] text-slate-400" />
            </button>
          )}
        </div>

        <div className="flex min-w-0 flex-1 items-center justify-between gap-3 lg:gap-5 lg:px-6">
          <div className="flex min-w-0 items-center gap-6">
            <BrandLogo href="/dashboard" size="sm" />
            <nav className="hidden items-center gap-0.5 rounded-2xl bg-[#18191d] p-1 ring-1 ring-white/[0.06] text-sm font-black md:flex">
              <TopNavLink href="/dashboard" icon="home" label="Home" pathname={pathname} />
              <TopNavLink href="/p2p" icon="swap_horiz" label="P2P" pathname={pathname} />
              <TopNavLink href="/aviator" icon="rocket_launch" label="Aviator" pathname={pathname} />
              <TopNavLink href="/predictions" icon="online_prediction" label="Polymarket" pathname={pathname} />
              <TopNavLink href="/binary" icon="candlestick_chart" label="Binary" pathname={pathname} />
            </nav>
          </div>
          <div className="flex shrink-0 items-center gap-2 md:gap-3">
            <button
              onClick={() => setLoginOpen(true)}
              className="rounded-lg bg-[#28292d] px-3 py-2 text-xs font-black text-white transition hover:bg-[#34353b] md:rounded-2xl md:px-6 md:py-3 md:text-base"
              type="button"
            >
              Login
            </button>
            <SignUpButton mode="modal">
              <button className="rounded-lg bg-[#05b957] px-3 py-2 text-xs font-black text-white transition hover:bg-[#08c963] md:rounded-2xl md:px-6 md:py-3 md:text-base">
                Registration
              </button>
            </SignUpButton>
          </div>
        </div>
      </header>

      <div className="flex h-screen overflow-hidden pt-14 lg:pt-20">
        <aside
          className={`hidden shrink-0 overflow-visible border-r border-white/10 bg-[#1b1c20] transition-[width] duration-300 ease-out lg:block ${
            sidebarCollapsed ? "w-[78px]" : "w-[280px]"
          }`}
        >
          <Sidebar collapsed={sidebarCollapsed} onToggle={toggleSidebar} pathname={pathname} />
        </aside>

        <main className="flex-1 overflow-y-auto border-r border-outline-variant bg-background pb-24 lg:pb-0">
          {children}
          <AppFooter />
        </main>

        {rightPanel && <aside className="hidden w-80 shrink-0 bg-surface-container-lowest lg:flex">{rightPanel}</aside>}
      </div>

      {loginOpen && <LoginModal onClose={() => setLoginOpen(false)} onSwitchToRegister={() => setLoginOpen(false)} />}
      {mobileMenuOpen && <MobileMenuDrawer onClose={() => setMobileMenuOpen(false)} onOpenLogin={() => { setMobileMenuOpen(false); setLoginOpen(true); }} />}

      <nav className="fixed bottom-0 left-0 right-0 z-50 flex h-12 items-center justify-around border-t border-white/10 bg-[#111113] px-1 shadow-lg lg:hidden">
        {mobileNav.map((item) => {
          const activePath = "activePath" in item ? item.activePath : item.href.split("?")[0].split("#")[0];
          const active = activePath === pathname;
          if (item.label === "Menu") {
            return (
              <button key={item.label} className="flex h-full min-w-0 flex-1 flex-col items-center justify-center rounded text-[8px] text-on-surface-variant" onClick={() => setMobileMenuOpen(true)} type="button">
                <Icon name={item.icon} className="text-[18px]" />
                <span className="mt-0.5 font-bold leading-none">{item.label}</span>
              </button>
            );
          }

          return (
            <Link key={item.label} href={item.href} className={`flex h-full min-w-0 flex-1 flex-col items-center justify-center rounded text-[8px] ${active ? "text-[#087cff]" : "text-on-surface-variant"}`}>
              <Icon name={item.icon} fill={active} className="text-[18px]" />
              <span className="mt-0.5 max-w-full truncate font-bold leading-none">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

function TopNavLink({ href, icon, label, pathname }: { href: string; icon: string; label: string; pathname: string }) {
  const active = href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href);

  return (
    <Link
      href={href}
      className={`flex items-center gap-1.5 rounded-xl px-4 py-2.5 transition-all duration-150 ${
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

function Sidebar({ collapsed, onToggle, pathname }: { collapsed: boolean; onToggle: () => void; pathname: string }) {
  const [openGroups, setOpenGroups] = useState({
    sports: true,
    casino: true,
    markets: false,
    trade: false,
  });

  const toggleGroup = (group: keyof typeof openGroups) => {
    setOpenGroups((current) => ({ ...current, [group]: !current[group] }));
  };

  return (
    <div className="relative flex h-full flex-col">
      <button
        className="absolute -right-5 top-44 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-[#353740] text-slate-300 shadow-xl transition hover:bg-[#424550] hover:text-white"
        type="button"
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        onClick={onToggle}
      >
        <Icon name={collapsed ? "keyboard_double_arrow_right" : "keyboard_double_arrow_left"} className="text-[26px]" />
      </button>

      <div className={`no-scrollbar flex-1 overflow-y-auto py-5 ${collapsed ? "px-2" : "px-4"}`}>
        {/* Sports */}
        <SidebarGroup collapsed={collapsed} icon="sports_soccer" isOpen={openGroups.sports} onToggle={() => toggleGroup("sports")} title="Sports">
          <SidebarItem collapsed={collapsed} href="/sports" icon="local_fire_department" label="Top Events" pathname={pathname} suppressActive />
          <SidebarItem collapsed={collapsed} href="/sports?tab=live" icon="sensors" label="Live" pathname={pathname} suppressActive />
          <SidebarItem collapsed={collapsed} href="/sports?tab=esports" icon="sports_martial_arts" label="Esports" pathname={pathname} suppressActive />
          <SidebarItem collapsed={collapsed} href="/sports?tab=all" icon="calendar_month" label="All Sports" pathname={pathname} suppressActive />
          <SidebarItem collapsed={collapsed} href="/sports?tab=history" icon="manage_history" label="Bet History" pathname={pathname} suppressActive />
        </SidebarGroup>

        {/* Casino */}
        <SidebarGroup collapsed={collapsed} icon="casino" isOpen={openGroups.casino} onToggle={() => toggleGroup("casino")} title="Casino">
          <SidebarItem collapsed={collapsed} href="/aviator" icon="rocket_launch" label="Aviator" pathname={pathname} badge="HOT" highlight direct />
          <SidebarItem collapsed={collapsed} href="/dashboard#slots" icon="casino" label="Slots" pathname={pathname} direct suppressActive />
          <SidebarItem collapsed={collapsed} href="/dashboard#live-casino" icon="live_tv" label="Live Casino" pathname={pathname} direct suppressActive />
          <SidebarItem collapsed={collapsed} href="/dashboard#fast-games" icon="bolt" label="Fast Games" pathname={pathname} direct suppressActive />
          <SidebarItem collapsed={collapsed} href="/dashboard#tournaments" icon="emoji_events" label="Tournaments" pathname={pathname} direct suppressActive />
        </SidebarGroup>

        {/* Markets */}
        <SidebarGroup collapsed={collapsed} icon="online_prediction" isOpen={openGroups.markets} onToggle={() => toggleGroup("markets")} title="Markets">
          <SidebarItem collapsed={collapsed} href="/predictions" icon="bar_chart" label="Predictions" pathname={pathname} direct />
          <SidebarItem collapsed={collapsed} href="/p2p" icon="swap_horiz" label="P2P Trading" pathname={pathname} direct />
        </SidebarGroup>

        {/* Trade */}
        <SidebarGroup collapsed={collapsed} icon="trending_up" isOpen={openGroups.trade} onToggle={() => toggleGroup("trade")} title="Trade">
          <SidebarItem collapsed={collapsed} href="/binary" icon="candlestick_chart" label="Binary & Forex" pathname={pathname} direct />
        </SidebarGroup>

        <div className={`${collapsed ? "mx-1" : "-mx-4"} my-4 border-t border-white/10`} />

        {/* Utility */}
        <div className="space-y-1">
          <StandaloneSidebarItem collapsed={collapsed} href="/wallet" icon="account_balance_wallet" label="Wallet" pathname={pathname} />
          <StandaloneSidebarItem collapsed={collapsed} href="/wallet#bonuses" icon="redeem" label="Bonuses" pathname={pathname} badge="1" />
          <StandaloneSidebarItem collapsed={collapsed} href="/dashboard#promotions" icon="campaign" label="Promotions" pathname={pathname} />
        </div>
      </div>

      <div className={`border-t border-white/10 ${collapsed ? "p-2" : "p-4"}`}>
        <Link href="/dashboard" className={`mb-2 flex items-center rounded-2xl bg-[#32343b] transition hover:bg-[#3a3c44] ${collapsed ? "justify-center p-2" : "gap-2.5 p-2.5"}`}>
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-500 bg-cover bg-center text-white"
            style={{ backgroundImage: `url(${tempAssets.appInstall})` }}
          >
            <Icon name="desktop_windows" fill className="text-[21px]" />
          </span>
          {!collapsed && (
            <>
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-black leading-4">Nezeem for Windows</span>
                <span className="block text-[11px] leading-4 text-slate-300">Instant access to the platform</span>
              </span>
              <Icon name="chevron_right" className="text-[22px] text-slate-300" />
            </>
          )}
        </Link>

        <div className={`mb-4 flex items-center gap-1.5 ${collapsed ? "flex-col" : ""}`}>
          {[
            ["chat", "WhatsApp"],
            ["telegram", "Telegram"],
            ["photo_camera", "Instagram"],
            ...(!collapsed ? [["more_vert", "More"]] : []),
          ].map(([icon, label]) => (
            <button
              key={label}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#2d2f35] text-white transition hover:bg-[#393b43]"
              type="button"
              aria-label={label}
            >
              {icon === "telegram" ? <TelegramIcon /> : <Icon name={icon} fill={icon !== "more_vert"} className="text-[19px]" />}
            </button>
          ))}
          {!collapsed && (
            <button className="ml-auto flex h-9 items-center gap-1 rounded-xl bg-[#2d2f35] px-2.5 text-xs font-bold" type="button">
              <span className="text-base leading-none">🇬🇧</span>
              EN
              <Icon name="expand_more" className="text-[18px]" />
            </button>
          )}
        </div>

        <Link href="/login" className={`flex items-center rounded-2xl transition hover:bg-white/[0.03] ${collapsed ? "justify-center" : "gap-3"}`}>
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#2d2f35]">
            <Icon name="mode_comment" fill className="text-[19px]" />
          </span>
          {!collapsed && (
            <>
              <span className="flex-1 text-base font-black">Support</span>
              <span className="rounded-full bg-[#087cff] px-2.5 py-0.5 text-xs font-black text-white">24/7</span>
            </>
          )}
        </Link>
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
    <section className="mb-5">
      <button
        className={`mb-2 flex w-full items-center rounded-xl text-left text-slate-200 transition hover:bg-white/[0.04] ${
          collapsed ? "justify-center p-2" : "gap-3 px-2 py-1.5"
        }`}
        onClick={onToggle}
        type="button"
        aria-expanded={isOpen}
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full text-slate-300">
          <Icon name={icon} fill className="text-[26px]" />
        </span>
        {!collapsed && (
          <>
            <span className="flex-1 text-lg font-black">{title}</span>
            <Icon name={isOpen ? "keyboard_arrow_up" : "keyboard_arrow_down"} className="text-[24px] text-slate-400" />
          </>
        )}
      </button>
      {isOpen && <div className={collapsed ? "space-y-1" : "ml-4 space-y-1 border-l border-white/10 pl-4"}>{children}</div>}
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
      <Icon name={icon} fill={active || highlight} className={`text-[24px] ${highlight && !active ? "text-violet-400" : "text-slate-400"}`} />
      {!collapsed && (
        <>
          <span className="min-w-0 flex-1 whitespace-nowrap">{label}</span>
          {badge && <span className="rounded-full bg-[#ff1979] px-2 py-0.5 text-[10px] font-black text-white">{badge}</span>}
          <Icon name={direct ? "chevron_right" : isOpen === undefined ? "chevron_right" : isOpen ? "keyboard_arrow_up" : "keyboard_arrow_down"} className="text-[22px] text-slate-400" />
        </>
      )}
    </>
  );
  const className = `flex items-center rounded-xl text-base font-bold transition ${
    collapsed ? "justify-center px-2 py-2.5" : "gap-3 px-3 py-2.5"
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
  pathname,
}: {
  badge?: string;
  collapsed: boolean;
  href: string;
  icon: string;
  label: string;
  pathname: string;
}) {
  const active = pathname.startsWith(href.split("?")[0]) && href !== "/dashboard#promotions";

  return (
    <Link
      href={href}
      title={collapsed ? label : undefined}
      className={`flex items-center rounded-xl text-sm font-black transition ${
        collapsed ? "justify-center px-2 py-2.5" : "gap-3 px-2.5 py-2.5"
      } ${active ? "bg-[#3a3b41] text-white" : "text-slate-300 hover:bg-white/[0.05] hover:text-white"}`}
    >
      <Icon name={icon} fill className="text-[22px] text-slate-400" />
      {!collapsed && (
        <>
          <span className="flex-1">{label}</span>
          {badge && <span className="rounded-full bg-[#ff1979] px-2.5 py-0.5 text-xs font-black text-white">{badge}</span>}
        </>
      )}
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

function MobileMenuDrawer({ onClose, onOpenLogin }: { onClose: () => void; onOpenLogin: () => void }) {
  const [openGroups, setOpenGroups] = useState({
    sports: false,
    casino: false,
    markets: false,
    trade: false,
  });

  return (
    <div className="fixed inset-0 z-[60] bg-black/65 lg:hidden">
      <aside className="relative flex h-full w-[72vw] max-w-[310px] min-w-[255px] flex-col bg-[#1b1c20] shadow-2xl">
        <button className="absolute -right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-[#3a3d45] text-white" onClick={onClose} type="button" aria-label="Close menu">
          <Icon name="close" className="text-[18px]" />
        </button>

        <div className="no-scrollbar flex-1 overflow-y-auto p-2">
          <button onClick={onOpenLogin} className="mb-2 flex w-full items-center gap-2 rounded-xl p-1 text-left" type="button">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#34363b]">
              <Icon name="person" fill className="text-[18px] text-slate-300" />
            </span>
            <span className="flex-1 text-xs font-black">Log in</span>
            <Icon name="chevron_right" className="text-[18px] text-slate-400" />
          </button>

          <Link
            href="/wallet"
            className="mb-4 flex h-[54px] items-center justify-between overflow-hidden rounded-xl bg-gradient-to-r from-[#044947] to-[#05605d] bg-cover bg-center px-3"
            onClick={onClose}
            style={{ backgroundImage: `linear-gradient(90deg, rgba(4,73,71,.88), rgba(5,96,93,.52)), url(${tempAssets.freebet})` }}
          >
            <span className="text-xs font-black leading-tight">
              Free<br />money
            </span>
            <Icon name="payments" className="text-[38px] text-white/80" />
          </Link>

          {/* Sports */}
          <MobileDrawerGroup icon="sports_soccer" isOpen={openGroups.sports} label="Sports" onToggle={() => setOpenGroups((v) => ({ ...v, sports: !v.sports }))}>
            <MobileDrawerLink href="/sports" icon="local_fire_department" label="Top Events" onClick={onClose} />
            <MobileDrawerLink href="/sports?tab=live" icon="sensors" label="Live" onClick={onClose} />
            <MobileDrawerLink href="/sports?tab=esports" icon="sports_martial_arts" label="Esports" onClick={onClose} />
            <MobileDrawerLink href="/sports?tab=all" icon="calendar_month" label="All Sports" onClick={onClose} />
            <MobileDrawerLink href="/sports?tab=history" icon="manage_history" label="Bet History" onClick={onClose} />
          </MobileDrawerGroup>

          {/* Casino */}
          <MobileDrawerGroup icon="casino" isOpen={openGroups.casino} label="Casino" onToggle={() => setOpenGroups((v) => ({ ...v, casino: !v.casino }))}>
            <MobileDrawerLink href="/aviator" icon="rocket_launch" label="Aviator" badge="HOT" onClick={onClose} />
            <MobileDrawerLink href="/dashboard#slots" icon="casino" label="Slots" onClick={onClose} />
            <MobileDrawerLink href="/dashboard#live-casino" icon="live_tv" label="Live Casino" onClick={onClose} />
            <MobileDrawerLink href="/dashboard#fast-games" icon="bolt" label="Fast Games" onClick={onClose} />
            <MobileDrawerLink href="/dashboard#tournaments" icon="emoji_events" label="Tournaments" onClick={onClose} />
          </MobileDrawerGroup>

          {/* Markets */}
          <MobileDrawerGroup icon="online_prediction" isOpen={openGroups.markets} label="Markets" onToggle={() => setOpenGroups((v) => ({ ...v, markets: !v.markets }))}>
            <MobileDrawerLink href="/predictions" icon="bar_chart" label="Predictions" onClick={onClose} />
            <MobileDrawerLink href="/p2p" icon="swap_horiz" label="P2P Trading" onClick={onClose} />
          </MobileDrawerGroup>

          {/* Trade */}
          <MobileDrawerGroup icon="trending_up" isOpen={openGroups.trade} label="Trade" onToggle={() => setOpenGroups((v) => ({ ...v, trade: !v.trade }))}>
            <MobileDrawerLink href="/binary" icon="candlestick_chart" label="Binary & Forex" onClick={onClose} />
          </MobileDrawerGroup>

          <div className="my-3 border-t border-white/10" />

          <div className="space-y-1">
            <MobileDrawerLink href="/wallet" icon="account_balance_wallet" label="Wallet" onClick={onClose} />
            <MobileDrawerLink href="/wallet#bonuses" icon="redeem" label="Bonuses" badge="1" onClick={onClose} />
            <MobileDrawerLink href="/dashboard#promotions" icon="campaign" label="Promotions" onClick={onClose} />
          </div>
        </div>

        <div className="border-t border-white/10 p-2">
          <Link href="/dashboard" className="mb-2 flex items-center gap-2 rounded-xl bg-[#32343b] p-2" onClick={onClose}>
            <span
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500 bg-cover bg-center"
              style={{ backgroundImage: `url(${tempAssets.appInstall})` }}
            >
              <Icon name="desktop_windows" fill className="text-[17px]" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[10px] font-black">Nezeem for iOS</span>
              <span className="block text-[9px] leading-3 text-slate-300">Instant access to the platform</span>
            </span>
            <Icon name="chevron_right" className="text-[17px]" />
          </Link>

          <div className="mb-2 flex items-center gap-1">
            <button className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#2d2f35]" type="button" aria-label="WhatsApp">
              <Icon name="chat" fill className="text-[17px]" />
            </button>
            <button className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#2d2f35]" type="button" aria-label="Telegram">
              <TelegramIcon />
            </button>
            <button className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#2d2f35]" type="button" aria-label="Instagram">
              <Icon name="photo_camera" fill className="text-[17px]" />
            </button>
            <button className="ml-auto flex h-8 items-center gap-1 rounded-lg bg-[#2d2f35] px-2 text-[10px] font-black" type="button">
              <span>🇬🇧</span> EN
            </button>
          </div>

          <Link href="/login" className="flex items-center gap-2" onClick={onClose}>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#2d2f35]">
              <Icon name="mode_comment" fill className="text-[17px]" />
            </span>
            <span className="flex-1 text-xs font-black">Support</span>
            <span className="rounded-full bg-[#087cff] px-2 py-0.5 text-[10px] font-black">24/7</span>
          </Link>
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
      {isOpen && <div className="ml-3 border-l border-white/10 pl-2">{children}</div>}
    </section>
  );
}

function MobileDrawerLink({ badge, href, icon, label, onClick }: { badge?: string; href: string; icon: string; label: string; onClick: () => void }) {
  return (
    <Link href={href} className="flex items-center gap-2 rounded-lg px-1 py-2 text-[11px] font-black text-slate-200" onClick={onClick}>
      <Icon name={icon} fill className="text-[16px] text-slate-400" />
      <span className="flex-1">{label}</span>
      {badge && <span className="rounded-full bg-[#ff1979] px-2 py-0.5 text-[9px]">{badge}</span>}
    </Link>
  );
}

/* ── Footer ─────────────────────────────────────────────── */
function AppFooter() {
  const socials = [
    { label: "WhatsApp",  svg: <path d="M17.5 14.4c-.3-.1-1.7-.8-2-1-.3-.1-.5-.1-.7.1-.2.3-.8 1-.9 1.2-.2.2-.3.2-.6.1-.3-.1-1.3-.5-2.4-1.5-.9-.8-1.5-1.8-1.6-2-.2-.3 0-.5.1-.6l.5-.6c.1-.2.1-.3.2-.5 0-.2 0-.4-.1-.5-.1-.1-.7-1.6-1-2.2-.2-.6-.5-.5-.7-.5H8c-.2 0-.5.1-.7.3-.3.3-1 1-1 2.4s1 2.8 1.1 3c.1.2 2 3 4.8 4.2.7.3 1.2.4 1.6.5.7.2 1.3.2 1.8.1.5-.1 1.7-.7 1.9-1.4.2-.6.2-1.2.1-1.3-.1-.1-.3-.2-.6-.3zm-5.4 7.3h-.1a10.4 10.4 0 0 1-5.3-1.5l-.4-.2-3.7 1 1-3.6-.3-.4a10.5 10.5 0 1 1 8.8 4.7zm0-20C5.4 1.7 1 6.2 1 11.7c0 1.9.5 3.7 1.4 5.2L1 22l5.2-1.4a10.3 10.3 0 0 0 5 1.3c5.5 0 10-4.5 10-10S17.7 1.7 12.1 1.7z" />, vb: "0 0 24 24" },
    { label: "Telegram",  tg: true },
    { label: "Instagram", mat: "photo_camera" },
    { label: "Facebook",  svg: <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />, vb: "0 0 24 24" },
    { label: "X",         svg: <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.737-8.835L2.25 2.25h6.865l4.258 5.622L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z" />, vb: "0 0 20 20" },
    { label: "Threads",   svg: <path d="M12.2 2C7.7 2 5 4.9 5 9.3v5.4C5 19.1 7.7 22 12.2 22c4.4 0 6.8-2.9 6.8-7.3 0-.3 0-.5-.1-.8H17c0 .3.1.5.1.8 0 3-1.6 5.3-4.9 5.3s-5.2-2.2-5.2-5.3V9.3c0-3.1 1.9-5.3 5.2-5.3 2.8 0 4.5 1.6 4.8 4.1H19C18.6 4.3 15.9 2 12.2 2zm0 7c-1.7 0-2.8 1-2.8 2.3 0 1.4 1 2.2 2.5 2.5.5.1 1.3.1 1.9-.1.9-.4 1.3-1.1 1.3-2.1 0-1.5-1.1-2.6-2.9-2.6z" />, vb: "0 0 24 24" },
  ];

  return (
    <footer className="mt-8 border-t border-white/[0.06] bg-[#0a0b0e]">
      {/* ── Support bar ── */}
      <div className="relative overflow-hidden border-b border-white/[0.05] bg-gradient-to-r from-[#0d1f45] via-[#102560] to-[#0d1f45]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_120%,rgba(99,102,241,0.18),transparent)]" />
        <div className="relative mx-auto flex flex-wrap items-center justify-between gap-4 px-6 py-5 xl:px-10">
          <div className="flex items-center gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/20">
              <Icon name="support_agent" fill className="text-[24px] text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-black text-white">Support</span>
                <span className="rounded-full bg-emerald-500 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-white">24/7</span>
              </div>
              <p className="text-[11px] text-white/50">Contact us if you still have questions</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-2.5 text-center">
              <div className="text-[10px] font-bold uppercase tracking-widest text-white/40">Commercial offers</div>
              <a href="mailto:business@nezeem.com" className="text-xs font-black text-white transition hover:text-violet-300">business@nezeem.com</a>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-2.5 text-center">
              <div className="text-[10px] font-bold uppercase tracking-widest text-white/40">Partner program</div>
              <a href="mailto:partners@nezeem.com" className="text-xs font-black text-white transition hover:text-violet-300">partners@nezeem.com</a>
            </div>
            <button className="rounded-2xl bg-white px-6 py-2.5 text-xs font-black text-[#102560] transition hover:bg-white/90" type="button">
              Contact support
            </button>
          </div>
        </div>
      </div>

      {/* ── Main footer body ── */}
      <div className="mx-auto grid gap-10 px-6 py-10 xl:px-10 lg:grid-cols-[1fr_1fr_1fr_auto]">
        {/* Brand + description */}
        <div>
          <div className="mb-3 text-lg font-black tracking-tight text-white">Nezeem</div>
          <p className="mb-4 text-[12px] leading-5 text-slate-500">Sports betting, Aviator, Polymarket predictions, P2P trading, Binary &amp; Forex, and a Smart Wallet — one seamless platform.</p>
          <div className="flex items-center gap-1.5">
            {socials.map((s) => (
              <button key={s.label} type="button" aria-label={s.label}
                className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#16171d] text-slate-400 ring-1 ring-white/[0.06] transition hover:bg-[#1e2028] hover:text-white"
              >
                {s.tg ? <TelegramIcon /> : s.mat ? (
                  <Icon name={s.mat} fill className="text-[15px]" />
                ) : (
                  <svg viewBox={s.vb} className="h-3.5 w-3.5" fill="currentColor">{s.svg}</svg>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Information */}
        <div>
          <h4 className="mb-4 text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">Information</h4>
          <ul className="space-y-2.5">
            {["Rules", "Promotions", "Partner program", "Responsible Gaming", "Privacy Policy", "Terms of Service"].map((l) => (
              <li key={l}>
                <Link href="#" className="text-[13px] text-slate-400 transition hover:text-white">{l}</Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Products */}
        <div>
          <h4 className="mb-4 text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">Products</h4>
          <ul className="space-y-2.5">
            {[
              { label: "Sports Betting", href: "/sports" },
              { label: "Aviator", href: "/aviator" },
              { label: "Predictions", href: "/predictions" },
              { label: "P2P Trading", href: "/p2p" },
              { label: "Binary & Forex", href: "/binary" },
              { label: "Smart Wallet", href: "/wallet" },
            ].map((l) => (
              <li key={l.label}>
                <Link href={l.href} className="text-[13px] text-slate-400 transition hover:text-white">{l.label}</Link>
              </li>
            ))}
          </ul>
        </div>

        {/* App downloads */}
        <div className="flex flex-row gap-3 lg:flex-col">
          <Link href="#"
            className="flex w-40 flex-col gap-3 overflow-hidden rounded-2xl bg-gradient-to-br from-violet-600/80 to-violet-900 p-4 ring-1 ring-violet-500/30 transition hover:ring-violet-400/50"
          >
            <Icon name="phone_iphone" fill className="text-[28px] text-white/80" />
            <div>
              <div className="text-xs font-black text-white">Mobile App</div>
              <div className="text-[10px] text-white/50">Android &amp; iOS</div>
            </div>
            <span className="mt-auto block w-full rounded-xl bg-white/15 py-1.5 text-center text-[11px] font-black text-white">
              Install →
            </span>
          </Link>
          <Link href="#"
            className="flex w-40 flex-col gap-3 overflow-hidden rounded-2xl bg-gradient-to-br from-[#1c2d4a] to-[#0f1e33] p-4 ring-1 ring-white/[0.08] transition hover:ring-white/20"
          >
            <Icon name="desktop_windows" fill className="text-[28px] text-white/80" />
            <div>
              <div className="text-xs font-black text-white">Windows App</div>
              <div className="text-[10px] text-white/50">Desktop experience</div>
            </div>
            <span className="mt-auto block w-full rounded-xl bg-white/10 py-1.5 text-center text-[11px] font-black text-white">
              Install →
            </span>
          </Link>
        </div>
      </div>

      {/* ── Bottom bar ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.05] px-6 py-4 xl:px-10">
        <p className="text-[11px] text-slate-600">© 2026 Nezeem. All rights reserved. Play responsibly. 18+ only.</p>
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-slate-600">Licensed &amp; regulated</span>
          <span className="flex h-7 w-9 items-center justify-center rounded-lg border border-white/15 text-xs font-black text-slate-400">18+</span>
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
