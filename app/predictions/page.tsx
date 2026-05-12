import { AppShell } from "@/components/app-shell";
import { Icon } from "@/components/icon";
import { predictionMarkets } from "@/lib/mock-data";

export default function PredictionsPage() {
  return (
    <AppShell>
      <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-6">
        <section>
          <h1 className="text-3xl font-semibold">Predictions</h1>
          <p className="mt-1 text-on-surface-variant">Trade on global events. Outcomes settle from verified market sources.</p>
        </section>
        <nav className="flex gap-2 overflow-x-auto no-scrollbar">
          {["All Markets", "Politics", "Crypto", "Sports", "Culture", "Science"].map((cat, index) => (
            <button key={cat} className={`shrink-0 rounded-full border px-4 py-1.5 text-xs font-bold uppercase ${index === 0 ? "border-transparent bg-secondary-container text-on-secondary-container" : "border-outline-variant bg-surface-container-high text-on-surface-variant"}`}>{cat}</button>
          ))}
        </nav>
        <section className="space-y-4">
          {predictionMarkets.map((market) => (
            <article key={market.title} className="rounded-lg border border-outline-variant bg-surface-container-high p-4">
              <div className="mb-3 flex justify-between gap-3">
                <h2 className="text-lg font-semibold">{market.title}</h2>
                <Icon name={market.icon} className="text-primary" />
              </div>
              <div className="mb-4 flex gap-4 text-sm text-on-surface-variant">
                <span><Icon name="bar_chart" className="inline text-[16px]" /> Vol: {market.volume}</span>
                <span><Icon name="calendar_today" className="inline text-[16px]" /> Ends: {market.closes}</span>
              </div>
              <div className="mb-4">
                <div className="mb-1 flex justify-between font-mono text-sm"><span className="text-primary">{market.yes}% Yes</span><span className="text-error">{market.no}% No</span></div>
                <div className="flex h-2 overflow-hidden rounded-full bg-surface-container-lowest"><span className="bg-primary" style={{ width: `${market.yes}%` }} /><span className="bg-error-container" style={{ width: `${market.no}%` }} /></div>
              </div>
              <div className="flex gap-2">
                <MarketButton label="Buy Yes" price={`${market.yes}¢`} tone="yes" />
                <MarketButton label="Buy No" price={`${market.no}¢`} tone="no" />
              </div>
            </article>
          ))}
        </section>
      </div>
    </AppShell>
  );
}

function MarketButton({ label, price, tone }: { label: string; price: string; tone: "yes" | "no" }) {
  return <button className={`flex-1 rounded border border-outline-variant bg-surface-container p-3 transition ${tone === "yes" ? "hover:border-primary" : "hover:border-error"}`}><span className="block text-xs font-bold uppercase text-on-surface-variant">{label}</span><span className={`font-mono text-lg ${tone === "yes" ? "text-primary" : "text-error"}`}>{price}</span></button>;
}
