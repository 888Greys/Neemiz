import { AppShell } from "@/components/app-shell";
import { Icon } from "@/components/icon";

const gameCards = [
  { title: "Mines", icon: "grid_view", color: "from-sky-500 to-blue-900" },
  { title: "Lucky Jet", icon: "rocket_launch", color: "from-violet-400 to-purple-900" },
  { title: "Dice", icon: "casino", color: "from-blue-300 to-blue-900" },
  { title: "Coinflip", icon: "paid", color: "from-amber-300 to-orange-800" },
  { title: "Penalty", icon: "sports_soccer", color: "from-green-400 to-green-900" },
  { title: "Aviator", icon: "flight_takeoff", color: "from-cyan-400 to-blue-800" },
];

const sports = [
  ["Croatia Cup", "GNK Dinamo Zagreb", "HNK Rijeka", "19:00", "1.44", "4.10", "6.60"],
  ["Spain LaLiga", "Villarreal", "Sevilla", "20:00", "1.96", "3.52", "4.00"],
  ["DreamLeague", "Pvision", "Tundra", "Break", "1.15", "4.83", "+89"],
  ["DreamLeague", "BB", "REKONIX", "Map 2", "1.02", "10.99", "+55"],
];

export default function DashboardPage() {
  return (
    <AppShell>
      <div className="mx-auto w-full max-w-[1500px] px-3 py-3 md:px-6 md:py-4">
        <div className="mb-3 flex gap-2 overflow-x-auto no-scrollbar md:mb-5">
          {["Lobby", "Live Casino", "Quick Games", "Sports", "Markets"].map((tab, index) => (
            <button
              key={tab}
              className={`shrink-0 rounded-xl px-3.5 py-2 text-xs font-bold md:rounded-2xl md:px-5 md:py-2.5 md:text-base ${
                index === 0 ? "bg-primary-container text-on-primary-container" : "bg-surface-container-high text-on-surface-variant"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <section className="grid gap-3 md:gap-5 xl:grid-cols-[1fr_420px]">
          <div className="relative min-h-[210px] overflow-hidden rounded-2xl border border-outline-variant bg-gradient-to-r from-[#07101d] via-[#243149] to-[#080a10] p-4 md:min-h-[300px] md:rounded-[28px] md:p-9">
            <div className="relative z-10 max-w-xl">
              <div className="mb-3 inline-flex rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-primary md:mb-4 md:px-3 md:text-xs">
                Nezeem lobby
              </div>
              <h1 className="text-3xl font-black uppercase leading-none tracking-tight md:text-7xl">
                Crypto
                <br />
                Casino #1
              </h1>
              <p className="mt-3 max-w-md text-xs leading-5 text-on-surface-variant md:mt-5 md:text-lg md:leading-7">
                Casino, sports, fast games, P2P and prediction markets arranged in one compact wallet experience.
              </p>
              <button className="mt-5 rounded-xl bg-white px-5 py-2 text-sm font-black text-black md:mt-8 md:rounded-2xl md:px-8 md:py-3 md:text-lg">Play</button>
            </div>
            <div className="absolute -right-12 bottom-0 hidden h-80 w-80 rounded-full border-[38px] border-white/15 xl:block" />
            <div className="absolute right-20 top-14 hidden h-24 w-24 rounded-full bg-primary/30 blur-3xl md:block" />
          </div>

          <div className="grid gap-3 sm:grid-cols-2 md:gap-5 xl:grid-cols-1">
            <article className="overflow-hidden rounded-2xl bg-gradient-to-br from-[#4f78ff] to-[#244dff] p-4 md:rounded-[28px] md:p-6">
              <h2 className="text-xl font-black md:text-3xl">Best game of the week</h2>
              <div className="mt-4 flex h-24 items-end justify-center rounded-2xl border border-white/40 bg-white/15 md:mt-8 md:h-36 md:rounded-3xl">
                <Icon name="emoji_events" className="mb-5 text-4xl text-white/85 md:mb-7 md:text-6xl" />
              </div>
              <button className="mt-3 w-full rounded-xl bg-white py-2 text-sm font-black text-black md:mt-5 md:py-3 md:text-lg">Play</button>
            </article>

            <article className="rounded-2xl bg-[#62758a] p-4 md:rounded-[28px] md:p-6">
              <h3 className="text-xl font-black md:text-2xl">Bonuses</h3>
              <p className="mt-9 flex items-center gap-2 text-sm text-white/90 md:mt-16 md:text-base">
                <span className="h-2 w-2 rounded-full bg-white" /> 1 available bonus
              </p>
            </article>
          </div>
        </section>

        <section className="mt-6 md:mt-8">
          <div className="mb-3 flex items-center justify-between md:mb-4">
            <h2 className="flex items-center gap-2 text-lg font-black md:gap-3 md:text-2xl">
              <span className="text-primary">Nezeem</span> games
            </h2>
            <button className="rounded-xl bg-surface-container-high px-3 py-2 text-xs font-bold md:rounded-2xl md:px-5 md:py-2.5 md:text-base">All games</button>
          </div>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:gap-3 lg:grid-cols-6">
            {gameCards.map((game) => (
              <article
                key={game.title}
                className={`flex aspect-square flex-col justify-end overflow-hidden rounded-xl bg-gradient-to-br ${game.color} p-3 shadow-[inset_0_-40px_60px_rgba(0,0,0,.28)] sm:aspect-[4/5] md:rounded-2xl md:p-4 md:shadow-[inset_0_-50px_70px_rgba(0,0,0,.28)]`}
              >
                <Icon name={game.icon} className="mb-auto text-3xl text-white/85 md:text-5xl" />
                <h3 className="text-lg font-black uppercase leading-none md:text-3xl">{game.title}</h3>
                <p className="mt-1.5 text-[9px] font-bold uppercase text-white/70 md:mt-2 md:text-[10px]">Nezeem games</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-7 md:mt-10">
          <div className="mb-3 flex items-center justify-between md:mb-4">
            <h2 className="flex items-center gap-2 text-lg font-black md:text-2xl">
              <span className="rounded-lg bg-[#ff1979] p-1 md:p-1.5">
                <Icon name="sensors" className="text-[16px] md:text-[20px]" />
              </span>
              Top Sports
            </h2>
            <button className="rounded-xl bg-surface-container-high px-3 py-2 text-xs font-bold md:rounded-2xl md:px-5 md:py-2.5 md:text-base">View all</button>
          </div>

          <div className="grid gap-3 md:grid-cols-2 md:gap-4 2xl:grid-cols-4">
            {sports.map(([league, home, away, time, one, draw, two]) => (
              <article key={`${league}-${home}`} className="rounded-xl bg-[#f2f3f6] p-3 text-black md:rounded-2xl md:p-5">
                <div className="mb-3 flex items-center gap-2 md:mb-4">
                  <span className="rounded-full bg-[#ff4b14] p-1 text-white">
                    <Icon name="local_fire_department" fill className="text-[16px] md:text-[18px]" />
                  </span>
                  <div>
                    <div className="text-sm font-black md:text-lg">{league}</div>
                    <div className="text-xs text-black/65 md:text-sm">Soccer</div>
                  </div>
                </div>
                <div className="mb-3 inline-flex rounded-full bg-white px-2.5 py-1 text-xs font-bold text-black/70 md:mb-4 md:px-3 md:text-sm">{time}</div>
                <div className="mb-4 space-y-1 text-sm font-semibold md:mb-5 md:text-lg">
                  <div>{home}</div>
                  <div>{away}</div>
                </div>
                <div className="text-xs text-black/60 md:text-sm">Full time result</div>
                <div className="mt-2 grid grid-cols-4 gap-1">
                  {[["1", one], ["X", draw], ["2", two], ["", "+99"]].map(([label, value]) => (
                    <button key={`${home}-${label}-${value}`} className="rounded-lg bg-[#e8eaf0] px-1.5 py-2 text-sm font-black md:px-2 md:py-3 md:text-base">
                      <span className="mr-1 text-xs text-black/50 md:mr-2 md:text-sm">{label}</span>
                      {value}
                    </button>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
