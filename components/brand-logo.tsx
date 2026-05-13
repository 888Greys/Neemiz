import Link from "next/link";

type BrandLogoProps = {
  href?: string;
  size?: "sm" | "md" | "lg";
  animated?: boolean;
  className?: string;
};

const sizes = {
  sm: "text-2xl",
  md: "text-3xl",
  lg: "text-5xl md:text-7xl",
};

export function BrandLogo({ href, size = "md", animated = false, className = "" }: BrandLogoProps) {
  const content = (
    <span className={`inline-flex items-baseline font-black tracking-tight ${sizes[size]} ${className}`}>
      <span className="text-white">Ne</span>
      <span className={animated ? "animate-zeem text-primary" : "text-primary"}>zeem</span>
    </span>
  );

  if (!href) return content;

  return (
    <Link href={href} aria-label="Nezeem home">
      {content}
    </Link>
  );
}
