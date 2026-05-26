import { fetchMarket } from "@/lib/polymarket";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const conditionId = searchParams.get("conditionId");
  if (!conditionId) {
    return Response.json({ error: "conditionId is required" }, { status: 400 });
  }

  const market = await fetchMarket(conditionId);
  if (!market) {
    return Response.json({ error: "Market not found" }, { status: 404 });
  }

  return Response.json(market);
}
