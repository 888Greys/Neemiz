import { AppShell } from "@/components/app-shell";
import { Icon } from "@/components/icon";
import { p2pMerchants } from "@/lib/mock-data";

export default function P2PPage() {
  return (
    <AppShell>
      <div className="mx-auto max-w-3xl p-4 md:p-6">
        <div className="mb-6 space-y-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold">P2P Trading</h1>
            <Icon name="history" className="text-on-surface-variant" />
          </div>
          <div className="flex rounded border border-outline-variant bg-surface-container-high p-1">
            <button className="flex-1 rounded bg-primary py-2 text-xs font-bold uppercase text-on-primary">Buy</button>
            <button className="flex-1 rounded py-2 text-xs font-bold uppercase text-on-surface-variant">Sell</button>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            {["USDT", "NGN", "Amount", "Payment Method"].map((filter) => (
              <button key={filter} className="flex shrink-0 items-center gap-1 rounded border border-outline-variant bg-surface-container px-3 py-2 text-sm">
                {filter}<Icon name="arrow_drop_down" className="text-[16px]" />
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-4">
          {p2pMerchants.map((merchant) => (
            <article key={merchant.name} className="rounded-lg border border-outline-variant bg-surface-container p-4 transition hover:bg-surface-variant">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded border border-outline-variant bg-surface-container-highest text-xs font-bold">{merchant.initial}</div>
                  <div>
                    <div className="flex items-center gap-1 font-medium">{merchant.name}{merchant.verified && <Icon name="verified" fill className="text-[14px] text-primary" />}</div>
                    <div className="flex gap-2 text-xs text-on-surface-variant"><span>{merchant.orders} orders</span><span>|</span><span className="font-mono">{merchant.rate}</span></div>
                  </div>
                </div>
              </div>
              <div className="mt-4 flex items-end justify-between">
                <div><div className="text-xs text-on-surface-variant">Price</div><div className="text-2xl font-semibold text-primary">{merchant.price}</div></div>
                <button className="rounded bg-primary px-5 py-2 text-xs font-bold uppercase text-on-primary">Buy</button>
              </div>
              <div className="mt-3 space-y-1 border-t border-outline-variant pt-3 text-sm">
                <Row label="Available" value={merchant.available} />
                <Row label="Limit" value={merchant.limit} />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {merchant.methods.map((method) => <span key={method} className="rounded border border-outline-variant bg-surface-container-highest px-2 py-1 text-[10px] font-bold uppercase text-on-surface-variant">{method}</span>)}
              </div>
            </article>
          ))}
        </div>
      </div>
    </AppShell>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between"><span className="text-on-surface-variant">{label}</span><span className="font-mono">{value}</span></div>;
}
