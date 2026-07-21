/**
 * Sister binary-only brands tracked from Nezeem admin (`/admin/new/binary-ke`).
 * Four planned sites — fill name/domain as each goes live. Ops metrics load for
 * `live` brands whose <BRAND>_DATABASE_URL is set on the Nezeem runtime.
 */
export type SisterBinaryBrand = {
  id: string;
  name: string;
  /** Public hostname, no protocol */
  domain: string | null;
  status: "live" | "planned";
};

export const SISTER_BINARY_BRANDS: SisterBinaryBrand[] = [
  {
    id: "binaryoptionske",
    name: "BinaryOptionsKE",
    domain: "binaryoptionske.com",
    status: "live",
  },
  {
    id: "moneybinaryke",
    name: "MoneyBinary",
    domain: "moneybinaryke.com",
    status: "live",
  },
  {
    id: "binarymarket",
    name: "BinaryMarket",
    domain: "binarymarket.org",
    status: "live",
  },
  {
    id: "binary-site-4",
    name: "Binary site 4",
    domain: null,
    status: "planned",
  },
];

export function sisterBinarySiteUrl(brand: SisterBinaryBrand): string | null {
  if (!brand.domain) return null;
  return `https://${brand.domain.replace(/^https?:\/\//, "")}`;
}
