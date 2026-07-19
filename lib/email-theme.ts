/**
 * Shared transactional-email brand tokens.
 * Gated on PRODUCT_SURFACE so BinaryOptionsKE gets lime accents while Nezeem stays blue.
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

const BINARY: EmailTheme = {
  accent: "#b8ff2a",
  buttonBg: "#b8ff2a",
  buttonText: "#0a0f00",
  success: "#b8ff2a",
  danger: "#dc2626",
  logoHtml: `Binary<span style="color:#b8ff2a;">KE</span>`,
  siteLabel: "binaryoptionske.com",
  brand: "BinaryOptionsKE",
};

/** Theme for the current product surface (server-side Resend sends). */
export function emailTheme(): EmailTheme {
  if (isBinarySurface()) {
    return {
      ...BINARY,
      brand: surfaceBrand() || BINARY.brand,
    };
  }
  return NEZEEM;
}
