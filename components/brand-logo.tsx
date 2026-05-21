import Link from "next/link";

type BrandLogoProps = {
  href?: string;
  size?: "sm" | "md" | "lg";
  animated?: boolean;
  className?: string;
};

const sizes = {
  sm: { wrapper: "text-2xl", script: "text-3xl" },
  md: { wrapper: "text-3xl", script: "text-4xl" },
  lg: { wrapper: "text-5xl md:text-7xl", script: "text-6xl md:text-8xl" },
};

export function BrandLogo({ href, size = "md", animated = false, className = "" }: BrandLogoProps) {
  const content = (
    <span className={`inline-flex items-baseline font-black tracking-tight ${sizes[size].wrapper} ${className}`}>
      {/* Cursive "n" matching the favicon icon */}
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
    <Link href={href} aria-label="Nezeem home">
      {content}
    </Link>
  );
}
