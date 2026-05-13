import { AppShell } from "@/components/app-shell";
import { Icon } from "@/components/icon";
import { MobileProductChip, OddsButton, ProductShortcut, WalletSummary } from "@/components/ui";
import { liveEvents, predictionMarkets, productCards } from "@/lib/mock-data";

export default function HomePage() {
  return (
    <AppShell>
      <div className="mx-auto w-full max-w-[1440px] p-4 md:p-6">
        <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
          <section className="hidden min-h-60 overflow-hidden rounded-xl border border-outline-variant bg-surface-container p-6 md:block">
            <div className="absolute" />
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="rounded bg-[#EF4444] px-2 py-0.5 text-[10px] font-bold uppercase text-white">Live</span>
                <span className="font-mono text-sm text-on-surface-variant">68:42</span>
              </div>
              <Icon name="sports_soccer" className="text-on-surface-variant" />
            </div>
            <div className="mb-8 flex items-center justify-between">
              <Team name="Real Madrid" />
              <div className="px-4 text-center">
                <div className="font-headline text-4xl font-black tracking-tight">2 - 1</div>
                <div className="text-xs uppercase tracking-widest text-on-surface-variant">Featured Match</div>
              </div>
              <Team name="Man City" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <OddsButton label="1" odds="1.85" />
              <OddsButton label="X" odds="3.40" />
              <OddsButton label="2" odds="4.20" />
            </div>
          </section>

          <div className="space-y-6 md:hidden">
            <WalletSummary />
            <div className="flex snap-x gap-2 overflow-x-auto pb-1 no-scrollbar">
              {productCards.map((item) => (
                <MobileProductChip key={item.label} href={item.href} label={item.label} />
              ))}
            </div>
            <section>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-lg font-semibold">Featured Match</h3>
                <span className="flex items-center gap-1 text-xs font-bold text-primary"><span className="h-1.5 w-1.5 rounded-full bg-primary" /> Live 75&apos;</span>
              </div>
              <div className="rounded-lg border border-outline-variant bg-surface-container p-4">
                <div className="mb-5 flex items-center justify-between">
                  <MobileTeam name="Arsenal" />
                  <div className="text-center">
                    <div className="font-headline text-2xl font-semibold tracking-widest text-primary">2 - 1</div>
                    <div className="text-[10px] uppercase tracking-wide text-on-surface-variant">Premier League</div>
                  </div>
                  <MobileTeam name="Chelsea" />
                </div>
                <div className="flex gap-2">
                  <OddsButton label="1" odds="2.10" />
                  <OddsButton label="X" odds="3.45" />
                  <OddsButton label="2" odds="3.80" />
                </div>
              </div>
            </section>
          </div>

          <section className="hidden rounded-xl border border-outline-variant bg-surface-container p-6 xl:block">
            <h2 className="mb-5 text-lg font-semibold">Featured Market</h2>
            <PredictionPreview />
          </section>
        </div>

        <section className="mt-6 hidden md:block">
          <h2 className="mb-4 text-lg font-semibold">Markets</h2>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
            {productCards.filter((item) => item.label !== "Live").map((item) => (
              <ProductShortcut key={item.label} {...item} />
            ))}
          </div>
        </section>

        <div className="mt-6 grid gap-6 xl:grid-cols-2">
          <section className="overflow-hidden rounded-xl border border-outline-variant bg-surface-container">
            <Header title="Trending In-Play" live />
            <div className="divide-y divide-outline-variant">
              {liveEvents.slice(0, 4).map((event) => (
                <div key={`${event.home}-${event.away}`} className="flex items-center justify-between gap-3 p-4 transition hover:bg-surface-variant">
                  <div>
                    <div className="mb-1 flex items-center gap-2">
                      <span className="text-xs font-bold text-[#EF4444]">{event.time}</span>
                      <span className="text-xs text-on-surface-variant">{event.league}</span>
                    </div>
                    <div className="font-medium">{event.home} vs {event.away}</div>
                  </div>
                  <div className="flex gap-1">
                    {event.odds.slice(0, 3).map((odd, index) => (
                      <span key={odd} className="min-w-12 rounded border border-outline-variant bg-surface-dim px-3 py-1 text-center font-mono text-sm">{odd}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-outline-variant bg-surface-container p-5 md:hidden xl:block">
            <h2 className="mb-4 text-lg font-semibold">Predictions</h2>
            <PredictionPreview />
          </section>
        </div>
      </div>
    </AppShell>
  );
}

function Team({ name }: { name: string }) {
  return (
    <div className="flex flex-1 flex-col items-center">
      <div className="mb-2 flex h-16 w-16 items-center justify-center rounded-full border border-outline-variant bg-surface-dim">
        <Icon name="sports_soccer" className="text-primary" />
      </div>
      <span className="text-center text-lg font-semibold">{name}</span>
    </div>
  );
}

function MobileTeam({ name }: { name: string }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-variant">
        <Icon name="sports_soccer" className="text-[20px] text-on-surface-variant" />
      </div>
      <span className="text-sm">{name}</span>
    </div>
  );
}

function Header({ title, live }: { title: string; live?: boolean }) {
  return (
    <div className="flex items-center justify-between border-b border-outline-variant bg-surface-dim/50 p-4">
      <h2 className="flex items-center gap-2 font-semibold">
        {live && <span className="h-2 w-2 rounded-full bg-[#EF4444]" />}
        {title}
      </h2>
      <span className="text-xs font-bold uppercase text-primary">View All</span>
    </div>
  );
}

function PredictionPreview() {
  const market = predictionMarkets[0];
  return (
    <div>
      <h3 className="mb-6 text-center text-lg font-semibold">{market.title}</h3>
      <div className="space-y-4">
        <PredictionBar label="Yes" value={market.yes} odds="1.53" tone="yes" />
        <PredictionBar label="No" value={market.no} odds="2.65" tone="no" />
      </div>
      <div className="mt-5 flex justify-between border-t border-outline-variant pt-4 font-mono text-sm text-on-surface-variant">
        <span>Vol: {market.volume}</span>
        <span>Closes: {market.closes}</span>
      </div>
    </div>
  );
}

function PredictionBar({ label, value, odds, tone }: { label: string; value: number; odds: string; tone: "yes" | "no" }) {
  const color = tone === "yes" ? "bg-primary/20 text-primary" : "bg-[#EF4444]/20 text-[#EF4444]";
  return (
    <button className="relative flex h-12 w-full items-center overflow-hidden rounded border border-outline-variant bg-surface-dim text-left">
      <span className={`absolute inset-y-0 left-0 ${color}`} style={{ width: `${value}%` }} />
      <span className="relative z-10 flex w-full items-center justify-between px-4">
        <span className="font-bold text-on-surface">{label}</span>
        <span className="flex gap-4 font-mono"><span className="text-on-surface-variant">{value}%</span><span className={tone === "yes" ? "text-primary" : "text-[#EF4444]"}>{odds}</span></span>
      </span>
    </button>
  );
}
