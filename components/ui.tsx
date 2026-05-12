import Link from "next/link";
import { Icon } from "@/components/icon";

export function OddsButton({ label, odds, tone = "default" }: { label: string; odds: string; tone?: "default" | "up" | "down" }) {
  return (
    <button className="group flex min-h-12 flex-1 flex-col items-center justify-center rounded-lg border border-outline-variant bg-surface-container p-2 transition hover:border-primary/60 hover:bg-primary/8 active:scale-95">
      <span className="mb-0.5 text-[10px] font-bold uppercase tracking-wide text-on-surface-variant group-hover:text-primary">{label}</span>
      <span className={`font-mono text-sm font-bold transition group-hover:text-primary ${tone === "up" ? "text-primary" : tone === "down" ? "text-error" : "text-on-surface"}`}>{odds}</span>
    </button>
  );
}

export function ProductShortcut({ href, label, icon }: { href: string; label: string; icon: string }) {
  return (
    <Link href={href} className="group flex items-center gap-3 rounded-xl border border-outline-variant bg-surface-container p-4 transition hover:border-primary/50 hover:bg-primary/5 active:scale-[0.98]">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-dim text-on-surface-variant transition group-hover:bg-primary/12 group-hover:text-primary">
        <Icon name={icon} />
      </span>
      <div className="min-w-0">
        <span className="block font-semibold text-on-surface">{label}</span>
        <span className="text-[11px] text-on-surface-variant">Explore market</span>
      </div>
      <Icon name="chevron_right" className="ml-auto shrink-0 text-[18px] text-outline transition group-hover:translate-x-0.5 group-hover:text-primary" />
    </Link>
  );
}

export function MobileProductChip({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="snap-start whitespace-nowrap rounded-lg border border-outline-variant bg-surface-container px-4 py-2 text-sm text-on-surface-variant first:border-transparent first:bg-secondary-container first:font-bold first:text-on-secondary-container">
      {label}
    </Link>
  );
}

export function WalletSummary() {
  return (
    <section className="rounded-lg border border-outline-variant bg-surface-container-high p-5">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <p className="mb-1 text-xs text-on-surface-variant">Total Equity</p>
          <h2 className="font-headline text-3xl font-semibold">$1,240.50</h2>
        </div>
        <div className="rounded-full bg-surface-variant p-2">
          <Icon name="account_balance_wallet" className="text-[20px] text-primary" />
        </div>
      </div>
      <div className="flex gap-3">
        <button className="flex-1 rounded-lg bg-primary py-2.5 font-medium text-on-primary">
          <Icon name="add_circle" className="mr-1 inline text-[18px]" /> Deposit
        </button>
        <button className="flex-1 rounded-lg border border-outline-variant py-2.5 font-medium text-on-surface">
          <Icon name="arrow_outward" className="mr-1 inline text-[18px]" /> Send
        </button>
      </div>
    </section>
  );
}
