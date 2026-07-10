/**
 * Public company / legal details for Nezeem (operated by Alamonet Connections Ltd).
 * Sourced from Kenyan Companies Registry docs (PVT-PQ1AKV39) in Desktop/neznew.
 */
export const COMPANY = {
  brand: "Nezeem",
  legalName: "Alamonet Connections Ltd",
  companyNumber: "PVT-PQ1AKV39",
  kraPin: "P052514106T",
  incorporated: "17 February 2026",
  /** Registered office (public) — not the director's residential address. */
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
