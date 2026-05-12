import { AppShell } from "@/components/app-shell";
import { Icon } from "@/components/icon";
import { OddsButton } from "@/components/ui";
import { liveEvents } from "@/lib/mock-data";

const sports = ["Football", "Basketball", "Tennis", "Esports", "Ice Hockey"];

export default function SportsPage() {
  return (
    <AppShell>
      <div className="sticky top-0 z-30 border-b border-outline-variant bg-surface/95 backdrop-blur md:static">
        <div className="flex gap-2 overflow-x-auto px-4 py-3 no-scrollbar">
          {sports.map((sport, index) => (
            <button key={sport} className={`flex shrink-0 items-center gap-1 rounded-full px-4 py-1.5 text-sm ${index === 0 ? "bg-secondary-container font-bold text-on-secondary-container" : "border border-outline-variant bg-surface-container-high text-on-surface-variant"}`}>
              <Icon name={index === 0 ? "sports_soccer" : "sports_basketball"} className="text-[16px]" />
              {sport}
            </button>
          ))}
        </div>
        <div className="px-4 pb-3">
          <div className="flex max-w-sm rounded border border-outline-variant bg-surface-container-high p-1">
            {["Live", "Upcoming", "Outrights"].map((tab, index) => (
              <button key={tab} className={`flex-1 rounded py-1.5 text-xs font-bold uppercase ${index === 0 ? "bg-surface-variant text-primary" : "text-on-surface-variant"}`}>{tab}</button>
            ))}
          </div>
        </div>
      </div>
      <div className="mx-auto max-w-5xl">
        <League title="Premier League" events={liveEvents.slice(0, 2)} />
        <League title="La Liga" events={liveEvents.slice(1, 3)} />
        <League title="NBA" events={liveEvents.slice(3)} />
      </div>
    </AppShell>
  );
}

function League({ title, events }: { title: string; events: typeof liveEvents }) {
  return (
    <section className="mb-2">
      <div className="flex items-center justify-between border-y border-outline-variant bg-surface-container-low px-4 py-2">
        <div className="flex items-center gap-2">
          <span className="h-3 w-4 rounded-sm bg-primary/40" />
          <span className="text-xs font-bold uppercase tracking-wide">{title}</span>
        </div>
        <Icon name="keyboard_arrow_up" className="text-[18px] text-on-surface-variant" />
      </div>
      {events.map((event) => (
        <article key={`${title}-${event.home}`} className="border-b border-outline-variant bg-surface p-4 transition hover:bg-surface-container-lowest">
          <div className="mb-3 flex justify-between gap-4">
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2"><span className="w-10 text-xs font-bold text-primary">{event.time}</span><span className="font-semibold">{event.home}</span></div>
              <div className="flex items-center gap-2"><span className="w-10" /><span>{event.away}</span></div>
            </div>
            <div className="text-right font-semibold text-primary">{event.score}</div>
          </div>
          <div className="flex gap-1">
            {event.odds.slice(0, 3).map((odd, index) => (
              <OddsButton key={odd} label={["1", "X", "2"][index] ?? "Line"} odds={odd} tone={odd === "6.50" ? "down" : "default"} />
            ))}
            <button className="w-14 text-on-surface-variant transition hover:text-primary"><span className="block text-xs font-bold">{event.markets}</span><Icon name="chevron_right" className="text-[18px]" /></button>
          </div>
        </article>
      ))}
    </section>
  );
}
