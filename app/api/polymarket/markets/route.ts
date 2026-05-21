import { fetchMarkets } from "@/lib/polymarket";

export const revalidate = 60;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const tag    = searchParams.get("tag")    ?? undefined;
  const limit  = parseInt(searchParams.get("limit")  ?? "20");
  const offset = parseInt(searchParams.get("offset") ?? "0");

  const markets = await fetchMarkets({ limit, offset, tag });
  return Response.json(markets);
}
