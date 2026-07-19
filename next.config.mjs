import { withSentryConfig } from "@sentry/nextjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Emit a minimal self-contained server (.next/standalone) so the runtime
  // image ships only traced deps instead of the full node_modules (~6x smaller).
  output: "standalone",
  // Keep visited/prefetched routes warm in the client router cache so going
  // back to a page is instant with no extra server request (self-hosted: this
  // both improves perceived nav speed and reduces request amplification).
  experimental: {
    staleTimes: { dynamic: 30, static: 180 },
  },
  async headers() {
    // In dev the server is plain http (incl. LAN access from a phone), so
    // `upgrade-insecure-requests` + HSTS would force asset requests to https
    // and break every stylesheet/script. Only harden these in production.
    const isProd = process.env.NODE_ENV === "production";
    const cspDirectives = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' https: wss:" + (isProd ? "" : " http: ws:"),
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
      ...(isProd ? ["upgrade-insecure-requests"] : []),
    ];
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options",        value: "DENY" },
          { key: "X-Content-Type-Options",  value: "nosniff" },
          { key: "Referrer-Policy",         value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy",      value: "camera=(), microphone=(), geolocation=()" },
          {
            // Pragmatic CSP: hardens the high-value directives (clickjacking,
            // base-tag hijack, plugin/object injection, mixed content) without
            // breaking Next.js' inline hydration scripts or Sentry. script/style
            // stay 'unsafe-inline' because the App Router inlines them; the win
            // here is frame-ancestors/base-uri/object-src, not script locking.
            key: "Content-Security-Policy",
            value: cspDirectives.join("; "),
          },
          ...(isProd
            ? [{
                key:   "Strict-Transport-Security",
                value: "max-age=63072000; includeSubDomains; preload",
              }]
            : []),
        ],
      },
    ];
  },
  async redirects() {
    // The redesigned console (/admin/new/*) is now the only admin UI. Every
    // legacy /admin/* screen forwards to its counterpart so bookmarks and the
    // in-app links that still point at the old paths keep working. The old
    // pages + AdminShell remain in the tree but are unreachable — deleting them
    // is a separate cleanup. Kept temporary (307) until that lands.
    //
    // NOT redirected: /admin/2fa (the gate itself) and /admin/new/* (the target).
    const legacyAdmin = ["p2p", "players", "money", "crypto", "risk", "ops", "withdrawals", "broadcast"]
      .map((s) => ({ source: `/admin/${s}`, destination: `/admin/new/${s}`, permanent: false }));

    // Do NOT redirect "/" here. One image serves Nezeem + BinaryKE; "/" is
    // handled at runtime in app/page.tsx (Nezeem → /dashboard, Binary guests →
    // marketing landing, Binary signed-in → /binary). A config redirect would
    // bake into routes-manifest and skip the page on every host.
    return [
      { source: "/admin", destination: "/admin/new", permanent: false },
      ...legacyAdmin,
      { source: "/admin/markets/:key", destination: "/admin/new/markets/:key", permanent: false },
      { source: "/admin/users/:id", destination: "/admin/new/users/:id", permanent: false },
      // These two were already redirect stubs to tabs on other screens; point
      // them at the same tabs on the new console rather than through the old one.
      { source: "/admin/profits", destination: "/admin/new/money?tab=pnl", permanent: false },
      { source: "/admin/users", destination: "/admin/new/players?tab=directory", permanent: false },
    ];
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "cdn.sportmonks.com" },
      { protocol: "https", hostname: "**.sportmonks.com" },
      { protocol: "https", hostname: "flagcdn.com" },
      { protocol: "https", hostname: "v3.bundlecdn.com" },
      { protocol: "https", hostname: "cdn.worldvectorlogo.com" },
      { protocol: "https", hostname: "pub-5677b2f8e2e544688a1b6e1d1071f970.r2.dev" },
      { protocol: "https", hostname: "media.api-sports.io" },
      { protocol: "https", hostname: "a.espncdn.com" },
      { protocol: "https", hostname: "r2.thesportsdb.com" },
      { protocol: "https", hostname: "www.thesportsdb.com" },
    ],
  },
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG ?? "pompompurine",
  project: process.env.SENTRY_PROJECT ?? "nezeem",
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  widenClientFileUpload: true,
  sourcemaps: {
    disable: !process.env.SENTRY_AUTH_TOKEN,
  },
  webpack: {
    treeshake: {
      removeDebugLogging: true,
    },
  },
});
