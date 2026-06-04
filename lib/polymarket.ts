const GAMMA_API = "https://gamma-api.polymarket.com";

export interface PolymarketMarket {
  id:            string;
  conditionId:   string;
  question:      string;
  description:   string;
  outcomes:      string[];   // ["Yes","No"]
  outcomePrices: number[];   // [0.65, 0.35]
  clobTokenIds:  string[];   // token IDs for CLOB price history
  volume:        number;
  liquidity:     number;
  endDate:       string;
  image:         string;
  active:        boolean;
  closed:        boolean;
  tags:          string[];
}

export type PolymarketResolution =
  | { status: "resolved"; winningOutcome: string; market: PolymarketMarket }
  | { status: "unresolved"; market: PolymarketMarket }
  | { status: "mismatch"; market: PolymarketMarket }
  | { status: "not_found" };

interface GammaMarket {
  id:            string;
  conditionId:   string;
  question:      string;
  description?:  string;
  outcomes:      string;   // JSON string
  outcomePrices: string;   // JSON string
  clobTokenIds?: string;   // JSON string of token IDs
  volume:        string;
  liquidity:     string;
  endDate:       string;
  image?:        string;
  active:        boolean;
  closed:        boolean;
  tags?:         Array<{ id: string; label: string }>;
}

function parseMarket(m: GammaMarket): PolymarketMarket {
  let outcomes:      string[] = [];
  let prices:        number[] = [];
  let clobTokenIds:  string[] = [];
  try { outcomes      = JSON.parse(m.outcomes);                      } catch { outcomes     = ["Yes", "No"]; }
  try { prices        = JSON.parse(m.outcomePrices).map(Number);     } catch { prices       = [0.5, 0.5]; }
  try { clobTokenIds  = JSON.parse(m.clobTokenIds ?? "[]");          } catch { clobTokenIds = []; }

  return {
    id:            m.id,
    conditionId:   m.conditionId,
    question:      m.question,
    description:   m.description ?? "",
    outcomes,
    outcomePrices: prices,
    clobTokenIds,
    volume:        parseFloat(m.volume ?? "0"),
    liquidity:     parseFloat(m.liquidity ?? "0"),
    endDate:       m.endDate,
    image:         m.image ?? "",
    active:        m.active,
    closed:        m.closed,
    tags:          (m.tags ?? []).map((t) => t.label),
  };
}

function isOpenMarket(m: PolymarketMarket) {
  const endTime = new Date(m.endDate).getTime();
  const hasEnded = Number.isFinite(endTime) && endTime <= Date.now();
  const isResolvedPrice = m.outcomePrices.some((p) => p <= 0.001 || p >= 0.999);
  return m.active && !m.closed && !hasEnded && !isResolvedPrice;
}

function normalizeQuestion(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function questionsMatch(a: string, b: string) {
  return normalizeQuestion(a) === normalizeQuestion(b);
}

function hasEnded(market: PolymarketMarket) {
  const endTime = new Date(market.endDate).getTime();
  return Number.isFinite(endTime) && endTime <= Date.now();
}

export async function fetchMarkets(params?: {
  limit?:     number;
  offset?:    number;
  tag?:       string;
  order?:     "volume" | "createdAt" | "startDate" | "endDate";
  ascending?: boolean;
}): Promise<PolymarketMarket[]> {
  const limit     = params?.limit     ?? 20;
  const fetchLimit = Math.max(limit, 100);
  const offset    = params?.offset    ?? 0;
  const order     = params?.order     ?? "volume";
  const ascending = params?.ascending ?? false;
  const url       = new URL(`${GAMMA_API}/markets`);
  url.searchParams.set("active",    "true");
  url.searchParams.set("closed",    "false");
  url.searchParams.set("limit",     String(fetchLimit));
  url.searchParams.set("offset",    String(offset));
  url.searchParams.set("order",     order);
  url.searchParams.set("ascending", String(ascending));
  if (params?.tag) url.searchParams.set("tag", params.tag);

  const res = await fetch(url.toString(), {
    next: { revalidate: 60 }, // cache for 60s
  });
  if (!res.ok) return [];
  const data: GammaMarket[] = await res.json();
  return data.map(parseMarket).filter(isOpenMarket).slice(0, limit);
}

export async function fetchMarket(
  conditionId: string,
  options?: { cache?: RequestCache; includeClosed?: boolean },
): Promise<PolymarketMarket | null> {
  const url = `${GAMMA_API}/markets?condition_ids=${encodeURIComponent(conditionId)}&limit=1`;
  const res = await fetch(url, options?.cache ? { cache: options.cache } : { next: { revalidate: 30 } });
  if (!res.ok) return null;
  const data: GammaMarket[] = await res.json();
  const rawMarket = data.find((m) => m.conditionId.toLowerCase() === conditionId.toLowerCase());
  if (!rawMarket) return null;

  const market = parseMarket(rawMarket);
  return options?.includeClosed || isOpenMarket(market) ? market : null;
}

export async function fetchResolutionDetail(
  conditionId: string,
  options?: { expectedQuestion?: string },
): Promise<PolymarketResolution> {
  const market = await fetchMarket(conditionId, { cache: "no-store", includeClosed: true });
  if (!market) return { status: "not_found" };
  if (options?.expectedQuestion && !questionsMatch(market.question, options.expectedQuestion)) {
    return { status: "mismatch", market };
  }

  // Gamma can lag flipping `closed` after the end time. When the event has
  // ended and a side is effectively 1.0, settle from the terminal price.
  if (!market.closed && !hasEnded(market)) return { status: "unresolved", market };
  const winIdx = market.outcomePrices.findIndex((p) => p >= 0.99);
  return winIdx >= 0
    ? { status: "resolved", winningOutcome: market.outcomes[winIdx], market }
    : { status: "unresolved", market };
}

/** Returns the resolved winning outcome string, or null if not resolved */
export async function fetchResolution(
  conditionId: string,
  options?: { expectedQuestion?: string },
): Promise<string | null> {
  const resolution = await fetchResolutionDetail(conditionId, options);
  return resolution.status === "resolved" ? resolution.winningOutcome : null;
}
