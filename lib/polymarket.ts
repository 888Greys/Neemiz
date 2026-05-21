const GAMMA_API = "https://gamma-api.polymarket.com";

export interface PolymarketMarket {
  id:            string;
  conditionId:   string;
  question:      string;
  description:   string;
  outcomes:      string[];   // ["Yes","No"]
  outcomePrices: number[];   // [0.65, 0.35]
  volume:        number;
  liquidity:     number;
  endDate:       string;
  image:         string;
  active:        boolean;
  closed:        boolean;
  tags:          string[];
}

interface GammaMarket {
  id:            string;
  conditionId:   string;
  question:      string;
  description?:  string;
  outcomes:      string;   // JSON string
  outcomePrices: string;   // JSON string
  volume:        string;
  liquidity:     string;
  endDate:       string;
  image?:        string;
  active:        boolean;
  closed:        boolean;
  tags?:         Array<{ id: string; label: string }>;
}

function parseMarket(m: GammaMarket): PolymarketMarket {
  let outcomes: string[] = [];
  let prices:   number[] = [];
  try { outcomes = JSON.parse(m.outcomes);      } catch { outcomes = ["Yes", "No"]; }
  try { prices   = JSON.parse(m.outcomePrices).map(Number); } catch { prices = [0.5, 0.5]; }

  return {
    id:            m.id,
    conditionId:   m.conditionId,
    question:      m.question,
    description:   m.description ?? "",
    outcomes,
    outcomePrices: prices,
    volume:        parseFloat(m.volume ?? "0"),
    liquidity:     parseFloat(m.liquidity ?? "0"),
    endDate:       m.endDate,
    image:         m.image ?? "",
    active:        m.active,
    closed:        m.closed,
    tags:          (m.tags ?? []).map((t) => t.label),
  };
}

export async function fetchMarkets(params?: {
  limit?:    number;
  offset?:   number;
  tag?:      string;
}): Promise<PolymarketMarket[]> {
  const limit  = params?.limit  ?? 20;
  const offset = params?.offset ?? 0;
  const url    = new URL(`${GAMMA_API}/markets`);
  url.searchParams.set("active", "true");
  url.searchParams.set("closed", "false");
  url.searchParams.set("limit",  String(limit));
  url.searchParams.set("offset", String(offset));
  url.searchParams.set("order",  "volume");
  url.searchParams.set("ascending", "false");
  if (params?.tag) url.searchParams.set("tag", params.tag);

  const res = await fetch(url.toString(), {
    next: { revalidate: 60 }, // cache for 60s
  });
  if (!res.ok) return [];
  const data: GammaMarket[] = await res.json();
  return data.map(parseMarket);
}

export async function fetchMarket(conditionId: string): Promise<PolymarketMarket | null> {
  const res = await fetch(`${GAMMA_API}/markets/${conditionId}`, {
    next: { revalidate: 30 },
  });
  if (!res.ok) return null;
  const data: GammaMarket = await res.json();
  return parseMarket(data);
}

/** Returns the resolved winning outcome string, or null if not resolved */
export async function fetchResolution(conditionId: string): Promise<string | null> {
  const market = await fetchMarket(conditionId);
  if (!market || !market.closed) return null;
  // When closed, the winning outcome has price = 1.0
  const winIdx = market.outcomePrices.findIndex((p) => p >= 0.99);
  return winIdx >= 0 ? market.outcomes[winIdx] : null;
}
