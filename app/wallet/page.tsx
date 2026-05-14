import { AppShell } from "@/components/app-shell";
import { Icon } from "@/components/icon";

export default function WalletPage() {
  return (
    <AppShell>
      <div className="flex flex-col items-center justify-center px-6 py-24 text-center">
        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-[#1e2028]">
          <Icon name="account_balance_wallet" fill className="text-[42px] text-slate-500" />
        </div>
        <h2 className="text-2xl font-black text-white">Smart Wallet</h2>
        <p className="mt-3 max-w-sm text-sm leading-6 text-slate-400">
          Multi-currency wallet. Deposit, withdraw, and transfer instantly.
        </p>
        <span className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-[#1e2028] px-5 py-2 text-xs font-black uppercase tracking-widest text-slate-400">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
          Coming soon
        </span>
      </div>
    </AppShell>
  );
}
