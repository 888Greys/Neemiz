import { AppShell } from "@/components/app-shell";
import { Icon } from "@/components/icon";
import { walletTransactions } from "@/lib/mock-data";

export default function WalletPage() {
  return (
    <AppShell>
      <main className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 pb-24 pt-6">
        <section className="flex flex-col items-center gap-2 py-5">
          <span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Total Balance</span>
          <div className="text-3xl font-semibold">$14,890.25</div>
          <div className="mt-4 flex w-full gap-3">
            <button className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary-container py-3 font-medium text-on-primary-container"><Icon name="add" className="text-[18px]" />Deposit</button>
            <button className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-outline-variant bg-surface-container py-3 font-medium"><Icon name="arrow_upward" className="text-[18px]" />Withdraw</button>
          </div>
          <button className="mt-1 flex w-full items-center justify-center gap-2 rounded-lg border border-outline-variant py-2 text-primary"><Icon name="sync_alt" className="text-[18px]" />Transfer</button>
        </section>

        <section className="grid grid-cols-2 gap-3">
          <BalanceCard label="FIAT" amount="$8,450.00" detail="USD Available" icon="account_balance" />
          <BalanceCard label="CRYPTO" amount="$6,440.25" detail="≈ 0.14 BTC" icon="currency_bitcoin" />
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Recent Activity</h3>
            <span className="text-sm text-primary">View All</span>
          </div>
          {walletTransactions.map((tx) => (
            <article key={tx.title} className="flex items-center justify-between rounded-lg border border-outline-variant bg-surface-container p-3">
              <div className="flex items-center gap-3">
                <div className="relative flex h-10 w-10 items-center justify-center rounded bg-surface-variant">
                  <Icon name={tx.icon} className="text-[20px]" />
                  <span className={`absolute -right-1 -top-1 h-2 w-2 rounded-full ${tx.tone === "good" ? "bg-[#22C55E]" : tx.tone === "bad" ? "bg-[#EF4444]" : "bg-outline"}`} />
                </div>
                <div><div>{tx.title}</div><div className="text-xs text-on-surface-variant">{tx.subtitle}</div></div>
              </div>
              <div className="text-right"><div className={`font-mono ${tx.tone === "good" ? "text-[#22C55E]" : tx.tone === "bad" ? "text-[#EF4444]" : ""}`}>{tx.amount}</div><div className="text-xs text-on-surface-variant">{tx.status}</div></div>
            </article>
          ))}
        </section>
      </main>
    </AppShell>
  );
}

function BalanceCard({ label, amount, detail, icon }: { label: string; amount: string; detail: string; icon: string }) {
  return (
    <div className="rounded-lg border border-outline-variant bg-surface-container p-4">
      <div className="mb-4 flex items-start justify-between"><div className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-variant"><Icon name={icon} className="text-[16px]" fill /></div><span className="text-xs font-bold text-on-surface-variant">{label}</span></div>
      <div className="font-mono text-lg">{amount}</div>
      <div className="mt-1 text-xs text-on-surface-variant">{detail}</div>
    </div>
  );
}
