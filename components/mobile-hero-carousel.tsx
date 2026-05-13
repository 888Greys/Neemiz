"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/icon";

type Slide = {
  title: string;
  image: string;
  cta: string;
};

export function MobileHeroCarousel({ slides }: { slides: Slide[] }) {
  const [activeSlide, setActiveSlide] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveSlide((current) => (current + 1) % slides.length);
    }, 4500);

    return () => window.clearInterval(timer);
  }, [slides.length]);

  const slide = slides[activeSlide];

  return (
    <section
      className="relative h-[190px] overflow-hidden rounded-2xl bg-cover bg-center p-4 transition-[background-image] duration-500"
      style={{ backgroundImage: `linear-gradient(90deg, rgba(0,0,0,.62), rgba(0,0,0,.08)), url(${slide.image})` }}
    >
      <div className="relative z-10 flex h-full max-w-[170px] flex-col justify-between">
        <div>
          <h1 className="whitespace-pre-line text-xl font-black leading-tight">{slide.title}</h1>
          <button className="mt-4 rounded-xl bg-white px-4 py-2 text-xs font-black text-black" type="button">
            {slide.cta}
          </button>
        </div>
        <div className="flex gap-1 pb-1">
          {slides.map((item, index) => (
            <button
              key={item.title}
              className={`h-1.5 rounded-full transition-all ${index === activeSlide ? "w-5 bg-white" : "w-1.5 bg-white/35"}`}
              onClick={() => setActiveSlide(index)}
              type="button"
              aria-label={`Show slide ${index + 1}`}
            />
          ))}
        </div>
      </div>
      <button
        className="absolute right-3 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur"
        onClick={() => setActiveSlide((current) => (current + 1) % slides.length)}
        type="button"
        aria-label="Next slide"
      >
        <Icon name="chevron_right" className="text-[22px]" />
      </button>
    </section>
  );
}
