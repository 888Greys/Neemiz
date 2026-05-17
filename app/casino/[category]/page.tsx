import { AppShell } from "@/components/app-shell";
import { Icon } from "@/components/icon";
import Link from "next/link";
import { notFound } from "next/navigation";

const CDN = "https://pub-5677b2f8e2e544688a1b6e1d1071f970.r2.dev";

/* ── Category config ─────────────────────────────────── */
const CATEGORIES = {
  nezeem: {
    title: "Nezeem Games",
    icon: "videogame_asset",
    source: "nezeem",
    count: 60,
    start: 1,
    color: "text-violet-400",
  },
  crash: {
    title: "Crash Games",
    icon: "rocket_launch",
    source: "crash",
    count: 157,
    start: 1,
    color: "text-orange-400",
  },
  mines: {
    title: "Mines",
    icon: "grid_view",
    source: "mines",
    count: 46,
    start: 1,
    color: "text-sky-400",
  },
  chicken: {
    title: "Chicken Games",
    icon: "egg",
    source: "nezeem",
    count: 30,
    start: 31,
    color: "text-amber-400",
  },
  plinko: {
    title: "Plinko",
    icon: "casino",
    source: "plinko",
    count: 60,
    start: 1,
    color: "text-emerald-400",
  },
} as const;

type CategoryKey = keyof typeof CATEGORIES;

/* ── Page ────────────────────────────────────────────── */
export default async function CategoryPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category } = await params;
  const cat = CATEGORIES[category as CategoryKey];
  if (!cat) notFound();

  const games = Array.from({ length: cat.count }, (_, i) => ({
    image: `${CDN}/games/${cat.source}/${cat.start + i}.avif`,
    href: "/aviator",
  }));

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-[1600px] px-6 py-10">
        {/* Breadcrumb */}
        <div className="mb-6 flex items-center gap-2 text-sm text-slate-500">
          <Link href="/dashboard" className="transition hover:text-white">Home</Link>
          <Icon name="chevron_right" className="text-[14px]" />
          <span className="text-white">{cat.title}</span>
        </div>

        {/* Title */}
        <h1 className="mb-8 flex items-center gap-3 text-3xl font-black text-white">
          <Icon name={cat.icon} fill className={`text-[32px] ${cat.color}`} />
          {cat.title}
          <span className="ml-2 rounded-full bg-white/10 px-3 py-1 text-base font-bold text-slate-400">
            {cat.count}
          </span>
        </h1>

        {/* Grid */}
        <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-3 sm:grid-cols-[repeat(auto-fill,minmax(160px,1fr))]">
          {games.map((g) => (
            <Link
              key={g.image}
              href={g.href}
              className="group overflow-hidden rounded-2xl transition-transform hover:scale-[1.04] active:scale-[.98]"
              style={{
                backgroundImage: `linear-gradient(180deg, rgba(0,0,0,0) 55%, rgba(0,0,0,.75) 100%), url(${g.image})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                aspectRatio: "3/4",
              }}
            />
          ))}
        </div>
      </div>
    </AppShell>
  );
}

/* ── Static params (optional, for build-time generation) */
export function generateStaticParams() {
  return Object.keys(CATEGORIES).map((category) => ({ category }));
}
