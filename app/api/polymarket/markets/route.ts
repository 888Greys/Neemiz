import { fetchMarkets } from "@/lib/polymarket";

export const revalidate = 60;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const tag       = searchParams.get("tag")    ?? undefined;
  const limit     = parseInt(searchParams.get("limit")   ?? "20");
  const offset    = parseInt(searchParams.get("offset")  ?? "0");
  const order     = (searchParams.get("order") ?? "volume") as "volume" | "createdAt";
  const ascending = searchParams.get("ascending") === "true";

  const markets = await fetchMarkets({ limit: tag ? Math.max(limit, 100) : limit, offset, order, ascending });
  const filtered = tag
    ? markets.filter((m) => {
        const needle = tag.toLowerCase();
        return m.tags.some((t) => t.toLowerCase().includes(needle)) ||
          m.question.toLowerCase().includes(needle) ||
          m.description.toLowerCase().includes(needle);
      }).slice(0, limit)
    : markets;
  return Response.json(filtered);
}
