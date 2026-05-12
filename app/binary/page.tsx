import { AppShell } from "@/components/app-shell";
import { Icon } from "@/components/icon";

const trades = [
  ["EUR/USD", "UP", "+$42.50", "$50.00 Stake", "10:45:22", "good"],
  ["GBP/JPY", "DOWN", "-$25.00", "$25.00 Stake", "10:42:15", "bad"],
  ["USD/JPY", "UP", "+$17.80", "$20.00 Stake", "10:39:04", "good"],
];

export default function BinaryPage() {
  return (
    <AppShell>
      <div className="mx-auto grid max-w-[1440px] gap-3 p-3 md:p-6">
        <section className="flex items-center justify-between rounded border border-outline-variant bg-surface-container p-3">
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-2 rounded border border-outline-variant bg-surface-lowest bg-surface-container-lowest px-3 py-2 text-base">
              <Icon name="currency_exchange" className="text-primary" /> EUR/USD <Icon name="arrow_drop_down" className="text-on-surface-variant" />
            </button>
            <div className="hidden overflow-hidden rounded border border-outline-variant bg-surface-container-lowest sm:flex">
              {["1M", "5M", "15M"].map((tf, i) => <button key={tf} className={`px-3 py-2 text-xs font-bold ${i === 1 ? "bg-surface-variant text-on-surface" : "text-on-surface-variant"}`}>{tf}</button>)}
            </div>
          </div>
          <div className="text-right"><span className="block font-mono">1.08452</span><span className="text-xs font-bold text-primary">+0.012%</span></div>
        </section>
        <section className="relative min-h-[320px] overflow-hidden rounded border border-outline-variant bg-[#1E293B] md:min-h-[430px]">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-background opacity-60" />
          <svg className="absolute inset-0 h-full w-full text-primary opacity-40" preserveAspectRatio="none" viewBox="0 0 100 100">
            <polyline fill="none" points="0,80 10,75 20,85 30,60 40,65 50,40 60,45 70,20 80,30 90,10 100,5" stroke="currentColor" strokeWidth="0.8" />
            <polyline fill="none" opacity="0.5" points="0,70 15,80 25,60 35,65 45,85 55,70 65,50 75,60 85,40 95,50 100,30" stroke="#EF4444" strokeWidth="0.6" />
          </svg>
          <div className="absolute right-3 top-3 flex gap-1">
            <button className="rounded border border-outline-variant bg-background p-1 text-on-surface-variant"><Icon name="candlestick_chart" className="text-sm" /></button>
            <button className="rounded border border-outline-variant bg-background p-1 text-on-surface-variant"><Icon name="show_chart" className="text-sm" /></button>
          </div>
        </section>
        <section className="grid gap-3 rounded border border-outline-variant bg-[#1E293B] p-4 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-xs font-bold uppercase text-on-surface-variant">Stake (USD)</label>
            <div className="flex items-center rounded border border-outline-variant bg-background">
              <Icon name="attach_money" className="ml-3 text-sm text-on-surface-variant" />
              <input className="w-full border-none bg-transparent p-2 font-mono outline-none" defaultValue="50" type="number" />
            </div>
            <div className="mt-2 flex justify-between text-xs font-bold"><span className="text-on-surface-variant">Payout: 85%</span><span className="text-primary">+$42.50</span></div>
          </div>
          <div className="flex gap-2">
            <button className="flex flex-1 flex-col items-center justify-center rounded bg-[#EF4444] py-3 font-bold text-white"><Icon name="arrow_downward" />DOWN</button>
            <button className="flex flex-1 flex-col items-center justify-center rounded bg-primary-container py-3 font-bold text-on-primary-container"><Icon name="arrow_upward" />UP</button>
          </div>
        </section>
        <section className="overflow-hidden rounded border border-outline-variant bg-[#1E293B]">
          <h3 className="border-b border-outline-variant bg-background p-3 font-semibold">Recent Trades</h3>
          {trades.map(([pair, dir, amount, stake, time, tone]) => (
            <div key={`${pair}-${time}`} className="flex items-center justify-between border-b border-outline-variant p-3">
              <div className="flex items-center gap-3"><span className={`h-2 w-2 rounded-full ${tone === "good" ? "bg-[#22C55E]" : "bg-[#EF4444]"}`} /><div><span>{pair} <b className={tone === "good" ? "text-primary" : "text-[#EF4444]"}>{dir}</b></span><div className="text-xs text-on-surface-variant">{time}</div></div></div>
              <div className="text-right"><div className={`font-mono ${tone === "good" ? "text-[#22C55E]" : "text-[#EF4444]"}`}>{amount}</div><div className="text-xs text-on-surface-variant">{stake}</div></div>
            </div>
          ))}
        </section>
      </div>
    </AppShell>
  );
}
