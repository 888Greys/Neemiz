/**
 * Product surface — lets one Next.js image serve Nezeem (full casino) OR a
 * Binary-only brand (binaryoptionske.com) with a separate DATABASE_URL.
 *
 * Least-overload architecture:
 *   • same Postgres host, separate database (wallets never mix)
 *   • same self-hosted Supabase Auth/Kong (no second Auth stack)
 *   • second app container only (no second Supabase compose)
 *
 * Set PRODUCT_SURFACE=binary on the Binary container.
 */

export type ProductSurface = "full" | "binary";

export function productSurface(): ProductSurface {
  // Prefer public flag so client shells (nav) match the server container.
  const raw = (
    process.env.NEXT_PUBLIC_PRODUCT_SURFACE ??
    process.env.PRODUCT_SURFACE ??
    "full"
  )
    .trim()
    .toLowerCase();
  return raw === "binary" ? "binary" : "full";
}

export function isBinarySurface(): boolean {
  return productSurface() === "binary";
}

/** Brand shown in UI / emails when PRODUCT_SURFACE=binary. */
export function surfaceBrand(): string {
  if (isBinarySurface()) {
    return (process.env.NEXT_PUBLIC_BRAND_NAME ?? "BinaryOptionsKE").trim() || "BinaryOptionsKE";
  }
  return "Nezeem";
}

/**
 * Paths allowed on the Binary-only surface. Everything else → /binary.
 * Keep wallet + Lipa + auth + binary APIs + health/cron.
 */
export function isBinaryAllowedPath(pathname: string): boolean {
  if (pathname === "/" || pathname === "") return true;
  const allow = [
    "/binary",
    "/wallet",
    "/profile",
    "/login",
    "/sign-in",
    "/sign-up",
    "/sso-callback",
    "/auth",
    "/2fa",
    "/suspended",
    "/api/binary",
    "/api/wallet",
    "/api/webhooks",
    "/api/account",
    "/api/auth",
    "/api/cron",
    "/api/health",
    "/api/notifications",
    "/_next",
    "/favicon",
    "/icon",
    "/apple-icon",
    "/manifest",
    "/robots",
    "/sitemap",
  ];
  return allow.some((p) => pathname === p || pathname.startsWith(p + "/"));
}
