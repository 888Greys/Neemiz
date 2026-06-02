import { getSpotRate } from "@/lib/p2p/spot";

export const runtime = "nodejs";

// GET /api/p2p/spot?crypto=USDT&fiat=KES — live market price of 1 crypto in fiat.
export async function GET(req: Request) {
  const url    = new URL(req.url);
  const crypto = url.searchParams.get("crypto") ?? "";
  const fiat   = url.searchParams.get("fiat") ?? "";
  const rate   = await getSpotRate(crypto, fiat);
  return Response.json(
    { crypto, fiat, rate },
    { headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=600" } },
  );
}
