/** Recently visited product routes for sidebar / mobile menu. */

export type NavRecent = {
  href: string;
  label: string;
  icon: string;
};

const STORAGE_KEY = "nezeem-nav-recents";
const MAX = 6;

const ROUTE_META: Array<{ match: (path: string) => boolean; href: string; label: string; icon: string }> = [
  { match: (p) => p === "/dashboard" || p === "/", href: "/dashboard", label: "Home", icon: "home" },
  { match: (p) => p.startsWith("/sports"), href: "/sports", label: "Sports", icon: "sports_soccer" },
  { match: (p) => p.startsWith("/my-bets"), href: "/my-bets", label: "My Bets", icon: "receipt_long" },
  { match: (p) => p.startsWith("/aviator"), href: "/aviator", label: "Aviator", icon: "rocket_launch" },
  { match: (p) => p.startsWith("/lucky-spin"), href: "/lucky-spin", label: "Lucky Spin", icon: "casino" },
  { match: (p) => p.startsWith("/polymarket") || p.startsWith("/predictions"), href: "/polymarket", label: "Polymarket", icon: "online_prediction" },
  { match: (p) => p === "/p2p" || p.startsWith("/p2p/express"), href: "/p2p", label: "P2P", icon: "swap_horiz" },
  { match: (p) => p.startsWith("/p2p/merchant"), href: "/p2p/merchant?tab=ads", label: "Ads", icon: "campaign" },
  { match: (p) => p.startsWith("/p2p/orders") || p.startsWith("/p2p/order"), href: "/p2p/orders", label: "Orders", icon: "receipt_long" },
  { match: (p) => p.startsWith("/binary"), href: "/binary", label: "Binary", icon: "candlestick_chart" },
  { match: (p) => p.startsWith("/forex"), href: "/forex", label: "Forex", icon: "currency_exchange" },
];

const IGNORE = [/^\/login/, /^\/2fa/, /^\/dev-login/, /^\/admin/, /^\/api/];

function resolveMeta(pathname: string): NavRecent | null {
  if (IGNORE.some((re) => re.test(pathname))) return null;
  const hit = ROUTE_META.find((r) => r.match(pathname));
  return hit ? { href: hit.href, label: hit.label, icon: hit.icon } : null;
}

export function readNavRecents(): NavRecent[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as NavRecent[];
    return Array.isArray(parsed) ? parsed.filter((x) => x?.href && x?.label && x?.icon).slice(0, MAX) : [];
  } catch {
    return [];
  }
}

export function trackNavRecent(pathname: string): NavRecent[] {
  const meta = resolveMeta(pathname);
  if (!meta) return readNavRecents();
  const prev = readNavRecents().filter((r) => r.href !== meta.href);
  const next = [meta, ...prev].slice(0, MAX);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore quota */
  }
  return next;
}
