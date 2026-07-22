# Incident 2026-07-22 — Auth outage from Postgres connection exhaustion

**Severity:** High — all authentication down across every brand.
**Symptom reported:** "Continue with Google" returned
`{"code":500,"error_code":"unexpected_failure","msg":"Error creating flow state"}`
on `www.nezeem.com/supabase-auth/auth/v1/authorize?provider=google`.
**Actually affected:** Google OAuth, email/password login, token refresh, and
password recovery — every brand sharing the prod Supabase stack.

---

## Root cause

Self-hosted GoTrue (`supabase-auth-prod`) connects **directly** to Postgres
(`supabase-db-prod`) as the `postgres` superuser. Every auth call failed with:

```
FATAL: remaining connection slots are reserved for roles with the
SUPERUSER attribute (SQLSTATE 53300)
```

Postgres `max_connections = 100` was exhausted. **81 idle connections** were
held by the app containers (idle ~15h), leaving no slots for GoTrue.

The leak came from `lib/db.ts`:

```ts
// BEFORE — global cached in dev only
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
```

In production the singleton was never cached on `globalThis`, so each time Next
re-evaluated the module (separate route / server-component bundles in the build
output) it ran `new PrismaClient()` again — a fresh connection pool that was
never reused or closed. Those pools accumulated until the DB filled up.

The three sister Prisma clients (`db-bok.ts`, `db-mbk.ts`,
`db-binarymarket.ts`) already cache on the global unconditionally and were
**not** the source of the leak.

---

## Timeline (UTC, 2026-07-22)

- **~06:23–06:41** — repeated `500 unexpected_failure` on `/authorize`,
  `/token`, `/recover`. User reports the Google error (request id
  `0be07d2b-b8d1-4e99-b6d2-277b294d133a`).
- **~06:45** — diagnosed: 105 connections in use, 81 idle held by app
  containers as `postgres`.
- **06:47** — terminated 66 stale idle connections → 105→39; auth recovered.
- **06:48** — `idle_session_timeout=10min` set on the `postgres` role
  (recurrence safeguard, no restart).
- **06:54** — `lib/db.ts` singleton fix merged to `main`, prod deploy started.
- **06:59** — image `8cac303` live on Nezeem + BinaryOptionsKE + MoneyBinary.
- **~07:10** — BinaryMarket bounced onto `8cac303`; wired into `deploy.sh`.

---

## Fixes applied

### Code — all brands (same `ghcr.io/888greys/neemiz` image)
`lib/db.ts` now caches the Prisma client on `globalThis` in **all**
environments (one client per process). Commit `c6dd1de`, shipped in image
`8cac303` via `main`.

### Server — Postgres (`supabase-db-prod`)
- Terminated 66 leaked idle connections (immediate relief).
- `ALTER ROLE postgres SET idle_session_timeout = '10min';` — leaked idle app
  connections now auto-reap. No DB restart required; survives future leaks.

### Server — deploy pipeline (`/opt/neemiz/deploy.sh`)
Added a **BinaryMarket** bounce block. It was the only sister brand missing
from the deploy script, which is why it was left on the old image while the
others updated automatically. Backup:
`/opt/neemiz/deploy.sh.bak-add-binarymarket-*`.

---

## Per-brand status

| Brand | Container | Domain | DB / port | Image after fix | Notes |
|-------|-----------|--------|-----------|-----------------|-------|
| **Nezeem** | `neemiz-app-3007` / `-3008` | nezeem.com | `postgres` · 3007/3008 | `8cac303` ✅ | Blue-green primary; deploy.sh port-swaps these — **do not rename**. |
| **BinaryOptionsKE** | `binaryoptionske-app` | binaryoptionske.com | `binaryoptionske` · 3010 | `8cac303` ✅ | Auto-bounced by deploy.sh. |
| **MoneyBinary** | `moneybinaryke-app` | moneybinaryke.com | `moneybinaryke` · 3011 | `8cac303` ✅ | Auto-bounced by deploy.sh. |
| **BinaryMarket** | `binarymarket-app` | binarymarket.org | `binarymarket` · 3012 | `8cac303` ✅ | Manually bounced + newly wired into deploy.sh. |
| **QuickBinary** | `quickbinaryke-app` | quickbinaryke.com | — | (no container present) | deploy.sh bounces it if `/opt/quickbinaryke/bounce.sh` exists. |

All brands run the single Nezeem image with a per-brand
`/opt/<brand>/runtime.docker.env` (different `DATABASE_URL` DB name + port).

---

## Verification

- `supabase-auth-prod` `/health` OK; **0** `53300` errors post-fix.
- Postgres steady at ~41/100 connections (`postgres` role ~21, was 81).
- All four brand containers on image `8cac303`, health checks passing.

---

## Follow-ups (not done — deliberate)

- **Pooler migration skipped.** Apps connect directly to `supabase-db-prod:5432`
  as `postgres` rather than via `supabase-pooler-prod` (Supavisor). At current
  load (~41/100) it is unnecessary, and Supavisor transaction-mode + Prisma is
  error-prone (`prod` pooler is also tagged `POOLER_TENANT_ID=neemiz-staging`,
  which looks misconfigured). If connections are outgrown later, prefer raising
  `max_connections` or doing the Supavisor move deliberately with per-app
  validation.
- **App role.** Apps use the `postgres` superuser. Consider a dedicated
  non-superuser app role so app traffic can never consume the superuser-reserved
  slots GoTrue's admin role needs.
- **`connection_limit=5`** per app is fine now that the singleton holds; revisit
  only if a pooler is introduced.
