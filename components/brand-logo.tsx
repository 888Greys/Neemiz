"use client";

import Link from "next/link";
import { useSiteConfig } from "@/lib/site-config-context";

type BrandLogoProps = {
  href?: string;
  size?: "sm" | "md" | "lg";
  animated?: boolean;
  className?: string;
};

const sizes = {
  sm: { wrapper: "text-2xl", script: "text-3xl", binary: "text-[15px] sm:text-[17px]" },
  md: { wrapper: "text-3xl", script: "text-4xl", binary: "text-xl" },
  lg: { wrapper: "text-5xl md:text-7xl", script: "text-6xl md:text-8xl", binary: "text-3xl md:text-5xl" },
};

export function BrandLogo({ href, size = "md", animated = false, className = "" }: BrandLogoProps) {
  const { surface, brand } = useSiteConfig();

  const content =
    surface === "binary" ? (
      <span
        className={`inline-flex items-baseline gap-1 font-black tracking-tight ${sizes[size].binary} ${className}`}
      >
        <span
          className="grid h-[1.35em] w-[1.35em] place-items-center rounded-md bg-emerald-500 text-[0.72em] font-black leading-none text-[#0b1220]"
          aria-hidden
        >
          B
        </span>
        <span className="text-white">
          Binary<span className="text-emerald-400">KE</span>
        </span>
        <span className="sr-only">{brand}</span>
      </span>
    ) : (
      <span className={`inline-flex items-baseline font-black tracking-tight ${sizes[size].wrapper} ${className}`}>
        <span
          className={`font-brand text-primary leading-none ${sizes[size].script} ${animated ? "animate-zeem" : ""}`}
          style={{ lineHeight: 1 }}
        >
          n
        </span>
        <span className="text-white -ml-0.5">ezeem</span>
      </span>
    );

  if (!href) return content;

  return (
    <Link href={href} aria-label={`${brand} home`}>
      {content}
    </Link>
  );
}
