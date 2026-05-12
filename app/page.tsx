import { AppShell } from "@/components/app-shell";
import { Icon } from "@/components/icon";
import { MobileProductChip, OddsButton, ProductShortcut, WalletSummary } from "@/components/ui";
import { liveEvents, predictionMarkets, productCards } from "@/lib/mock-data";

const tickerItems = [
  { teams: "Real Madrid vs Man City", score: "2 - 1", time: "68'" },
  { teams: "Arsenal vs Chelsea", score: "1 - 1", time: "45'" },
  { teams: "PSG vs Bayern", score: "0 - 2", time: "72'" },
  { teams: "Liverpool vs Spurs", score: "3 - 0", time: "88'" },
  { teams: "Barcelona vs Atlético", score: "1 - 0", time: "34'" },
  { teams: "Dortmund vs Leipzig", score: "2 - 2", time: "61'" },
];

const statsBar = [
  { label: "Live Events", value: "142", icon: "sports_soccer" },
  { label: "Markets Open", value: "4,800+", icon: "bar_chart" },
  { label: "Players Online", value: "12.4K", icon: "group" },
  { label: "24h Volume", value: "$2.1M", icon: "trending_up" },
];

export default function HomePage() {
  return (
    <AppShell>
      {/* Live ticker */}
      <div className="overflow-hidden border-b border-outline-variant bg-surface-container-lowest py-2">
        <div className="flex animate-ticker whitespace-nowrap">
          {[...tickerItems, ...tickerItems].map((item, i) => (
            <span key={i} className="mx-6 inline-flex items-center gap-3 text-xs">
              <span className="animate-live-pulse h-1.5 w-1.5 rounded-full bg-[#EF4444]" />
              <span className="text-on-surface-variant">{item.teams}</span>
              <span className="font-mono font-bold text-on-surface">{item.score}</span>
              <span className="text-[#EF4444]">{item.time}</span>
              <span className="mx-2 text-outline-variant">|</span>
            </span>
          ))}
        </div>
      </div>

      <div className="mx-auto w-full max-w-[1440px] p-4 md:p-6">
        {/* Stats bar */}
        <div className="mb-6 hidden grid-cols-4 gap-3 md:grid animate-fade-up" style={{ animationDelay: "0.05s" }}>
          {statsBar.map((stat) => (
            <div key={stat.label} className="flex items-center gap-3 rounded-xl border border-outline-variant bg-surface-container px-4 py-3 transition hover:border-primary/50">
              <div className="flex h-8 w-8 items-center justify-center rounded bg-primary/10">
                <Icon name={stat.icon} className="text-[18px] text-primary" />
              </div>
              <div>
                <div className="font-mono text-base font-bold text-on-surface">{stat.value}</div>
                <div className="text-[10px] uppercase tracking-wide text-on-surface-variant">{stat.label}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
          {/* Desktop featured match hero */}
          <section
            className="animate-fade-up animate-glow-breathe relative hidden min-h-64 overflow-hidden rounded-xl border border-primary/20 bg-surface-container md:block"
            style={{ animationDelay: "0.1s" }}
          >
            {/* Background layers */}
            <div className="hero-grid absolute inset-0" />
            <div className="absolute inset-0 bg-gradient-to-br from-primary/8 via-transparent to-transparent" />
            <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-primary/6 blur-3xl" />
            <div className="absolute -bottom-12 -left-12 h-40 w-40 rounded-full bg-secondary/6 blur-3xl" />

            <div className="relative p-6">
              <div className="mb-5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1.5 rounded-full bg-[#EF4444]/15 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[#EF4444]">
                    <span className="animate-live-pulse h-1.5 w-1.5 rounded-full bg-[#EF4444]" />
                    Live
                  </span>
                  <span className="font-mono text-sm text-on-surface-variant">68:42</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-on-surface-variant">Premier League</span>
                  <Icon name="sports_soccer" className="text-on-surface-variant" />
                </div>
              </div>

              <div className="mb-8 flex items-center justify-between">
                <Team name="Real Madrid" badge="RM" />
                <div className="px-4 text-center">
                  <div className="font-headline text-5xl font-black tracking-tight text-on-surface">2 – 1</div>
                  <div className="mt-1 text-[10px] uppercase tracking-widest text-on-surface-variant">Featured Match</div>
                  <div className="mt-3 flex items-center justify-center gap-1.5">
                    {[...Array(5)].map((_, i) => (
                      <span key={i} className={`h-1 rounded-full ${i < 2 ? "w-4 bg-primary" : i === 2 ? "w-2 bg-[#EF4444]" : "w-2 bg-outline-variant"}`} />
                    ))}
                  </div>
                </div>
                <Team name="Man City" badge="MC" flip />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <OddsButton label="1 — Real Madrid" odds="1.85" />
                <OddsButton label="X — Draw" odds="3.40" />
                <OddsButton label="2 — Man City" odds="4.20" />
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-outline-variant/50 pt-3 text-xs text-on-surface-variant">
                <span>43 markets available</span>
                <button className="flex items-center gap-1 text-primary transition hover:underline">
                  View all markets <Icon name="arrow_forward" className="text-[14px]" />
                </button>
              </div>
            </div>
          </section>

          {/* Mobile section */}
          <div className="space-y-4 md:hidden animate-fade-up">
            <WalletSummary />
            <div className="flex snap-x gap-2 overflow-x-auto pb-1 no-scrollbar">
              {productCards.map((item) => (
                <MobileProductChip key={item.label} href={item.href} label={item.label} />
              ))}
            </div>
            <section>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-lg font-semibold">Featured Match</h3>
                <span className="flex items-center gap-1.5 text-xs font-bold text-[#EF4444]">
                  <span className="animate-live-pulse h-1.5 w-1.5 rounded-full bg-[#EF4444]" /> Live 75&apos;
                </span>
              </div>
              <div className="relative overflow-hidden rounded-xl border border-primary/20 bg-surface-container p-4">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/6 via-transparent to-transparent" />
                <div className="relative mb-5 flex items-center justify-between">
                  <MobileTeam name="Arsenal" badge="AR" />
                  <div className="text-center">
                    <div className="font-headline text-3xl font-black tracking-widest text-primary">2 – 1</div>
                    <div className="text-[10px] uppercase tracking-wide text-on-surface-variant">Premier League</div>
                  </div>
                  <MobileTeam name="Chelsea" badge="CH" />
                </div>
                <div className="relative flex gap-2">
                  <OddsButton label="1" odds="2.10" />
                  <OddsButton label="X" odds="3.45" />
                  <OddsButton label="2" odds="3.80" />
                </div>
              </div>
            </section>
          </div>

          {/* Desktop prediction preview */}
          <section
            className="animate-fade-up hidden rounded-xl border border-outline-variant bg-surface-container p-6 xl:block"
            style={{ animationDelay: "0.15s" }}
          >
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Featured Market</h2>
              <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">Prediction</span>
            </div>
            <PredictionPreview />
          </section>
        </div>

        {/* Markets grid */}
        <section
          className="mt-6 hidden animate-fade-up md:block"
          style={{ animationDelay: "0.2s" }}
        >
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Markets</h2>
            <span className="text-xs text-on-surface-variant">All products</span>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {productCards.filter((item) => item.label !== "Live").map((item, i) => (
              <div key={item.label} className="animate-fade-up" style={{ animationDelay: `${0.22 + i * 0.04}s` }}>
                <ProductShortcut {...item} />
              </div>
            ))}
          </div>
        </section>

        {/* Bottom row */}
        <div className="mt-6 grid gap-6 xl:grid-cols-2">
          <section
            className="animate-fade-up overflow-hidden rounded-xl border border-outline-variant bg-surface-container"
            style={{ animationDelay: "0.3s" }}
          >
            <SectionHeader title="Trending In-Play" live />
            <div className="divide-y divide-outline-variant">
              {liveEvents.slice(0, 4).map((event, i) => (
                <div
                  key={`${event.home}-${event.away}`}
                  className="group flex items-center justify-between gap-3 p-4 transition hover:bg-surface-variant"
                >
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center gap-2">
                      <span className="flex items-center gap-1 text-xs font-bold text-[#EF4444]">
                        <span className="animate-live-pulse h-1 w-1 rounded-full bg-[#EF4444]" />
                        {event.time}
                      </span>
                      <span className="truncate text-xs text-on-surface-variant">{event.league}</span>
                    </div>
                    <div className="truncate font-medium">{event.home} vs {event.away}</div>
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    {event.odds.slice(0, 3).map((odd) => (
                      <span
                        key={odd}
                        className="min-w-11 rounded border border-outline-variant bg-surface-dim px-2.5 py-1.5 text-center font-mono text-sm transition group-hover:border-primary/40"
                      >
                        {odd}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t border-outline-variant bg-surface-dim/30 px-4 py-3 text-center">
              <button className="text-xs font-bold text-primary transition hover:underline">
                View all live events <Icon name="arrow_forward" className="inline text-[14px]" />
              </button>
            </div>
          </section>

          <section
            className="animate-fade-up rounded-xl border border-outline-variant bg-surface-container p-5 md:hidden xl:block"
            style={{ animationDelay: "0.35s" }}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Predictions</h2>
              <span className="text-xs text-on-surface-variant">Polymarket-style</span>
            </div>
            <PredictionPreview />
          </section>
        </div>
      </div>
    </AppShell>
  );
}

function Team({ name, badge, flip }: { name: string; badge: string; flip?: boolean }) {
  return (
    <div className={`flex flex-1 flex-col items-center ${flip ? "items-center" : "items-center"}`}>
      <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full border border-outline-variant bg-gradient-to-br from-surface-variant to-surface-container-highest shadow-lg">
        <span className="font-mono text-sm font-black text-on-surface-variant">{badge}</span>
      </div>
      <span className="text-center text-sm font-semibold">{name}</span>
    </div>
  );
}

function MobileTeam({ name, badge }: { name: string; badge: string }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex h-11 w-11 items-center justify-center rounded-full border border-outline-variant bg-surface-variant shadow">
        <span className="font-mono text-xs font-black text-on-surface-variant">{badge}</span>
      </div>
      <span className="text-sm font-medium">{name}</span>
    </div>
  );
}

function SectionHeader({ title, live }: { title: string; live?: boolean }) {
  return (
    <div className="flex items-center justify-between border-b border-outline-variant bg-surface-dim/50 px-4 py-3">
      <h2 className="flex items-center gap-2 font-semibold">
        {live && <span className="animate-live-pulse h-2 w-2 rounded-full bg-[#EF4444]" />}
        {title}
      </h2>
      <span className="text-xs font-bold uppercase tracking-wide text-primary">View All</span>
    </div>
  );
}

function PredictionPreview() {
  const market = predictionMarkets[0];
  return (
    <div>
      <h3 className="mb-1 text-sm font-bold text-on-surface">{market.title}</h3>
      <p className="mb-5 text-xs text-on-surface-variant">Community prediction market · 847 traders</p>
      <div className="space-y-3">
        <PredictionBar label="Yes" value={market.yes} odds="1.53" tone="yes" />
        <PredictionBar label="No" value={market.no} odds="2.65" tone="no" />
      </div>
      <div className="mt-5 grid grid-cols-3 gap-2 border-t border-outline-variant pt-4 text-center">
        <div>
          <div className="font-mono text-sm font-bold text-on-surface">{market.volume}</div>
          <div className="text-[10px] uppercase tracking-wide text-on-surface-variant">Volume</div>
        </div>
        <div>
          <div className="font-mono text-sm font-bold text-on-surface">{market.closes}</div>
          <div className="text-[10px] uppercase tracking-wide text-on-surface-variant">Closes</div>
        </div>
        <div>
          <div className="font-mono text-sm font-bold text-primary">847</div>
          <div className="text-[10px] uppercase tracking-wide text-on-surface-variant">Traders</div>
        </div>
      </div>
    </div>
  );
}

function PredictionBar({ label, value, odds, tone }: { label: string; value: number; odds: string; tone: "yes" | "no" }) {
  const isYes = tone === "yes";
  const fillColor = isYes ? "bg-primary/15" : "bg-[#EF4444]/15";
  const textColor = isYes ? "text-primary" : "text-[#EF4444]";
  const borderColor = isYes ? "border-primary/30 hover:border-primary/60" : "border-[#EF4444]/20 hover:border-[#EF4444]/40";
  return (
    <button className={`relative flex h-13 w-full items-center overflow-hidden rounded-lg border bg-surface-dim text-left transition ${borderColor}`}>
      <span className={`absolute inset-y-0 left-0 transition-all duration-500 ${fillColor}`} style={{ width: `${value}%` }} />
      <span className="relative z-10 flex w-full items-center justify-between px-4 py-3">
        <span className={`flex items-center gap-2 font-bold ${textColor}`}>
          <span className={`h-2 w-2 rounded-full ${isYes ? "bg-primary" : "bg-[#EF4444]"}`} />
          {label}
        </span>
        <span className="flex items-center gap-4 font-mono text-sm">
          <span className="text-on-surface-variant">{value}%</span>
          <span className={`font-bold ${textColor}`}>{odds}</span>
        </span>
      </span>
    </button>
  );
}
