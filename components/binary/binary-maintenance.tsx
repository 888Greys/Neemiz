import Link from "next/link";
import { Icon } from "@/components/icon";

/**
 * Full-screen, professional maintenance state for the binary-options product.
 * Shown on /binary while the whole suite is offline behind the
 * `binary_options_maintenance` switch (see lib/game-guard.ts). Reassures the
 * user their balance is safe and points them at the markets that stay open.
 */
export function BinaryMaintenance() {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-5 py-12">
      <div className="w-full max-w-md text-center">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#087cff]/12 ring-1 ring-[#087cff]/25">
          <Icon name="candlestick_chart" fill className="text-[30px] text-[#087cff]" />
        </span>

        <p className="mt-6 inline-flex items-center gap-1.5 rounded-full bg-amber-500/12 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-amber-400 ring-1 ring-amber-500/25">
          <Icon name="settings" className="text-[13px]" /> Under maintenance
        </p>

        <h1 className="mt-4 text-2xl font-black tracking-tight text-white">Binary is being upgraded</h1>
        <p className="mx-auto mt-2 max-w-sm text-[13px] leading-6 text-slate-400">
          We&apos;ve taken Binary offline for scheduled maintenance while we roll out
          a more robust pricing engine. It&apos;ll be back shortly, better than before.
        </p>

        <div className="mt-6 space-y-2.5 text-left">
          <Reassure icon="security" title="Your balance is safe" body="Nothing has changed in your wallet — funds and open positions are untouched." />
          <Reassure icon="schedule" title="Back soon" body="This is planned maintenance, not an outage. No action is needed from you." />
          <Reassure icon="storefront" title="Other markets are open" body="Sports, Aviator, Polymarket and P2P are all running normally." />
        </div>

        <div className="mt-7 flex flex-col gap-2.5 sm:flex-row sm:justify-center">
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#087cff] px-5 py-3 text-[13px] font-black text-white transition hover:bg-[#0a8bff]"
          >
            <Icon name="home" fill className="text-[16px]" /> Back to dashboard
          </Link>
          <a
            href="https://t.me/NeezemSupport"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/[0.04] px-5 py-3 text-[13px] font-black text-slate-200 ring-1 ring-white/[0.08] transition hover:bg-white/[0.07]"
          >
            <Icon name="support_agent" className="text-[16px]" /> Contact support
          </a>
        </div>
      </div>
    </div>
  );
}

function Reassure({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl bg-white/[0.02] p-3 ring-1 ring-white/[0.06]">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.05] text-slate-300">
        <Icon name={icon} className="text-[16px]" />
      </span>
      <div className="min-w-0">
        <p className="text-[12px] font-black text-white">{title}</p>
        <p className="mt-0.5 text-[11px] leading-5 text-slate-500">{body}</p>
      </div>
    </div>
  );
}
