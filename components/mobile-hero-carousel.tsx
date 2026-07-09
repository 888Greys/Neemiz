"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export function MobileHeroCarousel({ slides }: { slides: string[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % slides.length), 8000);
    return () => clearInterval(t);
  }, [slides.length, paused]);

  return (
    <section
      className="relative overflow-hidden rounded-b-3xl"
      style={{ minHeight: "65vw", maxHeight: 380 }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={() => setPaused(true)}
      onTouchEnd={() => setPaused(false)}
    >
      {/* Background images */}
      {slides.map((src, i) => (
        <div
          key={src}
          className="absolute inset-0 bg-cover bg-center transition-opacity duration-1000"
          style={{ backgroundImage: `url(${src})`, opacity: i === index ? 1 : 0 }}
        />
      ))}

      {/* Layered overlays for depth */}
      <div className="absolute inset-0 bg-gradient-to-br from-black/80 via-black/50 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />

      {/* Content — re-keys on index change to trigger fade-up */}
      <div key={index} className="animate-fade-up relative z-10 flex h-full flex-col justify-end px-5 pb-7 pt-10" style={{ animationDuration: "0.4s" }}>
        {/* Live badge */}
        <div className="mb-4 inline-flex w-fit items-center gap-2 rounded-full bg-emerald-500/20 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-emerald-400 ring-1 ring-emerald-500/30">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
          </span>
          Platform live · no filler
        </div>

        <h1 className="text-[32px] font-black uppercase leading-[.88] tracking-tight text-white drop-shadow-lg">
          Bet. Trade.
          <br />
          <span className="bg-gradient-to-r from-orange-300 via-fuchsia-300 to-sky-300 bg-clip-text text-transparent">
            One home.
          </span>
        </h1>

        <p className="mt-2.5 text-[11px] font-semibold leading-relaxed tracking-wide text-white/50">
          Live products only — no waiting rooms
        </p>

        <div className="mt-5 flex items-center gap-2.5">
          <Link
            href="/sports"
            prefetch={false}
            className="rounded-2xl bg-white px-6 py-3 text-[13px] font-black text-black shadow-lg transition active:scale-[0.97]"
          >
            Sports
          </Link>
          <Link
            href="/aviator"
            prefetch={false}
            className="rounded-2xl border border-white/20 bg-white/10 px-6 py-3 text-[13px] font-black text-white backdrop-blur-sm transition active:scale-[0.97]"
          >
            Aviator
          </Link>
          <Link
            href="/binary"
            prefetch={false}
            className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-[13px] font-black text-white/80 transition active:scale-[0.97]"
          >
            Binary
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
            className={`h-1.5 rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 ${i === index ? "w-5 bg-white" : "w-1.5 bg-white/25"}`}
          />
        ))}
      </div>
    </section>
  );
}
