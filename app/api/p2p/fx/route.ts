import { getFxRatesToKES } from "@/lib/p2p/fx";

export const runtime = "nodejs";

// GET /api/p2p/fx — FX rates (KES per 1 unit) for converting multi-currency
// listings into a single base total. Cached at the edge for an hour.
export async function GET() {
  const rates = await getFxRatesToKES();
  return Response.json(rates, {
    headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
  });
}
