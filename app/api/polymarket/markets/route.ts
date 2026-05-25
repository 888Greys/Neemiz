import { fetchMarkets } from "@/lib/polymarket";

export const revalidate = 60;

// Expanded keyword sets for tags whose label doesn't appear in market text
const TAG_ALIASES: Record<string, string[]> = {
  crypto: [
    "crypto", "cryptocurrency", "bitcoin", "ethereum", "monero", "solana",
    "ripple", "cardano", "dogecoin", "defi", "blockchain", "btc", "eth",
    "xmr", "sol", "xrp", "ada", "bnb", "usdt", "usdc", "altcoin", "token",
    "nft", "web3", "stablecoin", "halving", "mining",
  ],
  sports: ["sport", "nba", "nfl", "soccer", "football", "basketball", "tennis", "mls", "ufc", "olympic"],
  politics: ["politic", "election", "president", "senator", "congress", "vote", "democrat", "republican", "trump", "biden"],
  esports: ["esport", "gaming", "league of legends", "dota", "csgo", "valorant", "fortnite", "tournament"],
};

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const tag       = searchParams.get("tag")    ?? undefined;
  const limit     = parseInt(searchParams.get("limit")   ?? "20");
  const offset    = parseInt(searchParams.get("offset")  ?? "0");
  const order     = (searchParams.get("order") ?? "volume") as "volume" | "createdAt";
  const ascending = searchParams.get("ascending") === "true";

  const markets = await fetchMarkets({ limit: tag ? Math.max(limit, 200) : limit, offset, order, ascending });

  const filtered = tag
    ? markets.filter((m) => {
        const needles = TAG_ALIASES[tag.toLowerCase()] ?? [tag.toLowerCase()];
        const haystack = [
          ...m.tags.map((t) => t.toLowerCase()),
          m.question.toLowerCase(),
          m.description.toLowerCase(),
        ].join(" ");
        return needles.some((n) => haystack.includes(n));
      }).slice(0, limit)
    : markets;

  return Response.json(filtered);
}
