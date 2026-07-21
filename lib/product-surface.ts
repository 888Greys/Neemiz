/**
 * Product surface — lets one Next.js image serve Nezeem (full casino) OR a
 * Binary-only brand (binaryoptionske.com, moneybinaryke.com, etc.) with a
 * separate DATABASE_URL.
 *
 * Least-overload architecture:
 *   • same Postgres host, separate database (wallets never mix)
 *   • same self-hosted Supabase Auth/Kong (no second Auth stack)
 *   • separate app containers (no second Supabase compose)
 *
 * Set PRODUCT_SURFACE=binary on the Binary container. Brand is derived from
 * NEXT_PUBLIC_BRAND_NAME / NEXT_PUBLIC_APP_URL.
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

export function binaryAppHostname(): string | null {
  const url = process.env["NEXT_PUBLIC_APP_URL"] || process.env["APP_URL"];
  if (!url) return null;
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function hostLooksBinary(host: string | null | undefined): boolean {
  if (!host) return false;
  const h = host.split(":")[0]?.toLowerCase() ?? "";
  // Nezeem hosts are NEVER the binary surface — this guard must win over any
  // env-derived hostname matching.
  if (h === "nezeem.com" || h.endsWith(".nezeem.com")) return false;
  // Legacy: detect any known binary domain as fallback. Do NOT match
  // binaryAppHostname() (NEXT_PUBLIC_APP_URL) here: on Nezeem containers that
  // env IS a nezeem.com host, which flipped www.nezeem.com + nez-test into the
  // binary gate on 2026-07-20 (/auth-email/* → /binary broke the GoTrue email
  // templates; /dashboard → /binary broke the Nezeem site). Binary containers
  // set PRODUCT_SURFACE=binary explicitly, which wins in productSurface().
  if (h === "binaryoptionske.com" || h.endsWith(".binaryoptionske.com")) return true;
  if (h === "moneybinaryke.com" || h.endsWith(".moneybinaryke.com")) return true;
  if (h === "binarymarket.org" || h.endsWith(".binarymarket.org")) return true;
  return false;
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
export function surfaceBrand(opts?: ProductSurfaceOpts): string {
  if (isBinarySurface(opts)) {
    return (process.env["NEXT_PUBLIC_BRAND_NAME"] ?? "BinaryOptionsKE").trim() || "BinaryOptionsKE";
  }
  return "Nezeem";
}

/**
 * Synthetic email domain for phone+password accounts (Supabase has no SMS
 * provider). Keep brand-specific so Binary accounts never look like Nezeem.
 */
export function phoneAuthEmailDomain(): string {
  const override = process.env["NEXT_PUBLIC_PHONE_EMAIL_DOMAIN"]?.trim();
  if (override) return override;

  if (isBinarySurface()) {
    const host = binaryAppHostname();
    if (host) return "phone." + host;
    return "phone.binaryoptionske.com";
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
  if (email.endsWith("@phone.nezeem.com")) return true;

  const override = process.env["NEXT_PUBLIC_PHONE_EMAIL_DOMAIN"]?.trim();
  if (override && email.endsWith(`@${override}`)) return true;

  const host = binaryAppHostname();
  if (host && email.endsWith(`@phone.${host}`)) return true;

  // Legacy: hardcoded binary brands
  if (
    email.endsWith("@phone.binaryoptionske.com")
    || email.endsWith("@phone.moneybinaryke.com")
    || email.endsWith("@phone.binarymarket.org")
  ) return true;

  return false;
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
    "/terms",
    "/privacy",
    "/api/binary",
    "/api/copy",
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

