"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SignedIn, SignedOut, UserButton } from "@clerk/nextjs";
import { balance, mobileNav, navItems } from "@/lib/mock-data";
import { Icon } from "@/components/icon";

type AppShellProps = {
  children: React.ReactNode;
  rightPanel?: React.ReactNode;
};

export function AppShell({ children, rightPanel }: AppShellProps) {
  const pathname = usePathname();
  const isLogin = pathname === "/login";

  if (isLogin) return <>{children}</>;

  return (
    <div className="min-h-screen bg-background text-on-surface">
      <header className="fixed left-0 right-0 top-0 z-50 flex h-16 items-center justify-between border-b border-outline-variant bg-surface-dim px-4 md:px-6">
        <div className="flex items-center gap-4">
          <Link href="/" className="font-headline text-2xl font-black tracking-tight text-on-surface">
            NEEMIZ
          </Link>
          <div className="relative ml-4 hidden md:block">
            <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-on-surface-variant" />
            <input
              className="w-72 rounded border border-outline-variant bg-surface-container-lowest py-2 pl-10 pr-4 text-sm text-on-surface outline-none transition focus:border-primary"
              placeholder="Search events, markets..."
            />
          </div>
        </div>
        <div className="flex items-center gap-3 md:gap-4">
          <Link href="/wallet" className="hidden font-mono text-sm font-bold text-on-surface sm:block">
            {balance}
          </Link>
          <Link href="/wallet" className="rounded bg-primary-container px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-on-primary-container transition hover:bg-primary md:px-4 md:py-2">
            Deposit
          </Link>
          <SignedIn>
            <UserButton
              appearance={{
                elements: {
                  avatarBox: "h-8 w-8 rounded-full ring-2 ring-primary/30",
                  userButtonPopoverCard: "bg-surface-container border border-outline-variant",
                  userButtonPopoverActionButton: "text-on-surface hover:bg-surface-variant",
                  userButtonPopoverActionButtonText: "text-on-surface",
                  userButtonPopoverFooter: "hidden",
                },
              }}
            />
          </SignedIn>
          <SignedOut>
            <Link href="/sign-in" className="text-on-surface-variant transition hover:text-on-surface">
              <Icon name="account_circle" fill />
            </Link>
          </SignedOut>
        </div>
      </header>

      <div className="flex h-screen overflow-hidden pt-16">
        <aside className="hidden w-64 shrink-0 flex-col gap-2 overflow-y-auto border-r border-outline-variant bg-surface-container-lowest p-4 lg:flex">
          <div className="mb-4 px-2">
            <div className="text-lg font-semibold text-primary">Navigation</div>
            <div className="text-xs text-on-surface-variant">Market Access</div>
          </div>
          {navItems.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href.split("?")[0]);
            return (
              <Link
                key={item.label}
                href={item.href}
                className={`flex items-center gap-3 rounded-lg p-3 text-sm transition ${
                  active ? "translate-x-1 bg-secondary-container font-bold text-on-secondary-container" : "text-on-surface-variant hover:bg-surface-variant hover:text-on-surface"
                }`}
              >
                <Icon name={item.icon} fill={active} />
                {item.label}
              </Link>
            );
          })}
        </aside>

        <main className="flex-1 overflow-y-auto border-r border-outline-variant bg-background pb-24 lg:pb-0">
          {children}
        </main>

        <aside className="hidden w-80 shrink-0 bg-surface-container-lowest lg:flex">{rightPanel ?? <BetSlip />}</aside>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-50 flex h-16 items-center justify-around border-t border-outline-variant bg-surface-container-high px-2 shadow-lg lg:hidden">
        {mobileNav.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href.split("?")[0]);
          return (
            <Link key={item.label} href={item.href} className={`flex flex-col items-center justify-center rounded p-2 text-xs ${active ? "text-primary" : "text-on-surface-variant"}`}>
              <Icon name={item.icon} fill={active} />
              <span className="mt-1 text-[10px] font-bold uppercase tracking-wide">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
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
