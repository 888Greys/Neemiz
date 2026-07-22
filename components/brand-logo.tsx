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

function renderBinaryLogo(brand: string, sizeClass: string, className: string) {
  const limeCls = "text-[var(--bok-lime,#b8ff2a)]";
  // Existing BinaryOptionsKE mark: "Binary" + "KE" in lime
  if (brand === "BinaryOptionsKE" || brand.startsWith("BinaryOptions")) {
    return (
      <span className={`inline-flex items-baseline gap-1 font-black tracking-tight ${sizeClass} ${className}`}>
        <span className="text-white">Binary</span>
        <span className={limeCls}>KE</span>
        <span className="sr-only">{brand}</span>
      </span>
    );
  }
  // AlphaOptionsKE: "Alpha" in gold, "OptionsKE" in white
  if (brand === "AlphaOptionsKE") {
    return (
      <span className={`inline-flex items-baseline gap-0 font-black tracking-tight ${sizeClass} ${className}`}>
        <span className="text-[#fbbf24]">Alpha</span>
        <span className="text-white">OptionsKE</span>
        <span className="sr-only">{brand}</span>
      </span>
    );
  }
  // Other binary brands: "Binary" portion in lime, rest in white
  const idx = brand.toLowerCase().indexOf("binary");
  if (idx === -1) {
    return (
      <span className={`inline-flex items-baseline gap-1 font-black tracking-tight ${sizeClass} ${className}`}>
        <span className={limeCls}>{brand}</span>
      </span>
    );
  }
  const before = brand.slice(0, idx);
  const binaryPart = brand.slice(idx, idx + 6);
  const after = brand.slice(idx + 6);
  return (
    <span className={`inline-flex items-baseline gap-0 font-black tracking-tight ${sizeClass} ${className}`}>
      {before ? <span className="text-white">{before}</span> : null}
      <span className={limeCls}>{binaryPart}</span>
      {after ? <span className="text-white">{after}</span> : null}
      <span className="sr-only">{brand}</span>
    </span>
  );
}

export function BrandLogo({ href, size = "md", animated = false, className = "" }: BrandLogoProps) {
  const { surface, brand } = useSiteConfig();

  const content =
    surface === "binary" ? (
      renderBinaryLogo(brand, sizes[size].binary, className)
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
