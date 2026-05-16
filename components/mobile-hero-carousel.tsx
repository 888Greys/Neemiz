"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export function MobileHeroCarousel({ slides }: { slides: string[] }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setIndex((i) => (i + 1) % slides.length), 8000);
    return () => clearInterval(t);
  }, [slides.length]);

  return (
    <section className="relative overflow-hidden" style={{ minHeight: "56vw", maxHeight: 280 }}>
      {/* Background images */}
      {slides.map((src, i) => (
        <div
          key={src}
          className="absolute inset-0 bg-cover bg-center transition-opacity duration-1000"
          style={{ backgroundImage: `url(${src})`, opacity: i === index ? 1 : 0 }}
        />
      ))}
      {/* Overlays */}
      <div className="absolute inset-0 bg-black/55" />
      <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-background to-transparent" />

      {/* Content */}
      <div className="relative z-10 flex h-full flex-col justify-center px-5 py-8">
        <div className="mb-3 inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-300">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
          </span>
          Platform is live · 6 products
        </div>

        <h1 className="text-[28px] font-black uppercase leading-[.9] tracking-tight text-white">
          One platform.
          <br />
          <span className="bg-gradient-to-r from-violet-400 via-white to-amber-400 bg-clip-text text-transparent">
            Six markets.
          </span>
        </h1>

        <p className="mt-2 text-[11px] leading-[1.6] text-slate-400">
          Sports · Aviator · Predictions · P2P · Binary · Wallet
        </p>

        <div className="mt-4 flex items-center gap-2">
          <Link
            href="/sports"
            className="rounded-xl bg-white px-5 py-2 text-xs font-black text-black active:scale-95"
          >
            Get started
          </Link>
          <Link
            href="/aviator"
            className="rounded-xl border border-white/15 bg-white/8 px-5 py-2 text-xs font-black text-white active:scale-95"
          >
            Play Aviator
          </Link>
        </div>
      </div>

      {/* Dot indicators */}
      <div className="absolute bottom-3 right-4 flex gap-1">
        {slides.map((_, i) => (
          <button
            key={i}
            type="button"
            aria-label={`Slide ${i + 1}`}
            onClick={() => setIndex(i)}
            className={`h-1.5 rounded-full transition-all ${i === index ? "w-5 bg-white" : "w-1.5 bg-white/30"}`}
          />
        ))}
      </div>
    </section>
  );
}
