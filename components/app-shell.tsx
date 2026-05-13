"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { SignInButton, SignUpButton } from "@clerk/nextjs";
import { mobileNav } from "@/lib/mock-data";
import { BrandLogo } from "@/components/brand-logo";
import { Icon } from "@/components/icon";

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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
            <SignInButton mode="modal">
              <button className="flex h-12 w-12 items-center justify-center rounded-full bg-[#34363b] text-slate-300" type="button">
                <Icon name="person" fill className="text-[28px]" />
              </button>
            </SignInButton>
          ) : (
            <SignInButton mode="modal">
              <button className="flex w-full items-center gap-3 rounded-2xl text-left transition hover:bg-white/[0.03]" type="button">
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#34363b] text-slate-300">
                  <Icon name="person" fill className="text-[32px]" />
                </span>
                <span className="flex-1 text-lg font-black">Log in</span>
                <Icon name="chevron_right" className="text-[32px] text-slate-400" />
              </button>
            </SignInButton>
          )}
        </div>

        <div className="flex min-w-0 flex-1 items-center justify-between gap-3 lg:gap-5 lg:px-6">
          <div className="flex min-w-0 items-center gap-6">
            <BrandLogo href="/dashboard" size="sm" />
            <nav className="hidden items-center rounded-2xl bg-[#25262a] p-1 text-sm font-black text-slate-200 md:flex">
              <TopNavLink href="/dashboard" icon="home" label="Home" pathname={pathname} />
              <TopNavLink href="/dashboard#casino" icon="casino" label="Casino" pathname={pathname} />
              <TopNavLink href="/wallet" icon="paid" label="Free money" pathname={pathname} />
              <TopNavLink href="/sports" icon="sports_soccer" label="Sports" pathname={pathname} />
            </nav>
          </div>
          <div className="flex shrink-0 items-center gap-2 md:gap-3">
            <SignInButton mode="modal">
              <button className="rounded-lg bg-[#28292d] px-3 py-2 text-xs font-black text-white transition hover:bg-[#34353b] md:rounded-2xl md:px-6 md:py-3 md:text-base">
                Login
              </button>
            </SignInButton>
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
          <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed((value) => !value)} pathname={pathname} />
        </aside>

        <main className="flex-1 overflow-y-auto border-r border-outline-variant bg-background pb-24 lg:pb-0">
          {children}
        </main>

        {rightPanel && <aside className="hidden w-80 shrink-0 bg-surface-container-lowest lg:flex">{rightPanel}</aside>}
      </div>

      {mobileMenuOpen && <MobileMenuDrawer onClose={() => setMobileMenuOpen(false)} />}

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
  const active = href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <Link
      href={href}
      className={`flex items-center gap-2 rounded-2xl px-5 py-3 transition ${
        active ? "bg-[#087cff] text-white shadow-[0_8px_22px_rgba(8,124,255,.25)]" : "text-slate-200 hover:bg-white/[0.05]"
      }`}
    >
      <span className={`flex h-7 w-7 items-center justify-center rounded-full ${active ? "bg-white/15" : "bg-white/10"}`}>
        <Icon name={icon} fill className="text-[21px]" />
      </span>
      {label}
    </Link>
  );
}

function Sidebar({ collapsed, onToggle, pathname }: { collapsed: boolean; onToggle: () => void; pathname: string }) {
  const [openGroups, setOpenGroups] = useState({
    casino: true,
    fastGames: false,
    lobby: true,
    liveCasino: false,
    sports: true,
    tournaments: false,
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
        <Link
          href="/wallet"
          className={`mb-5 flex min-h-[64px] items-center overflow-hidden rounded-2xl border border-emerald-300/10 bg-gradient-to-r from-[#044947] to-[#05605d] text-white shadow-inner shadow-white/5 ${
            collapsed ? "justify-center px-2" : "justify-between px-4"
          }`}
          style={{ backgroundImage: collapsed ? undefined : `linear-gradient(90deg, rgba(4,73,71,.88), rgba(5,96,93,.52)), url(${tempAssets.freebet})`, backgroundSize: "cover", backgroundPosition: "center" }}
        >
          {!collapsed && (
            <span className="text-base font-black leading-tight">
              Free
              <br />
              money
            </span>
          )}
          <span className={`relative flex items-center justify-center ${collapsed ? "h-11 w-11" : "h-16 w-24"}`}>
            {!collapsed && (
              <span className="absolute h-8 w-20 rotate-[-10deg] rounded bg-white text-center text-[10px] font-black uppercase leading-8 text-emerald-700 shadow-lg">
                Free
              </span>
            )}
            <Icon name="payments" className={`${collapsed ? "text-[36px]" : "absolute text-[64px]"} text-white/80`} />
          </span>
        </Link>

        <div className={`${collapsed ? "-mx-2" : "-mx-4"} mb-5 border-t border-white/10`} />

        <SidebarGroup collapsed={collapsed} icon="settings_suggest" isOpen={openGroups.casino} onToggle={() => toggleGroup("casino")} title="Casino">
          <SidebarItem
            collapsed={collapsed}
            href="/dashboard"
            icon="apps"
            isOpen={openGroups.lobby}
            label="Lobby"
            onToggle={() => toggleGroup("lobby")}
            pathname={pathname}
          />
          {openGroups.lobby && (
            <div className={collapsed ? "hidden" : "ml-8 space-y-1 py-1"}>
              <NestedSidebarItem href="/dashboard#quick-games" icon="bolt" label="Quick games" />
              <NestedSidebarItem href="/dashboard#popular" icon="star" label="Popular" />
              <NestedSidebarItem href="/dashboard#new" icon="new_releases" label="New" />
              <NestedSidebarItem href="/dashboard#exclusive" icon="looks_one" label="Only on 1win" />
              <NestedSidebarItem href="/dashboard#slots" icon="casino" label="Slots" />
              <NestedSidebarItem href="/dashboard#bonus-buy" icon="redeem" label="Bonus buy" />
              <NestedSidebarItem href="/aviator" icon="spa" label="Live Casino" />
              <NestedSidebarItem href="/dashboard#bonus-wagering" icon="paid" label="Bonus Wagering" />
              <NestedSidebarItem href="/dashboard#low-data" icon="more_horiz" label="Low Data" />
              <NestedSidebarItem href="/dashboard#roulette" icon="casino" label="Roulette" />
              <NestedSidebarItem href="/dashboard#big-draw-slots" icon="stars" label="Big Draw: slots" />
              <NestedSidebarItem href="/dashboard#big-draw-crash" icon="stars" label="Big Draw: crash games" truncate />
            </div>
          )}
          <SidebarItem
            collapsed={collapsed}
            href="/aviator"
            icon="casino"
            isOpen={openGroups.liveCasino}
            label="Live Casino"
            onToggle={() => toggleGroup("liveCasino")}
            pathname={pathname}
          />
          {openGroups.liveCasino && (
            <div className={collapsed ? "hidden" : "ml-8 space-y-1 py-1"}>
              <NestedSidebarItem href="/aviator#game-shows" icon="payments" label="Game shows" />
              <NestedSidebarItem href="/aviator#live" icon="live_tv" label="1win Live" />
              <NestedSidebarItem href="/aviator#roulette" icon="casino" label="Roulette" />
              <NestedSidebarItem href="/aviator#blackjack" icon="playing_cards" label="Blackjack" />
              <NestedSidebarItem href="/aviator#baccarat" icon="track_changes" label="Baccarat" />
              <NestedSidebarItem href="/aviator#new-live" icon="settings_input_antenna" label="New live games" />
            </div>
          )}
          <SidebarItem
            collapsed={collapsed}
            href="/binary"
            icon="bolt"
            isOpen={openGroups.fastGames}
            label="Fast Games"
            onToggle={() => toggleGroup("fastGames")}
            pathname={pathname}
          />
          {openGroups.fastGames && (
            <div className={collapsed ? "hidden" : "ml-8 space-y-1 py-1"}>
              <NestedSidebarItem href="/binary#crash-games" icon="rocket_launch" label="Crash games" />
              <NestedSidebarItem href="/binary#mines" icon="apps" label="Mines" />
              <NestedSidebarItem href="/binary#chicken-games" icon="extension" label="Chicken Games" />
              <NestedSidebarItem href="/binary#plinko" icon="scatter_plot" label="Plinko" />
              <NestedSidebarItem href="/binary#lotteries" icon="confirmation_number" label="Lotteries" />
              <NestedSidebarItem href="/sports" icon="sports_soccer" label="Sport" />
            </div>
          )}
          <SidebarItem
            collapsed={collapsed}
            href="/predictions"
            icon="shield"
            isOpen={openGroups.tournaments}
            label="Tournaments"
            onToggle={() => toggleGroup("tournaments")}
            pathname={pathname}
          />
          {openGroups.tournaments && (
            <div className={collapsed ? "hidden" : "ml-8 space-y-1 py-1"}>
              <NestedSidebarItem href="/predictions#spinoleague" icon="web_stories" label="Spinoleague" />
              <NestedSidebarItem href="/predictions#bgaming-drops" icon="stars" label="BGaming Drops" />
              <NestedSidebarItem href="/predictions#drops-wins" icon="celebration" label="Drops & Wins" />
              <NestedSidebarItem href="/predictions#galaxsys" icon="stars" label="Galaxsys MoneyLand" />
              <NestedSidebarItem href="/predictions#endorphina-20k" icon="stars" label="€20K from Endorphina" truncate />
              <NestedSidebarItem href="/predictions#e-drops" icon="stars" label="E-Drops by Endorphina" truncate />
              <NestedSidebarItem href="/predictions#gamzix" icon="stars" label="Gamzix Spin Express" />
              <NestedSidebarItem href="/predictions#season-legends" icon="stars" label="Season of Legends" />
              <NestedSidebarItem href="/predictions#pragmatic" icon="stars" label="Pragmatic Play & Earn" truncate />
              <NestedSidebarItem href="/predictions#voltent" icon="stars" label="Voltent Win Booster" />
              <NestedSidebarItem href="/predictions#endorphina-15k" icon="stars" label="€15K from Endorphina" truncate />
            </div>
          )}
          <SidebarItem collapsed={collapsed} href="/dashboard#games" icon="sports_score" label="Nezeem games" pathname={pathname} direct />
        </SidebarGroup>

        <SidebarGroup collapsed={collapsed} icon="sports_soccer" isOpen={openGroups.sports} onToggle={() => toggleGroup("sports")} title="Sports">
          <SidebarItem collapsed={collapsed} href="/sports" icon="local_fire_department" label="Top" pathname={pathname} suppressActive />
          <SidebarItem collapsed={collapsed} href="/sports?tab=live" icon="settings_input_antenna" label="Live" pathname={pathname} suppressActive />
          <SidebarItem collapsed={collapsed} href="/sports?tab=esports" icon="sports_martial_arts" label="Esports" pathname={pathname} suppressActive />
          <SidebarItem collapsed={collapsed} href="/sports?tab=sports" icon="calendar_month" label="Sports" pathname={pathname} suppressActive />
          <SidebarItem collapsed={collapsed} href="/sports?tab=history" icon="manage_history" label="Bet history" pathname={pathname} suppressActive />
        </SidebarGroup>

        <div className="space-y-1">
          <StandaloneSidebarItem collapsed={collapsed} href="/p2p" icon="monetization_on" label="Markets" pathname={pathname} />
          <StandaloneSidebarItem collapsed={collapsed} href="/wallet" icon="redeem" label="Bonuses" pathname={pathname} badge="1" />
        </div>

        <div className={`${collapsed ? "mx-1" : "-mx-4"} my-5 border-t border-white/10`} />

        <div className="space-y-1">
          <StandaloneSidebarItem collapsed={collapsed} href="/dashboard#promotions" icon="new_releases" label="Promotions" pathname={pathname} />
          <StandaloneSidebarItem collapsed={collapsed} href="/binary" icon="trending_up" label="Trading" pathname={pathname} />
          <StandaloneSidebarItem collapsed={collapsed} href="/predictions#poker" icon="playing_cards" label="Poker" pathname={pathname} />
          <StandaloneSidebarItem collapsed={collapsed} href="/sports?tab=vsport" icon="sports_esports" label="Vsport" pathname={pathname} />
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
  direct,
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
  direct?: boolean;
  isOpen?: boolean;
  muted?: boolean;
  onToggle?: () => void;
  suppressActive?: boolean;
}) {
  const active = !suppressActive && (href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href.split("?")[0]));
  const content = (
    <>
      <Icon name={icon} fill={active} className="text-[24px] text-slate-400" />
      {!collapsed && (
        <>
          <span className="min-w-0 flex-1 whitespace-nowrap">{label}</span>
          <Icon name={direct ? "chevron_right" : isOpen === undefined ? "keyboard_arrow_down" : isOpen ? "keyboard_arrow_up" : "keyboard_arrow_down"} className="text-[22px] text-slate-400" />
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

function MobileMenuDrawer({ onClose }: { onClose: () => void }) {
  const [openGroups, setOpenGroups] = useState({
    casino: false,
    sports: false,
  });

  return (
    <div className="fixed inset-0 z-[60] bg-black/65 lg:hidden">
      <aside className="relative flex h-full w-[72vw] max-w-[310px] min-w-[255px] flex-col bg-[#1b1c20] shadow-2xl">
        <button className="absolute -right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-[#3a3d45] text-white" onClick={onClose} type="button" aria-label="Close menu">
          <Icon name="close" className="text-[18px]" />
        </button>

        <div className="no-scrollbar flex-1 overflow-y-auto p-2">
          <SignInButton mode="modal">
            <button className="mb-2 flex w-full items-center gap-2 rounded-xl p-1 text-left" type="button">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#34363b]">
                <Icon name="person" fill className="text-[18px] text-slate-300" />
              </span>
              <span className="flex-1 text-xs font-black">Log in</span>
              <Icon name="chevron_right" className="text-[18px] text-slate-400" />
            </button>
          </SignInButton>

          <Link
            href="/wallet"
            className="mb-4 flex h-[54px] items-center justify-between overflow-hidden rounded-xl bg-gradient-to-r from-[#044947] to-[#05605d] bg-cover bg-center px-3"
            onClick={onClose}
            style={{ backgroundImage: `linear-gradient(90deg, rgba(4,73,71,.88), rgba(5,96,93,.52)), url(${tempAssets.freebet})` }}
          >
            <span className="text-xs font-black leading-tight">
              Free
              <br />
              money
            </span>
            <Icon name="payments" className="text-[38px] text-white/80" />
          </Link>

          <MobileDrawerGroup icon="settings_suggest" isOpen={openGroups.casino} label="Casino" onToggle={() => setOpenGroups((value) => ({ ...value, casino: !value.casino }))}>
            <MobileDrawerLink href="/dashboard" icon="apps" label="Lobby" onClick={onClose} />
            <MobileDrawerLink href="/aviator" icon="casino" label="Live Casino" onClick={onClose} />
            <MobileDrawerLink href="/binary" icon="bolt" label="Fast Games" onClick={onClose} />
            <MobileDrawerLink href="/predictions" icon="shield" label="Tournaments" onClick={onClose} />
          </MobileDrawerGroup>

          <MobileDrawerGroup icon="sports_soccer" isOpen={openGroups.sports} label="Sports" onToggle={() => setOpenGroups((value) => ({ ...value, sports: !value.sports }))}>
            <MobileDrawerLink href="/sports" icon="local_fire_department" label="Top" onClick={onClose} />
            <MobileDrawerLink href="/sports?tab=live" icon="settings_input_antenna" label="Live" onClick={onClose} />
            <MobileDrawerLink href="/sports?tab=esports" icon="sports_martial_arts" label="Esports" onClick={onClose} />
          </MobileDrawerGroup>

          <div className="mt-2 space-y-1">
            <MobileDrawerLink href="/p2p" icon="monetization_on" label="Markets" onClick={onClose} />
            <MobileDrawerLink href="/wallet" icon="redeem" label="Bonuses" badge="1" onClick={onClose} />
          </div>

          <div className="my-3 border-t border-white/10" />

          <div className="space-y-1">
            <MobileDrawerLink href="/dashboard#promotions" icon="new_releases" label="Promotions" onClick={onClose} />
            <MobileDrawerLink href="/binary" icon="trending_up" label="Trading" onClick={onClose} />
            <MobileDrawerLink href="/predictions#poker" icon="playing_cards" label="Poker" onClick={onClose} />
            <MobileDrawerLink href="/sports?tab=vsport" icon="sports_esports" label="Vsport" onClick={onClose} />
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
