/**
 * Shared transactional-email brand tokens.
 * Gated on PRODUCT_SURFACE so Binary brands get lime accents while Nezeem stays blue.
 */
import { isBinarySurface, surfaceBrand } from "@/lib/product-surface";

export type EmailTheme = {
  /** Primary accent — links, logo highlight */
  accent: string;
  /** CTA / primary button background */
  buttonBg: string;
  /** Text color on primary button */
  buttonText: string;
  /** Success / positive CTA (approved, completed, etc.) */
  success: string;
  /** Danger CTA (admin alerts) — same on both surfaces */
  danger: string;
  /** Short logo mark for the email header */
  logoHtml: string;
  /** Footer site label (hostname) */
  siteLabel: string;
  /** Display brand for copy */
  brand: string;
};

function binarySiteHostname(): string {
  try {
    const url = process.env["NEXT_PUBLIC_APP_URL"] || process.env["APP_URL"];
    if (url) return new URL(url).hostname;
  } catch { /* ignore */ }
  return "binaryoptionske.com";
}

function binaryBrand(): string {
  return surfaceBrand();
}

function binaryLogoHtml(): string {
  const b = binaryBrand();
  if (b === "BinaryOptionsKE") return `Binary<span style="color:#b8ff2a;">KE</span>`;
  // Default: split at "Binary" — prefix white, "Binary" + suffix lime
  const idx = b.indexOf("Binary");
  if (idx > 0) {
    const prefix = b.slice(0, idx);
    const rest = b.slice(idx);
    return `${prefix}<span style="color:#b8ff2a;">${rest}</span>`;
  }
  if (idx === 0) {
    return `Binary<span style="color:#b8ff2a;">${b.slice(6)}</span>`;
  }
  return `<span style="color:#b8ff2a;">${b}</span>`;
}

const NEZEEM: EmailTheme = {
  accent: "#1687ff",
  buttonBg: "#1687ff",
  buttonText: "#ffffff",
  success: "#05b957",
  danger: "#dc2626",
  logoHtml: `Ne<span style="color:#1687ff;">zeem</span>`,
  siteLabel: "nezeem.com",
  brand: "Nezeem",
};

function buildBinaryTheme(): EmailTheme {
  const brand = binaryBrand();
  return {
    accent: "#b8ff2a",
    buttonBg: "#b8ff2a",
    buttonText: "#0a0f00",
    success: "#b8ff2a",
    danger: "#dc2626",
    logoHtml: binaryLogoHtml(),
    siteLabel: binarySiteHostname(),
    brand,
  };
}

/** Theme for the current product surface (server-side Resend sends). */
export function emailTheme(): EmailTheme {
  if (isBinarySurface()) return buildBinaryTheme();
  return NEZEEM;
}
