import { detectCountryFromHeaders, WORLD_BY_CODE } from "@/lib/payments/world-countries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * IP/edge geo → country for wallet deposit market preselect.
 * GET /api/geo/country → { countryCode, currency, name } | { countryCode: null }
 */
export async function GET(req: Request) {
  const countryCode = detectCountryFromHeaders((name) => req.headers.get(name));
  if (!countryCode) {
    return Response.json({ countryCode: null, currency: null, name: null, source: null });
  }
  const country = WORLD_BY_CODE[countryCode];
  return Response.json({
    countryCode,
    currency: country.currency,
    name: country.name,
    source: "ip",
  });
}
