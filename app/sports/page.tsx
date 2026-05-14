import { AppShell } from "@/components/app-shell";
import { Icon } from "@/components/icon";
import Link from "next/link";

const sports = [
  { label: "Football", icon: "sports_soccer", slug: "football" },
  { label: "Basketball", icon: "sports_basketball", slug: "basketball" },
  { label: "Tennis", icon: "sports_tennis", slug: "tennis" },
  { label: "Esports", icon: "sports_esports", slug: "esports" },
  { label: "Ice Hockey", icon: "sports_hockey", slug: "ice-hockey" },
];

const tabs = [
  { label: "Live", slug: "live" },
  { label: "Upcoming", slug: "upcoming" },
  { label: "Outrights", slug: "outrights" },
];

type Props = {
  searchParams: { sport?: string; tab?: string };
};

export default function SportsPage({ searchParams }: Props) {
  const activeSport = searchParams.sport ?? "football";
  const activeTab = searchParams.tab ?? "live";

  return (
    <AppShell>
      <div className="sticky top-0 z-30 border-b border-outline-variant bg-surface/95 backdrop-blur md:static">
        <div className="flex gap-2 overflow-x-auto px-4 py-3 no-scrollbar">
          {sports.map((sport) => {
            const active = activeSport === sport.slug;
            return (
              <Link
                key={sport.slug}
                href={`/sports?sport=${sport.slug}&tab=${activeTab}`}
                className={`flex shrink-0 items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-bold transition ${
                  active
                    ? "bg-[#f59e0b] text-black"
                    : "border border-outline-variant bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest"
                }`}
              >
                <Icon name={sport.icon} fill={active} className="text-[16px]" />
                {sport.label}
              </Link>
            );
          })}
        </div>

        <div className="px-4 pb-3">
          <div className="flex max-w-sm rounded border border-outline-variant bg-surface-container-high p-1">
            {tabs.map((tab) => {
              const active = activeTab === tab.slug;
              return (
                <Link
                  key={tab.slug}
                  href={`/sports?sport=${activeSport}&tab=${tab.slug}`}
                  className={`flex-1 rounded py-1.5 text-center text-xs font-bold uppercase transition ${
                    active
                      ? "bg-surface-variant text-primary"
                      : "text-on-surface-variant hover:text-on-surface"
                  }`}
                >
                  {tab.label}
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex flex-col items-center justify-center px-6 py-24 text-center">
        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-[#1e2028]">
          <Icon name="sports_soccer" fill className="text-[42px] text-slate-500" />
        </div>
        <h2 className="text-2xl font-black text-white">Sports Betting</h2>
        <p className="mt-3 max-w-sm text-sm leading-6 text-slate-400">
          Live odds on 30+ sports with in-play markets are on the way. Check back soon.
        </p>
        <span className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-[#1e2028] px-5 py-2 text-xs font-black uppercase tracking-widest text-slate-400">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
          Coming soon
        </span>
      </div>
    </AppShell>
  );
}
