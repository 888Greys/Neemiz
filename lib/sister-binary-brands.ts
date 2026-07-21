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
    id: "quickbinaryke",
    name: "QuickBinary",
    // Placeholder domain until the real one is registered — swap everywhere
    // (see AGENT.md "QuickBinary domain plug-in").
    domain: "quickbinaryke.com",
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
