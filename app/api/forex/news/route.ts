/**
 * GET /api/forex/news — live FX / markets headlines from public RSS (no API key).
 * Sources: Reuters Business, CNBC Markets, Investing.com forex (best-effort).
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type NewsItem = {
  id: string;
  title: string;
  link: string;
  source: string;
  publishedAt: string | null;
  summary: string | null;
};

const FEEDS: Array<{ source: string; url: string }> = [
  { source: "Reuters", url: "https://feeds.reuters.com/reuters/businessNews" },
  { source: "CNBC", url: "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=10000664" },
  { source: "Investing.com", url: "https://www.investing.com/rss/news_1.rss" },
];

function stripTags(html: string): string {
  return html
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function pick(tag: string, block: string): string | null {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i");
  const m = block.match(re);
  return m ? stripTags(m[1]) : null;
}

function pickLink(block: string): string | null {
  const enclosed = pick("link", block);
  if (enclosed && /^https?:\/\//i.test(enclosed)) return enclosed;
  const href = block.match(/<link[^>]+href=["']([^"']+)["']/i);
  if (href?.[1]) return href[1];
  return enclosed;
}

function parseRss(xml: string, source: string): NewsItem[] {
  const items: NewsItem[] = [];
  const chunks = xml.split(/<item[\s>]/i).slice(1);
  for (const chunk of chunks) {
    const block = chunk.split(/<\/item>/i)[0] ?? "";
    const title = pick("title", block);
    const link = pickLink(block);
    if (!title || !link) continue;
    const publishedAt = pick("pubDate", block) || pick("published", block);
    const summary = pick("description", block) || pick("summary", block);
    items.push({
      id: `${source}-${link}`,
      title,
      link,
      source,
      publishedAt,
      summary: summary ? summary.slice(0, 180) : null,
    });
  }
  return items;
}

async function fetchFeed(feed: { source: string; url: string }): Promise<NewsItem[]> {
  try {
    const res = await fetch(feed.url, {
      headers: {
        "User-Agent": "NezeemForexDiscover/1.0 (+https://nezeem.com)",
        Accept: "application/rss+xml, application/xml, text/xml, */*",
      },
      next: { revalidate: 300 },
    });
    if (!res.ok) return [];
    const xml = await res.text();
    return parseRss(xml, feed.source).slice(0, 12);
  } catch {
    return [];
  }
}

export async function GET() {
  const batches = await Promise.all(FEEDS.map(fetchFeed));
  const seen = new Set<string>();
  const merged: NewsItem[] = [];
  for (const batch of batches) {
    for (const item of batch) {
      const key = item.title.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(item);
    }
  }

  // Prefer fresher items when pubDate parses.
  merged.sort((a, b) => {
    const ta = a.publishedAt ? Date.parse(a.publishedAt) : 0;
    const tb = b.publishedAt ? Date.parse(b.publishedAt) : 0;
    return tb - ta;
  });

  return Response.json(
    { items: merged.slice(0, 24), updatedAt: new Date().toISOString() },
    { headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=600" } },
  );
}
