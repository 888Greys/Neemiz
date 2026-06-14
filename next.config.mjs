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
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options",        value: "DENY" },
          { key: "X-Content-Type-Options",  value: "nosniff" },
          { key: "Referrer-Policy",         value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy",      value: "camera=(), microphone=(), geolocation=()" },
          {
            key:   "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
    ];
  },
  async redirects() {
    return [
      {
        source: "/",
        destination: "/dashboard",
        permanent: false,
      },
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
    ],
  },
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG ?? "pompompurine",
  project: process.env.SENTRY_PROJECT ?? "nezeem",
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  widenClientFileUpload: true,
  tunnelRoute: "/monitoring",
  sourcemaps: {
    disable: !process.env.SENTRY_AUTH_TOKEN,
  },
  webpack: {
    treeshake: {
      removeDebugLogging: true,
    },
  },
});
