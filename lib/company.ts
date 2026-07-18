/**
 * Public company / legal details.
 * Binary-only surfaces (PRODUCT_SURFACE=binary) override brand/support via env
 * so binaryoptionske.com never shows Nezeem chrome.
 */
import { isBinarySurface, surfaceBrand } from "@/lib/product-surface";

const NEZEEM = {
  brand: "Nezeem",
  legalName: "Alamonet Connections Ltd",
  companyNumber: "PVT-PQ1AKV39",
  kraPin: "P052514106T",
  incorporated: "17 February 2026",
  registeredOffice: {
    building: "KCB Building, Room 3",
    street: "Tembo Road",
    locality: "Nyeri Town",
    county: "Nyeri",
    country: "Kenya",
    postal: "P.O. Box 100 – 10100, Nyeri",
  },
  emails: {
    business: "business@nezeem.com",
    partners: "partners@nezeem.com",
    support: "support@nezeem.com",
  },
  social: {
    telegram: "https://t.me/nezeemofficial",
  },
} as const;

function binaryCompany() {
  const brand = surfaceBrand();
  const support = (process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? `support@binaryoptionske.com`).trim();
  return {
    brand,
    legalName: (process.env.NEXT_PUBLIC_LEGAL_NAME ?? brand).trim() || brand,
    companyNumber: process.env.NEXT_PUBLIC_COMPANY_NUMBER ?? "",
    kraPin: process.env.NEXT_PUBLIC_KRA_PIN ?? "",
    incorporated: process.env.NEXT_PUBLIC_INCORPORATED ?? "",
    registeredOffice: {
      building: "",
      street: "",
      locality: "",
      county: "",
      country: "Kenya",
      postal: "",
    },
    emails: {
      business: support,
      partners: support,
      support,
    },
    social: {
      telegram: process.env.NEXT_PUBLIC_TELEGRAM_URL ?? "",
    },
  } as const;
}

export const COMPANY = isBinarySurface() ? binaryCompany() : NEZEEM;

export function companyAddressLines(): string[] {
  const o = COMPANY.registeredOffice;
  return [
    o.building,
    o.street,
    `${o.locality}, ${o.county}`,
    o.country,
    o.postal,
  ];
}

export function companyAddressOneLine(): string {
  const o = COMPANY.registeredOffice;
  return `${o.building}, ${o.street}, ${o.locality}, ${o.county}, ${o.country}`;
}
