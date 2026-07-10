export const balance = "$1,240.50";

export const navItems = [
  { href: "/dashboard", label: "Home", icon: "home" },
  { href: "/sports", label: "Sports", icon: "sports_soccer" },
  { href: "/sports?tab=live", label: "Live", icon: "sensors" },
  { href: "/p2p", label: "P2P", icon: "groups" },
  { href: "/predictions", label: "Predictions", icon: "online_prediction" },
  { href: "/binary", label: "Binary", icon: "analytics" },
  { href: "/forex", label: "Forex", icon: "currency_exchange" },
  { href: "/aviator", label: "Aviator", icon: "flight_takeoff" },
  { href: "/", label: "Promotions", icon: "campaign" },
];

export type MobileNavItem = {
  label: string;
  icon: string;
  href?: string;
  // Section-native tabs (e.g. binary) that all live on one route but open
  // different in-page panels via a `?panel=` query param. `panel: ""` is the
  // base view (no param). When set, the active state keys off the panel value
  // instead of the path, so sibling tabs on the same route don't all light up.
  panel?: string;
  // Path used for active-state matching when it differs from `href` (e.g. a tab
  // whose href carries a query string). Defaults to href's pathname.
  activePath?: string;
  // Section tabs that share one route but switch via `?tab=` (e.g. Sports / Live).
  // When set, active state keys off the tab value so sibling tabs don't all light up.
  tab?: string;
  // In-app action instead of navigation (e.g. open the floating wallet sheet).
  action?: "wallet" | "profile";
};

// Default cross-product switcher — shown on the dashboard and any section that
// doesn't define its own native nav. `Menu` opens the full platform drawer.
export const mobileNav: MobileNavItem[] = [
  { label: "Menu", icon: "menu" },
  { href: "/sports", label: "Sports", icon: "sports_soccer" },
  { href: "/aviator", label: "Aviator", icon: "rocket_launch" },
  { href: "/p2p", label: "P2P", icon: "swap_horiz" },
  { href: "/binary", label: "Binary", icon: "candlestick_chart" },
];

// Binary is a destination in itself (Deriv-style): users who come only for
// digits get a self-contained Markets / Trade / Positions surface, with Menu as
// the constant escape hatch back to the rest of the platform. The first three
// stay on /binary and toggle in-page panels via `?panel=`.
export const binaryMobileNav: MobileNavItem[] = [
  { label: "Menu", icon: "menu" },
  { href: "/binary?panel=markets",   label: "Markets",   icon: "candlestick_chart", panel: "markets",   activePath: "/binary" },
  { href: "/binary",                 label: "Trade",     icon: "show_chart",        panel: "",          activePath: "/binary" },
  { href: "/binary?panel=positions", label: "Positions", icon: "schedule",          panel: "positions", activePath: "/binary" },
];

// Forex is its own destination too — same self-contained shape as binary
// (Markets pair-picker / Trade / Positions), Menu as the constant escape hatch.
// Wallet lives in the header chip; Discover is secondary (from Markets sheet).
export const forexMobileNav: MobileNavItem[] = [
  { label: "Menu", icon: "menu" },
  { href: "/forex?panel=markets",   label: "Markets",   icon: "candlestick_chart", panel: "markets",   activePath: "/forex" },
  { href: "/forex",                 label: "Trade",     icon: "show_chart",        panel: "",          activePath: "/forex" },
  { href: "/forex?panel=positions", label: "Positions", icon: "schedule",          panel: "positions", activePath: "/forex" },
];

// Sports is its own destination: Sports / Live / My Bets, with Menu as the
// escape hatch. My Bets lives on /my-bets but keeps this same bottom nav so
// users don't fall back to the global Menu/Sports/Aviator/P2P/Binary bar.
export const sportsMobileNav: MobileNavItem[] = [
  { label: "Menu", icon: "menu" },
  { href: "/sports",            label: "Sports",  icon: "sports_soccer", activePath: "/sports", tab: "" },
  { href: "/sports?tab=live",   label: "Live",    icon: "sensors",       activePath: "/sports", tab: "live" },
  { href: "/my-bets",           label: "My Bets", icon: "receipt_long",  activePath: "/my-bets" },
];

// P2P marketplace bottom nav (Binance-style):
// Menu · P2P (browse) · Orders · Ads · Profile
export const p2pMobileNav: MobileNavItem[] = [
  { label: "Menu", icon: "menu" },
  { href: "/p2p", label: "P2P", icon: "home", activePath: "/p2p" },
  { href: "/p2p/orders", label: "Orders", icon: "receipt_long", activePath: "/p2p/orders" },
  { href: "/p2p/merchant?tab=ads", label: "Ads", icon: "campaign", activePath: "/p2p/merchant", tab: "ads" },
  { href: "/p2p/merchant?tab=profile", label: "Profile", icon: "person", activePath: "/p2p/merchant", tab: "profile" },
];

// Polymarket: Markets / Trending / My Bets — same 4-slot shape as Sports/P2P.
// Client reads `?tab=` and `?tag=` for in-page view.
export const predictionsMobileNav: MobileNavItem[] = [
  { label: "Menu", icon: "menu" },
  { href: "/polymarket",              label: "Markets",  icon: "online_prediction", activePath: "/polymarket", tab: "" },
  { href: "/polymarket?tab=trending", label: "Trending", icon: "local_fire_department", activePath: "/polymarket", tab: "trending" },
  { href: "/polymarket?tab=my-bets",  label: "My Bets",  icon: "receipt_long",      activePath: "/polymarket", tab: "my-bets" },
];

// Aviator: Play / Players / My Bets — stays inside the game; My Bets opens the
// in-page Mine list (not the sports /my-bets route).
export const aviatorMobileNav: MobileNavItem[] = [
  { label: "Menu", icon: "menu" },
  { href: "/aviator",            label: "Play",    icon: "rocket_launch", activePath: "/aviator", tab: "" },
  { href: "/aviator?tab=players", label: "Players", icon: "groups",        activePath: "/aviator", tab: "players" },
  { href: "/aviator?tab=mine",   label: "My Bets", icon: "receipt_long",  activePath: "/aviator", tab: "mine" },
];

// Resolve the bottom-nav tab set for the current route. Section-native navs win
// by path prefix; everything else falls back to the cross-product switcher.
export function getMobileNav(pathname: string): MobileNavItem[] {
  if (pathname.startsWith("/binary")) return binaryMobileNav;
  if (pathname.startsWith("/forex")) return forexMobileNav;
  // Sports My Bets is a sibling route — keep the sports bottom nav there.
  if (pathname.startsWith("/sports") || pathname.startsWith("/my-bets")) return sportsMobileNav;
  if (pathname.startsWith("/p2p")) return p2pMobileNav;
  if (pathname.startsWith("/polymarket") || pathname.startsWith("/predictions")) return predictionsMobileNav;
  if (pathname.startsWith("/aviator")) return aviatorMobileNav;
  return mobileNav;
}

export const productCards = [
  { href: "/sports", label: "Sports", icon: "sports_soccer" },
  { href: "/sports?tab=live", label: "Live", icon: "sensors" },
  { href: "/p2p", label: "P2P", icon: "groups" },
  { href: "/predictions", label: "Predictions", icon: "online_prediction" },
  { href: "/binary", label: "Binary", icon: "analytics" },
  { href: "/forex", label: "Forex", icon: "currency_exchange" },
  { href: "/aviator", label: "Aviator", icon: "flight_takeoff" },
];

export const liveEvents = [
  { league: "Premier League", time: "62'", home: "Arsenal", away: "Chelsea", score: "2 - 1", odds: ["1.45", "4.20", "6.50"], markets: "+124" },
  { league: "La Liga", time: "72'", home: "Barcelona", away: "Sevilla", score: "1 - 0", odds: ["1.62", "3.80", "5.40"], markets: "+98" },
  { league: "Serie A", time: "12'", home: "Juventus", away: "AC Milan", score: "0 - 0", odds: ["2.60", "3.00", "2.90"], markets: "+87" },
  { league: "NBA", time: "Q4", home: "Lakers", away: "Warriors", score: "89 - 94", odds: ["1.90", "1.90"], markets: "+42" },
];

export const p2pMerchants = [
  { name: "ExchangeKing", initial: "EX", verified: true, orders: "1,243", rate: "99.5%", price: "₦ 1,650.00", available: "4,500.00 USDT", limit: "₦ 50,000 - ₦ 2,000,000", methods: ["Bank Transfer", "Chipper Cash"] },
  { name: "FastTrader99", initial: "FT", verified: false, orders: "856", rate: "98.2%", price: "₦ 1,652.50", available: "1,200.50 USDT", limit: "₦ 20,000 - ₦ 900,000", methods: ["Bank Transfer", "Mobile Money"] },
  { name: "PrimeDesk", initial: "PD", verified: true, orders: "3,904", rate: "99.8%", price: "₦ 1,648.90", available: "9,870.00 USDT", limit: "₦ 100,000 - ₦ 5,000,000", methods: ["Bank Transfer", "Wise"] },
];

export const predictionMarkets = [
  { title: "Will Bitcoin hit $100k by Dec 31?", category: "Crypto", yes: 68, no: 32, volume: "$4.2M", closes: "Dec 31", icon: "currency_bitcoin" },
  { title: "US Presidential Election winner", category: "Politics", yes: 45, no: 42, volume: "$12.8M", closes: "Nov 5", icon: "account_balance" },
  { title: "Will Arsenal win the league?", category: "Sports", yes: 37, no: 63, volume: "$980K", closes: "May 19", icon: "sports_soccer" },
];

export const walletTransactions = [
  { title: "Bank Deposit", subtitle: "Today, 14:23", amount: "+ $1,240.50", status: "Completed", tone: "good", icon: "account_balance" },
  { title: "BTC Withdrawal", subtitle: "Yesterday, 09:15", amount: "- $500.00", status: "Processing", tone: "bad", icon: "currency_bitcoin" },
  { title: "Internal Transfer", subtitle: "Oct 24, 18:45", amount: "≈ $150.00", status: "Fiat to Crypto", tone: "neutral", icon: "sync_alt" },
];

export const aviatorHistory = ["1.24x", "2.45x", "1.02x", "12.50x", "1.89x", "4.20x", "1.11x", "8.75x"];
