"use client";

import { useRef } from "react";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { Icon } from "@/components/icon";
import { useAuthModal } from "@/lib/auth-modal-context";
import { toast } from "@/lib/toast";

/* ── Single game card ─────────────────────────────────── */
function GameCard({ image, href }: { image: string; href: string }) {
  const { isSignedIn } = useAuth();
  const { openLogin } = useAuthModal();

  const sharedClassName = "group relative flex-shrink-0 w-[120px] md:w-[160px] overflow-hidden rounded-2xl transition-transform hover:scale-[1.04] active:scale-[.98]";
  const sharedStyle = {
    backgroundImage: `linear-gradient(180deg, rgba(0,0,0,0) 55%, rgba(0,0,0,.75) 100%), url(${image})`,
    backgroundSize: "cover" as const,
    backgroundPosition: "center",
    aspectRatio: "3/4",
  };

  if (!isSignedIn) {
    return (
      <button
        type="button"
        onClick={openLogin}
        className={sharedClassName}
        style={sharedStyle}
      />
    );
  }

  // All game cards are coming soon — show toast instead of navigating
  return (
    <button
      type="button"
      onClick={() => toast.info("Coming soon", "This game is launching soon. Stay tuned! 🎮")}
      className={sharedClassName}
      style={sharedStyle}
    />
  );
}

/* ── Scrollable game row ──────────────────────────────── */
export function GameRow({
  title,
  icon,
  allHref,
  games,
}: {
  title: string;
  icon: string;
  allHref: string;
  games: { image: string; href: string }[];
}) {
  const rowRef = useRef<HTMLDivElement>(null);

  const SCROLL_PX = 4 * (160 + 12);

  const scrollBy = (dir: 1 | -1) => {
    rowRef.current?.scrollBy({ left: dir * SCROLL_PX, behavior: "smooth" });
  };

  return (
    <section className="mt-6 md:mt-10">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-base font-black text-white md:text-xl">
          <Icon name={icon} fill className="text-[18px] text-amber-400 md:text-[22px]" />
          {title}
        </h2>
        <div className="flex items-center gap-2">
          <Link
            href={allHref}
            className="flex items-center gap-1 rounded-xl bg-[#1e2028] px-4 py-2 text-sm font-black text-slate-300 transition hover:bg-[#26272e] hover:text-white"
          >
            All games
            <Icon name="chevron_right" className="text-[16px]" />
          </Link>
          <div className="hidden sm:flex items-center gap-2">
            <button
              type="button"
              onClick={() => scrollBy(-1)}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#1e2028] text-slate-400 transition hover:bg-[#26272e] hover:text-white active:scale-95"
            >
              <Icon name="chevron_left" className="text-[20px]" />
            </button>
            <button
              type="button"
              onClick={() => scrollBy(1)}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#1e2028] text-slate-400 transition hover:bg-[#26272e] hover:text-white active:scale-95"
            >
              <Icon name="chevron_right" className="text-[20px]" />
            </button>
          </div>
        </div>
      </div>

      {/* Scrollable row */}
      <div
        ref={rowRef}
        className="flex gap-3 overflow-x-auto pb-2 no-scrollbar scroll-smooth"
      >
        {games.map((g) => (
          <GameCard key={g.image} image={g.image} href={g.href} />
        ))}
      </div>
    </section>
  );
}
