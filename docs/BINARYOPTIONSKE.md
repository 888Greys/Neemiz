# BinaryOptionsKE — sister brand on the Nezeem codebase

> Status: **live**. Domain `https://binaryoptionske.com`. Same Next.js image as
> Nezeem, separate Postgres database, shared Supabase Auth + shared Lipa merchant.
> Ops tracked from Nezeem admin at `/admin/new/binary-ke`.

This doc is the agent/operator reference for the **product surface**, not the
binary *pricing engine* (that lives in `docs/binary-architecture.md` /
`docs/binary-engine-developer-guide.md`).

---

## Why this shape

| Goal | Choice |
|------|--------|
| Totally separate brand + wallets from Nezeem | Separate Postgres DB `binaryoptionske` |
| Least server overload | Same VPS, same image, second container only — **no** second Supabase stack |
| Own domain / HTTPS | `binaryoptionske.com` → nginx → `127.0.0.1:3010` |
| Shared M-Pesa (for now) | Same Lipa keys; Nezeem webhook dual-credits either DB |
| Customize look later without forking | `PRODUCT_SURFACE=binary` gates all non-binary routes; restyle `/binary` + shell |

**Not** a path under `nezeem.com/binary-…`. Nezeem keeps its own `/binary`
product. BinaryOptionsKE is a **domain + env surface** on the same repo.

---

## Architecture (one picture)

```
                    ┌─────────────────────────────────────┐
                    │  Same GitHub repo / same Docker image │
                    │  ghcr.io/888greys/neemiz:<sha>         │
                    └───────────────┬─────────────────────┘
                                    │
           ┌────────────────────────┴────────────────────────┐
           ▼                                                 ▼
 ┌─────────────────────┐                         ┌──────────────────────────┐
 │ nezeem-app (3007/8) │                         │ binaryoptionske-app :3010│
 │ PRODUCT_SURFACE=full│                         │ PRODUCT_SURFACE=binary   │
 │ DATABASE_URL →      │                         │ DATABASE_URL →           │
 │   …/postgres        │                         │   …/binaryoptionske      │
 │ BINARYOPTIONSKE_    │── bokDb() ──────────────│                          │
 │   DATABASE_URL      │   (admin + Lipa dual)   │ NEXT_PUBLIC_APP_URL=     │
 │                     │                         │   https://binaryoptionske│
 └─────────┬───────────┘                         └────────────┬─────────────┘
           │                                                  │
           │         ┌──────────────────────┐                 │
           └────────►│ supabase-db-prod     │◄────────────────┘
                     │  DB: postgres        │
                     │  DB: binaryoptionske │
                     └──────────┬───────────┘
                                │
                     ┌──────────▼───────────┐
                     │ supabase-auth / Kong │  (shared identities)
                     │ SITE_URL=nezeem.com  │
                     │ URI allowlist includes│
                     │ binaryoptionske.com/ │
                     │   auth/callback      │
                     └──────────────────────┘

 Lipa STK (shared merchant)
   → creates PENDING tx in whichever app’s DB handled the deposit
   → callback URL still hits Nezeem `/api/webhooks/lipaharaka`
   → webhook tries Nezeem DB, then `bokDb()` (Binary DB), credits match
```

### Server paths (VPS `ssh nez`)

| Piece | Location |
|-------|----------|
| Nezeem runtime env | `/opt/neemiz/neemiz-runtime.docker.env` |
| Binary runtime env | `/opt/binaryoptionske/runtime.docker.env` |
| Nezeem deploy | `/opt/neemiz/deploy.sh` (blue/green 3007↔3008) |
| Nezeem env bounce | `/opt/neemiz/bounce-runtime-env.sh` |
| Binary container | `binaryoptionske-app` → `127.0.0.1:3010` |
| Nginx + TLS | site for `binaryoptionske.com` → 3010 |
| Postgres | `supabase-db-prod`, DB name `binaryoptionske` |

**Docker network:** app containers must join `supabase-prod_default` (and
`aviator_blueprint` when needed). Never bounce Nezeem onto default `bridge` or
DB connectivity dies — use `bounce-runtime-env.sh`.

---

## Product surface (`lib/product-surface.ts`)

| Env | Effect |
|-----|--------|
| `PRODUCT_SURFACE=binary` | Server gate + brand |
| `NEXT_PUBLIC_PRODUCT_SURFACE=binary` | Client shell/nav matches server |
| `NEXT_PUBLIC_BRAND_NAME=BinaryOptionsKE` | UI / emails brand string |
| `NEXT_PUBLIC_APP_URL=https://binaryoptionske.com` | OAuth callback redirects, email links |
| `NEXT_PUBLIC_PHONE_EMAIL_DOMAIN` | Optional; default `phone.binaryoptionske.com` |
| `NEXT_PUBLIC_SUPPORT_EMAIL` | Optional; default `support@binaryoptionske.com` |

Helpers:

- `productSurface()` / `isBinarySurface()` / `surfaceBrand()`
- `phoneAuthEmail()` / `isPhoneAuthEmail()` — synthetic emails for phone+password
- `isBinaryAllowedPath(pathname)` — everything else → `/binary`

Gate (middleware in `proxy.ts`): on binary surface, non-allowed paths and
`/dashboard` redirect to `/binary`. `/admin` is blocked on the Binary host
(ops stay on Nezeem).

Client: `SiteConfigProvider` in `app/layout.tsx` → `useSiteConfig()` /
`useIsBinarySurface()`.

---

## Branding / UI customization later

Because other products are blocked, **customize Binary alone** by editing:

| Area | Files |
|------|-------|
| Terminal UI | `components/binary/*`, `app/binary/page.tsx` |
| Wordmark | `components/brand-logo.tsx` (binary branch → **BinaryKE**) |
| Favicon / apple icon | `app/icon.tsx`, `app/apple-icon.tsx` (read `PRODUCT_SURFACE` at runtime). Drop custom PNGs here if you want a designed mark — or replace `app/favicon.ico` (Binary host rewrites `/favicon.ico` → `/icon` in `proxy.ts`) |
| Nav / shell | `components/app-shell.tsx` — Binary mobile uses **top hamburger** + Markets/Positions icons in the header pill (no bottom dock). |
| Company / legal | `lib/company.ts` |
| Surface helpers | `lib/product-surface.ts` |

### Deploy note (why live Binary can look “stuck”)

Nezeem blue/green deploy does **not** automatically recreate `binaryoptionske-app`.
After a `main` push lands a new GHCR tag, bounce Binary explicitly:

```bash
# on nez — use the same SHA Nezeem is running, or the newest local tag
IMG=$(docker inspect neemiz-app-3008 -f '{{.Config.Image}}')  # or 3007
docker rm -f binaryoptionske-app
docker run -d --name binaryoptionske-app --restart unless-stopped \
  --env-file /opt/binaryoptionske/runtime.docker.env \
  --network supabase-prod_default \
  -p 127.0.0.1:3010:3000 \
  "$IMG"
```

Or: `/opt/binaryoptionske/bounce.sh` if present.

**Rule:** when look-and-feel diverges from Nezeem’s `/binary`, wrap changes in
`isBinarySurface()` / `useIsBinarySurface()` so Nezeem’s casino binary product
stays unchanged. Do **not** fork a second binary app unless UX diverges heavily.

### Favicon — where to put a custom design

1. **Quick (code-generated):** edit `app/icon.tsx` + `app/apple-icon.tsx` (current “B” / “n” marks).
2. **Designed asset:** export PNG 32×32 (favicon) and 180×180 (apple), then either:
   - Replace the ImageResponse bodies to load those files from `public/brand/binary-icon.png`, or
   - Add `public/brand/binary-favicon.ico` and point `generateMetadata().icons` at it when `PRODUCT_SURFACE=binary`.
3. Do **not** overwrite `app/favicon.ico` with a Binary-only file — that asset is shared with Nezeem in the same Docker image.

---

## Money

### Deposits (on)

- Binary container uses the same Lipa STK flow (`/api/wallet/deposit/lipaharaka`).
- Pending rows live in the **Binary** DB.
- Lipa dashboard webhook still points at **Nezeem** →
  `app/api/webhooks/lipaharaka/route.ts` looks up Nezeem DB first, then
  `bokDb()` (`lib/db-bok.ts` + `BINARYOPTIONSKE_DATABASE_URL` on **Nezeem**
  runtime only).

### Withdrawals (off until unlocked)

- Binary env: `LIPAHARAKA_WITHDRAWALS_ENABLED=false`
- Flip to `true` on Binary runtime when ready (and re-bounce container).

### Longer term

Prefer a **separate Lipa merchant + webhook** for Binary so money paths don’t
share a callback. Dual-DB credit is the pragmatic bridge until then.

---

## Auth (Google / email / phone)

### Google OAuth bounced to nezeem.com

**Expected hop:** Google’s redirect URI is always shared Auth:
`https://www.nezeem.com/supabase-auth/auth/v1/callback`. Seeing Nezeem briefly
in the URL bar during Google login is normal.

**Must end on Binary:** GoTrue then redirects to
`https://binaryoptionske.com/auth/callback` (allowlisted). Session cookies are
host-scoped — login must finish on Binary’s host.

**Root cause we hit:** `NEXT_PUBLIC_APP_URL` is **baked at Docker build** (Nezeem).
`/auth/callback` must prefer `X-Forwarded-Host` / runtime `APP_URL` /
`PRODUCT_SURFACE=binary`, not the baked public URL. See `app/auth/callback/route.ts`.

GoTrue allowlist (`/opt/supabase-prod/.env` → `ADDITIONAL_REDIRECT_URLS`):

```text
https://www.nezeem.com/auth/callback,https://nezeem.com/auth/callback,https://binaryoptionske.com/auth/callback,https://www.binaryoptionske.com/auth/callback
```

#### Do you need Google Cloud “Web client” origins?

Usually **no change to Redirect URIs** — keep only:

`https://www.nezeem.com/supabase-auth/auth/v1/callback`

Optional (recommended): under the same OAuth client → **Authorized JavaScript origins**, add:

- `https://binaryoptionske.com`
- `https://www.binaryoptionske.com`

(Nezeem origins stay as they are.) You do **not** need a second Google OAuth client unless you split Auth later.

Binary runtime should also set non-public `APP_URL=https://binaryoptionske.com` (not only `NEXT_PUBLIC_*`).

### Phone synthetic emails

Phone+password accounts use fake emails (no SMS provider):

- Nezeem: `2547…@phone.nezeem.com`
- Binary: `2547…@phone.binaryoptionske.com`

These are **not** real inboxes. If Resend shows OTP to that address as **Sent**
(not **Delivered**), that is expected — there is no mailbox to confirm delivery.
Real Gmail addresses show **Delivered**.

### Email branding (`lib/brevo.ts` → Resend)

On Binary surface, user-facing subjects/body/From **name** use
`BinaryOptionsKE` (`MAIL_SENDER_NAME` / `surfaceBrand()`).

From **address** stays `noreply@nezeem.com` until `binaryoptionske.com` is
verified in Resend DNS — then set `MAIL_SENDER_EMAIL` on Binary runtime.

Admin/ops alert emails can stay Nezeem-branded (they run on Nezeem).

---

## Nezeem admin ops page

| Piece | Path |
|-------|------|
| UI | `/admin/new/binary-ke` (nav: **Binary KE**) |
| Page | `app/admin/(panel)/new/binary-ke/page.tsx` |
| Component + architecture blurb | `components/admin-v2/binary-ke.tsx` |
| API | `app/api/admin/binary-ke/route.ts` |
| Nav | `components/admin-v2/shell.tsx` |
| Second Prisma client | `lib/db-bok.ts` |

Requires on **Nezeem** runtime:

```bash
BINARYOPTIONSKE_DATABASE_URL=postgresql://…@supabase-db-prod:5432/binaryoptionske?connection_limit=5
```

(already derived from Nezeem `DATABASE_URL` with DB name swapped).

API auth: owner email + `verifyAdminToken(token)` — **one argument only**
(build broke when a second `user.id` arg was passed).

Metrics (EAT day window): users, deposits/withdrawals, pending/failed deposits,
trade stake, win payouts, GGR, recent deposits/trades.

---

## Local development (Binary alone)

Same repo — flip the surface with env. No second checkout required.

### Minimal `.env.local` overlay

```bash
PRODUCT_SURFACE=binary
NEXT_PUBLIC_PRODUCT_SURFACE=binary
NEXT_PUBLIC_BRAND_NAME=BinaryOptionsKE
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Prefer a separate DB so you never mix Nezeem wallets
DATABASE_URL=postgresql://USER:PASS@HOST:5432/binaryoptionske_local

# Optional
MAIL_SENDER_NAME=BinaryOptionsKE
LIPAHARAKA_WITHDRAWALS_ENABLED=false
```

Keep your usual `NEXT_PUBLIC_SUPABASE_*` / service role keys.

### Run

```bash
npm run dev
# or: bun run dev
```

Open `http://localhost:3000` → redirects to `/binary`. Sports/P2P/Aviator/etc.
are blocked.

### Workflow tips

- Save a copy as `.env.binary.local` and swap: `cp .env.binary.local .env.local`
  when working on Binary only.
- To run Nezeem + Binary side by side: two terminals, two env files, two ports
  (e.g. `:3000` full, `:3001` binary with `PORT=3001`).
- Schema: `npx prisma db push` against the Binary local DB when models change.
- Gate UI diffs with `useIsBinarySurface()` so Nezeem `/binary` stays clean.

OAuth locally: `redirectTo` uses `window.location.origin`; ensure localhost
callback is on the Supabase allowlist if you test Google locally.

---

## Key source files (checklist)

| Concern | File(s) |
|---------|---------|
| Surface flag + allowlist paths | `lib/product-surface.ts` |
| Middleware gate | `proxy.ts` |
| Brand company block | `lib/company.ts` |
| Site config context | `lib/site-config-context.tsx` |
| Home → `/binary` on binary | `app/page.tsx`, `app/layout.tsx` |
| OAuth callback host/path | `app/auth/callback/route.ts` |
| Login/register redirects + phone email | `components/login-modal.tsx`, `components/register-modal.tsx` |
| Shell binary-only nav | `components/app-shell.tsx` |
| Dual Lipa webhook | `app/api/webhooks/lipaharaka/route.ts` |
| Binary DB from Nezeem | `lib/db-bok.ts` |
| Admin ops | `app/api/admin/binary-ke/route.ts`, `components/admin-v2/binary-ke.tsx` |
| Resend branding | `lib/brevo.ts` |

---

## Ops runbook (short)

1. **Deploy code:** push `main` → GHCR build → `/opt/neemiz/deploy.sh` (and
   recreate/pull `binaryoptionske-app` on the new tag when Binary needs the
   same SHA).
2. **Env-only change on Nezeem:** `/opt/neemiz/bounce-runtime-env.sh`
3. **Env-only on Binary:** recreate `binaryoptionske-app` with
   `--env-file /opt/binaryoptionske/runtime.docker.env` on the current image
   (same networks as Nezeem).
4. **Google still lands on Nezeem:** re-check `ADDITIONAL_REDIRECT_URLS` /
   `GOTRUE_URI_ALLOW_LIST` on `supabase-auth-prod`.
5. **Deposit pending forever:** confirm Nezeem has `BINARYOPTIONSKE_DATABASE_URL`,
   webhook dual-lookup logs (`credited via binaryoptionske`), Lipa callback
   secret/IP still valid.
6. **Enable withdrawals:** set `LIPAHARAKA_WITHDRAWALS_ENABLED=true` on Binary
   runtime only when deliberately unlocking.

---

## Related docs

- Binary **pricing/settlement engine**: `docs/binary-architecture.md`
- Binary engine developer guide: `docs/binary-engine-developer-guide.md`
- Capacity / Redis: `docs/CAPACITY.md`
