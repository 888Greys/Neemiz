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
  // Runtime PRODUCT_SURFACE wins so one GHCR image can serve both Nezeem and
  // BinaryKE. NEXT_PUBLIC_* is baked at build time and must not override the
  // container env (empty/full bake would pin every host to Nezeem).
  const runtime = process.env.PRODUCT_SURFACE?.trim().toLowerCase();
  if (runtime === "binary" || runtime === "full") return runtime;

  const pub = (process.env.NEXT_PUBLIC_PRODUCT_SURFACE ?? "full").trim().toLowerCase();
  return pub === "binary" ? "binary" : "full";
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
 * Synthetic email domain for phone+password accounts (Supabase has no SMS
 * provider). Keep brand-specific so Binary accounts never look like Nezeem.
 */
export function phoneAuthEmailDomain(): string {
  if (isBinarySurface()) {
    return (
      process.env.NEXT_PUBLIC_PHONE_EMAIL_DOMAIN?.trim() || "phone.binaryoptionske.com"
    );
  }
  return "phone.nezeem.com";
}

/** e.g. 2547… → 2547…@phone.binaryoptionske.com */
export function phoneAuthEmail(msisdnDigits: string): string {
  const digits = msisdnDigits.replace(/\D/g, "");
  return `${digits}@${phoneAuthEmailDomain()}`;
}

export function isPhoneAuthEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return (
    email.endsWith("@phone.nezeem.com") ||
    email.endsWith("@phone.binaryoptionske.com") ||
    (!!process.env.NEXT_PUBLIC_PHONE_EMAIL_DOMAIN &&
      email.endsWith(`@${process.env.NEXT_PUBLIC_PHONE_EMAIL_DOMAIN.trim()}`))
  );
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
    "/dashboard",
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
