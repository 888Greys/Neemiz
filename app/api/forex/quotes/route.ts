import { NextResponse } from "next/server";

const PAIRS = [
  { symbol: "EUR/USD", base: "EUR", quote: "USD", name: "Euro / US Dollar", precision: 5 },
  { symbol: "GBP/USD", base: "GBP", quote: "USD", name: "British Pound / US Dollar", precision: 5 },
  { symbol: "USD/JPY", base: "USD", quote: "JPY", name: "US Dollar / Japanese Yen", precision: 3 },
  { symbol: "USD/CHF", base: "USD", quote: "CHF", name: "US Dollar / Swiss Franc", precision: 5 },
  { symbol: "AUD/USD", base: "AUD", quote: "USD", name: "Australian Dollar / US Dollar", precision: 5 },
  { symbol: "USD/CAD", base: "USD", quote: "CAD", name: "US Dollar / Canadian Dollar", precision: 5 },
  { symbol: "NZD/USD", base: "NZD", quote: "USD", name: "New Zealand Dollar / US Dollar", precision: 5 },
  { symbol: "EUR/GBP", base: "EUR", quote: "GBP", name: "Euro / British Pound", precision: 5 },
] as const;

type FrankfurterRate = {
  date: string;
  base: string;
  quote: string;
  rate: number;
};

const PROVIDER = "https://api.frankfurter.dev/v2";

function dateDaysAgo(days: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

async function fetchJson<T>(url: string) {
  const response = await fetch(url, {
    next: { revalidate: 300 },
    headers: { accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`Frankfurter request failed with ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const selectedSymbol = searchParams.get("symbol") ?? "EUR/USD";
  const selected = PAIRS.find((pair) => pair.symbol === selectedSymbol) ?? PAIRS[0];
  const grouped = new Map<string, Set<string>>();

  for (const pair of PAIRS) {
    if (!grouped.has(pair.base)) grouped.set(pair.base, new Set());
    grouped.get(pair.base)?.add(pair.quote);
  }

  try {
    const latestResponses = await Promise.all(
      Array.from(grouped.entries()).map(async ([base, quotes]) => {
        const symbols = Array.from(quotes).join(",");
        const data = await fetchJson<FrankfurterRate[]>(`${PROVIDER}/rates?base=${base}&quotes=${symbols}`);
        return { base, data };
      }),
    );

    const latestByBase = new Map(latestResponses.map((item) => [item.base, item.data]));
    const quotes = PAIRS.map((pair) => {
      const latest = latestByBase.get(pair.base);
      const rate = latest?.find((item) => item.quote === pair.quote);
      if (!rate) return null;

      return {
        symbol: pair.symbol,
        name: pair.name,
        base: pair.base,
        quote: pair.quote,
        price: rate.rate,
        date: rate.date,
        precision: pair.precision,
      };
    }).filter(Boolean);

    const latest = latestByBase.get(selected.base);
    const selectedRate = latest?.find((item) => item.quote === selected.quote);
    const selectedPrice = selectedRate?.rate;

    if (!selectedPrice) {
      return NextResponse.json({ error: "Selected pair is unavailable" }, { status: 404 });
    }

    const historyStart = dateDaysAgo(42);
    const history = await fetchJson<FrankfurterRate[]>(
      `${PROVIDER}/rates?from=${historyStart}&base=${selected.base}&quotes=${selected.quote}`,
    );

    const candles = history.map((item) => ({ date: item.date, close: item.rate }));

    const previous = candles.length > 1 ? candles[candles.length - 2].close : selectedPrice;
    const dayChange = selectedPrice - previous;
    const dayChangePct = previous ? (dayChange / previous) * 100 : 0;

    return NextResponse.json({
      provider: "Frankfurter",
      providerUrl: "https://frankfurter.dev",
      updatedAt: new Date().toISOString(),
      selected: {
        symbol: selected.symbol,
        name: selected.name,
        base: selected.base,
        quote: selected.quote,
        price: selectedPrice,
        date: selectedRate.date,
        precision: selected.precision,
        dayChange,
        dayChangePct,
      },
      quotes,
      candles,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load forex quotes";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
