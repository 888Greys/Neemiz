# syntax=docker/dockerfile:1.7

FROM node:22-bookworm-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

FROM base AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
# Build version (git sha) — baked into the CLIENT bundle so a loaded page knows
# which build it came from and can detect when a newer one is deployed.
ARG GIT_SHA=dev
ENV NEXT_PUBLIC_BUILD_VERSION=${GIT_SHA}
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
# SENTRY_AUTH_TOKEN is passed as a BuildKit secret (never baked into the image)
# so withSentryConfig can upload source maps for de-minified stack traces.
RUN --mount=type=cache,target=/app/.next/cache \
    --mount=type=secret,id=sentry_auth_token \
    SENTRY_AUTH_TOKEN="$(cat /run/secrets/sentry_auth_token 2>/dev/null || true)" \
    npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV WEB_CONCURRENCY=2
# Same git sha at runtime so /api/version can report the server's build, which
# clients compare against their baked NEXT_PUBLIC_BUILD_VERSION.
ARG GIT_SHA=dev
ENV BUILD_VERSION=${GIT_SHA}

RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nextjs

# Next.js standalone server + its traced node_modules
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
# Static assets and public/ are NOT part of standalone — copy them explicitly
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/scripts/cluster-server.mjs ./cluster-server.mjs
# Prisma client + query engine — NFT tracing misses the engine binary, so copy it
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma/client ./node_modules/@prisma/client
# Sharp's JS package is traced, but its optional libvips package is not.
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@img/sharp-libvips-linux-x64 ./node_modules/@img/sharp-libvips-linux-x64

USER nextjs
EXPOSE 3000
CMD ["node", "cluster-server.mjs"]
