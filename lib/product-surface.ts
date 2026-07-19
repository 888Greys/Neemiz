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

export type ProductSurfaceOpts = {
  /** Request Host / x-forwarded-host — belt-and-suspenders when env is wrong. */
  host?: string | null;
};

function envSurface(): string | undefined {
  // Bracket access avoids any bundler inlining of process.env.PRODUCT_SURFACE.
  const runtime = process.env["PRODUCT_SURFACE"]?.trim().toLowerCase();
  if (runtime === "binary" || runtime === "full") return runtime;

  const pub = process.env["NEXT_PUBLIC_PRODUCT_SURFACE"]?.trim().toLowerCase();
  if (pub === "binary" || pub === "full") return pub;
  return undefined;
}

function hostLooksBinary(host: string | null | undefined): boolean {
  if (!host) return false;
  const h = host.split(":")[0]?.toLowerCase() ?? "";
  return h === "binaryoptionske.com" || h.endsWith(".binaryoptionske.com");
}

export function productSurface(opts?: ProductSurfaceOpts): ProductSurface {
  // Runtime PRODUCT_SURFACE / NEXT_PUBLIC_* wins so one GHCR image can serve
  // both Nezeem and BinaryKE without a rebuild.
  const fromEnv = envSurface();
  if (fromEnv === "binary" || fromEnv === "full") return fromEnv;

  if (hostLooksBinary(opts?.host)) return "binary";

  return "full";
}

export function isBinarySurface(opts?: ProductSurfaceOpts): boolean {
  return productSurface(opts) === "binary";
}

/** Brand shown in UI / emails when PRODUCT_SURFACE=binary. */
export function surfaceBrand(): string {
  if (isBinarySurface()) {
    return (process.env["NEXT_PUBLIC_BRAND_NAME"] ?? "BinaryOptionsKE").trim() || "BinaryOptionsKE";
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
      process.env["NEXT_PUBLIC_PHONE_EMAIL_DOMAIN"]?.trim() || "phone.binaryoptionske.com"
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
    (!!process.env["NEXT_PUBLIC_PHONE_EMAIL_DOMAIN"] &&
      email.endsWith(`@${process.env["NEXT_PUBLIC_PHONE_EMAIL_DOMAIN"].trim()}`))
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
