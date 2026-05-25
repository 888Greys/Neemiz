"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

const SLIDES = [
  {
    img: "https://pub-5677b2f8e2e544688a1b6e1d1071f970.r2.dev/promo-ball.jpeg",
    badge: "x6",
    title: "for Nezeem Points",
    subtitle: "Place sports bets and earn even more Nezeem Points",
    bg: "from-[#0a1628] via-[#0d1f45] to-[#0a1628]",
    fadeSrc: "#0a1628",
  },
  {
    img: "https://pub-5677b2f8e2e544688a1b6e1d1071f970.r2.dev/promo-2.avif",
    badge: "x2",
    title: "Bonus on First Bet",
    subtitle: "Sign up today and double your first sports wager",
    bg: "from-[#0d2010] via-[#0f2e14] to-[#0d2010]",
    fadeSrc: "#0d2010",
  },
];

export function SportPromoBanner() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => setActive((a) => (a + 1) % SLIDES.length), 5000);
    return () => clearInterval(t);
  }, [paused]);

  const prev = () => setActive((a) => (a - 1 + SLIDES.length) % SLIDES.length);
  const next = () => setActive((a) => (a + 1) % SLIDES.length);

  return (
    <div
      className="relative mx-3 mt-3 min-h-[168px] overflow-hidden rounded-2xl sm:min-h-[230px] sm:rounded-3xl lg:min-h-[270px]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* All slides rendered, crossfade via opacity */}
      {SLIDES.map((slide, i) => (
        <div
          key={i}
          className={`absolute inset-0 bg-gradient-to-r ${slide.bg} transition-opacity duration-500 ${
            i === active ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
        >
          {/* Background net SVG */}
          <svg
            className="absolute inset-0 h-full w-full opacity-[0.07]"
            viewBox="0 0 600 200"
            preserveAspectRatio="xMidYMid slice"
            aria-hidden="true"
          >
            {Array.from({ length: 12 }).map((_, j) => (
              <line key={`v${j}`} x1={j * 55} y1="0" x2={j * 55 + 20} y2="200" stroke="white" strokeWidth="1" />
            ))}
            {Array.from({ length: 7 }).map((_, j) => (
              <line key={`h${j}`} x1="0" y1={j * 33} x2="600" y2={j * 33 + 8} stroke="white" strokeWidth="1" />
            ))}
          </svg>

          {/* Real photo — right half */}
          <div className="absolute right-0 top-0 h-full w-[58%] overflow-hidden sm:w-[52%]">
            <Image
              src={slide.img}
              alt=""
              fill
              className="object-cover object-center sm:object-left"
              priority={i === 0}
            />
            <div
              className="absolute inset-y-0 left-0 w-14 bg-gradient-to-r to-transparent sm:w-24"
              style={{ backgroundImage: `linear-gradient(to right, ${slide.fadeSrc}, transparent)` }}
            />
          </div>

          {/* Text content */}
          <div
            key={i === active ? "active" : `idle-${i}`}
            className={`relative z-10 max-w-[62%] px-4 py-5 pr-2 sm:max-w-none sm:px-6 sm:py-8 sm:pr-44 ${i === active ? "animate-fade-up" : ""}`}
            style={i === active ? { animationDuration: "0.3s" } : undefined}
          >
            <div className="mb-1 flex items-baseline gap-2">
              <span className="text-3xl font-black text-white sm:text-4xl">{slide.badge}</span>
              <span className="text-base font-black leading-tight text-white sm:text-xl">{slide.title}</span>
            </div>
            <p className="text-[12px] leading-4 text-white/65 sm:text-[13px] sm:leading-5">{slide.subtitle}</p>
          </div>
        </div>
      ))}

      {/* ? help button (always on top) */}
      <button
        type="button"
        aria-label="Info"
        className="absolute right-3 top-3 z-20 flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-sm font-black text-white/60 transition hover:bg-white/20 sm:right-4 sm:top-4"
      >
        ?
      </button>

      {/* Carousel arrows */}
      <button
        type="button"
        onClick={prev}
        className="absolute bottom-3 right-12 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 sm:bottom-4 sm:right-14"
      >
        ‹
      </button>
      <button
        type="button"
        onClick={next}
        className="absolute bottom-3 right-3 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 sm:bottom-4 sm:right-4"
      >
        ›
      </button>

      {/* Dots */}
      <div className="absolute bottom-4 left-4 z-20 flex gap-1.5 sm:bottom-5 sm:left-6">
        {SLIDES.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setActive(i)}
            className={`h-1.5 rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 ${i === active ? "w-4 bg-white" : "w-1.5 bg-white/30"}`}
          />
        ))}
      </div>
    </div>
  );
}
