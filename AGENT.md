# AGENT.md — Nezeem Architecture & Conventions

> Read this first. It covers the deployment model, multi-brand architecture, and gotchas that every agent re-discovers painfully.

## Project overview

This is a Next.js 14 monorepo serving **one Docker image** that powers multiple domains:

| Domain | Brand | Surface | DB | Port |
|--------|-------|---------|-----|------|
| `nezeem.com` | Nezeem (full casino) | `full` | `postgres` | 3007/3008 (blue/green) |
| `binaryoptionske.com` | BinaryOptionsKE | `binary` | `binaryoptionske` | 3010 |
| `moneybinaryke.com` | MoneyBinary | `binary` | `moneybinaryke` | 3011 |
| `binarymarket.org` | QuickBinary | `binary` | `quickbinaryke` | 3012 |

**Key insight:** Same GHCR image (`ghcr.io/888greys/neemiz:<sha>`), separate containers, separate Postgres databases on the same host, shared Supabase Auth/Kong. No forks, no separate deployments.

## How the surface/brand system works

### Detection (`lib/product-surface.ts`)

- `PRODUCT_SURFACE=binary` env var — REQUIRED on binary containers (it always wins)
- Hardcoded hostname fallback for `binaryoptionske.com`, `moneybinaryke.com`, and `binarymarket.org` only
- `nezeem.com` (+ subdomains) is NEVER binary. Never match `NEXT_PUBLIC_APP_URL` for
  surface detection — on Nezeem containers it holds the Nezeem domain, and matching it
  flipped `www.nezeem.com` into the binary gate (2026-07-20 incident)
- Client-side gate: `useIsBinarySurface()` from `lib/site-config-context.tsx`
- Middleware gate: `isBinarySurface({ host })` in `proxy.ts`

### Branding is derived from env

- `NEXT_PUBLIC_BRAND_NAME` → `surfaceBrand()` → used everywhere (UI, emails, etc.)
- `NEXT_PUBLIC_APP_URL` → determines domain for phone auth emails, email themes, company details
- Logo: `components/brand-logo.tsx` renders dynamically per brand (reads `useSiteConfig().brand`)

### Binary surface routing rules

- `/` → landing page (guest) or `/binary` (signed-in)
- `/dashboard` → `/binary` (redirect)
- `/admin*` → `/binary` (blocked, admin is nezeem.com only)
- Allowlisted paths only (`isBinaryAllowedPath()` in `lib/product-surface.ts`)

## Deployment architecture

### Build pipeline
1. GitHub Actions builds image on push to `main` (prod) or `staging` (staging)
2. Image pushed to GHCR: `ghcr.io/888greys/neemiz:<sha>` (or `<sha>-staging`)
3. VPS pulls image and swaps containers

### VPS layout (SSH `ssh nez`)
```
/opt/neemiz/                  — Nezeem prod (blue/green on 3007/3008)
  deploy.sh                   — Main deploy script
  bounce-runtime-env.sh       — Bounce for env-only changes
  neemiz-runtime.docker.env   — Runtime env vars

/opt/binaryoptionske/         — BinaryOptionsKE
  runtime.docker.env          — PRODUCTION_SURFACE=binary, etc.
  bounce.sh                   — Recreate container on current image

/opt/moneybinaryke/           — MoneyBinary (sibling pattern)
  runtime.docker.env
  bounce.sh

/opt/quickbinaryke/           — QuickBinary (sibling pattern, port 3012)
  runtime.docker.env
  bounce.sh

/opt/supabase-prod/           — Self-hosted Supabase (shared)
  .env                        — ADDITIONAL_REDIRECT_URLS (OAuth allowlist)
  docker-compose.yml          — Auth + DB containers
```

### Deploy chain
On every `main` push → `deploy.sh`:
1. Builds GHCR image on GitHub Actions
2. VPS pulls, blue/green swaps Nezeem
3. Runs `/opt/binaryoptionske/bounce.sh "$IMAGE"`
4. Runs `/opt/moneybinaryke/bounce.sh "$IMAGE"`
5. Runs `/opt/quickbinaryke/bounce.sh "$IMAGE"`

**Critical:** Binary site bounces don't roll back Nezeem. Failures are logged as warnings.

## Database architecture

- Same Postgres host (`supabase-db-prod`), separate databases per brand
- `lib/db.ts` — Nezeem Prisma client (default)
- `lib/db-bok.ts` — BinaryOptionsKE Prisma client (`bokDb()`)
- `lib/db-mbk.ts` — MoneyBinary Prisma client (`mbkDb()`)
- `lib/db-qbk.ts` — QuickBinary Prisma client (`qbkDb()`)
- Nezeem runtime needs `BINARYOPTIONSKE_DATABASE_URL` + `MONEYBINARYKE_DATABASE_URL` + `QUICKBINARYKE_DATABASE_URL` for admin ops and Lipa webhook

## Payment webhooks (critical gotcha)

### Lipa Haraka (M-Pesa)
- Single Lipa merchant shared across all brands
- Callback URL points to `nezeem.com/api/webhooks/lipaharaka`
- Webhook handler searches all THREE databases for pending transactions
- **When adding a new brand, you MUST:**
  1. Create the DB (`CREATE DATABASE newbrand`)
  2. Clone schema (`pg_dump -s binaryoptionske | psql -d newbrand`)
  3. Create a DB client file (`lib/db-newbrand.ts`)
  4. Add it to the webhook loop in `app/api/webhooks/lipaharaka/route.ts`
  5. Add the `NEWBRAND_DATABASE_URL` env var to Nezeem's runtime

### Other payment providers (PesaPal, MegaPay, crypto)
- Similar pattern — webhook hits Nezeem, dual-credits the correct DB
- Each may need its own brand DB lookup added

## Auth architecture

- Shared Supabase Auth/Kong at `www.nezeem.com/supabase-auth`
- All brands use the same `NEXT_PUBLIC_SUPABASE_URL`
- Supabase auth cookie is scoped to `www.nezeem.com` domain
- OAuth redirect flow: Google → GoTrue → `/auth/callback` on whichever brand started login
- **When adding a new brand, you MUST add to:**
  - `ADDITIONAL_REDIRECT_URLS` in `/opt/supabase-prod/.env`
  - Recreate auth container: `cd /opt/supabase-prod && docker compose up -d --force-recreate auth`

## CSS/theming architecture

- Binary brands use `html[data-surface="binary"]` scoping
- Main trader theme: `components/binary-ke/trader.css` (black/lime `#b8ff2a`)
- Landing pages per brand: `components/<brand>/landing.css` + `landing-page.tsx`
- Nezeem `/binary` is untouched — binary brand CSS only affects binary surfaces

## New binary brand checklist

When adding a new binary-only site (e.g., `newsite.com`):

### Code changes
1. `lib/product-surface.ts` — add hostname fallback
2. `lib/sister-binary-brands.ts` — register brand
3. `lib/email-theme.ts` — dynamic brand detection (handled automatically via `surfaceBrand()`)
4. `components/brand-logo.tsx` — dynamic rendering (handled automatically)
5. `app/page.tsx` — route to brand-specific landing page if different from default
6. `app/auth/callback/route.ts` — add hostname regex for binary detection
7. Landing page CSS + component in `components/<brand>/`

### Server setup (on VPS)
1. `CREATE DATABASE <name>` on supabase-db-prod
2. `pg_dump -s binaryoptionske | psql -d <name>` for schema
3. `mkdir -p /opt/<name>/` with `runtime.docker.env` and `bounce.sh`
4. Nginx config in `/etc/nginx/sites-enabled/<name>`
5. SSL cert via certbot or Cloudflare origin cert
6. Cloudflare DNS A record → VPS IP, set SSL to Full

### Auth + payments
7. Add to `ADDITIONAL_REDIRECT_URLS` in `/opt/supabase-prod/.env`
8. Recreate auth container
9. Create DB client (`lib/db-<brand>.ts`) + add to Lipa webhook
10. Set `<BRAND>_DATABASE_URL` on Nezeem runtime
11. Update `/opt/neemiz/deploy.sh` to bounce the new brand
12. Update `.env.local.example` with local dev vars

## QuickBinary domain

QuickBinary (id `quickbinaryke`, port 3012, DB `quickbinaryke`) was provisioned
with a placeholder domain, then swapped to the real domain when it was registered.

- **Domain:** `binarymarket.org`
- **Resolver hostname match:** `lib/product-surface.ts` — `hostLooksBinary()` checks `binarymarket.org`
- **Auth callback regex:** `app/auth/callback/route.ts` — `binarymarket\.org` alternation
- **Registry:** `lib/sister-binary-brands.ts` — `domain: "binarymarket.org"`
- **Admin site URL:** `app/api/admin/binary-ke/route.ts` — `siteUrl: "https://binarymarket.org"`
- **Phone auth email:** `isPhoneAuthEmail()` — `@phone.binarymarket.org`
- **VPS runtime env:** `/opt/quickbinaryke/runtime.docker.env` — `NEXT_PUBLIC_APP_URL`, `APP_URL`, phone email domain all set to `binarymarket.org`
- **Nginx:** `/etc/nginx/sites-enabled/binarymarket` → `proxy_pass http://127.0.0.1:3012`
- **Supabase Auth:** `ADDITIONAL_REDIRECT_URLS` includes `https://binarymarket.org/auth/callback` + `https://www.binarymarket.org/auth/callback`

## Key files reference

| Concern | Files |
|---------|-------|
| Surface detection | `lib/product-surface.ts`, `lib/site-config-context.tsx` |
| Middleware/routing | `proxy.ts`, `app/page.tsx` |
| Email branding | `lib/brevo.ts`, `lib/email-theme.ts` |
| Company/legal | `lib/company.ts` |
| Brand logo | `components/brand-logo.tsx` |
| Sister brand registry | `lib/sister-binary-brands.ts` |
| DB clients | `lib/db.ts`, `lib/db-bok.ts`, `lib/db-mbk.ts`, `lib/db-qbk.ts` |
| Lipa webhook | `app/api/webhooks/lipaharaka/route.ts` |
| Admin ops | `app/api/admin/binary-ke/route.ts`, `components/admin-v2/binary-ke.tsx` |
| Trader CSS | `components/binary-ke/trader.css` |
| Landing pages | `components/binary-ke/landing-*`, `components/moneybinary/landing-*` |
| Auth callback | `app/auth/callback/route.ts` |
| Deploy docs | `docs/BINARYOPTIONSKE.md` |
| Deploy scripts | `scripts/bounce-*.sh`, `/opt/neemiz/deploy.sh` |

## Git workflow

- `staging` branch → auto-deploys to `nez-test.nezeem.com`
- `main` branch → auto-deploys to production (all domains)
- Push to staging to test, merge to main to ship
- No PR required for merges (branch protection was bypassed)

## Local development

```bash
# Binary surface locally
PRODUCT_SURFACE=binary \
NEXT_PUBLIC_PRODUCT_SURFACE=binary \
NEXT_PUBLIC_BRAND_NAME=MoneyBinary \
NEXT_PUBLIC_APP_URL=http://localhost:3000 \
DATABASE_URL=postgresql://.../moneybinaryke_local \
npm run dev
```
