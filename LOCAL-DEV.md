# Local development (fully offline)

Run the whole app against a **local Postgres** with **dev-only auth** — no remote
Supabase, no risk of your test data (P2P ads, trades, balances) reaching live
users. Sign in as **User A / User B**, each pre-seeded with KSh 1,000,000.

## One-time setup

You already have PostgreSQL 18 running on `localhost:5432`.

1. **Create a local database** (use your local `postgres` password):
   ```powershell
   createdb -U postgres neemiz_dev
   # or, if createdb isn't on PATH:
   psql -U postgres -c "CREATE DATABASE neemiz_dev;"
   ```

2. **Point `.env.local` at local Postgres + turn on dev auth.** Edit `.env.local`:
   ```
   DATABASE_URL=postgresql://postgres:<your-local-password>@localhost:5432/neemiz_dev
   DEV_AUTH=true
   NEXT_PUBLIC_DEV_AUTH=true
   ```
   Leave the existing `NEXT_PUBLIC_SUPABASE_*` values as they are — dev auth
   bypasses them, but the browser client still constructs with them present.

   > Keep a copy of your real (remote) `.env.local` somewhere safe before editing.

3. **Create the tables** in the local DB:
   ```powershell
   npx prisma migrate deploy
   npx prisma generate
   ```

4. **Seed dummy users + balances:**
   ```powershell
   npm run seed:local
   ```
   Creates `usera@local.test` / `userb@local.test`, each with KSh 1,000,000.

## Daily use

```powershell
npm run dev:turbo
```
Then open <http://localhost:3000/dev-login> and click **Login as usera** (or use
the email/password below). You're now authenticated locally with a funded
wallet across P2P, binary, forex, and aviator.

Seeded credentials:

| User  | Email             | Password   |
|-------|-------------------|------------|
| usera | usera@local.test  | usera123   |
| userb | userb@local.test  | userb123   |

Open two browsers (or one normal + one incognito) — log in as usera in one and
userb in the other — to test P2P trades between them.

## How it works / safety

- `DEV_AUTH` is **hard-gated by `NODE_ENV`** (`lib/dev-auth.ts`): it can never
  activate in a production build, even if the env var is present.
- When on, `lib/supabase/server.ts`, `proxy.ts`, and the auth context resolve
  the user from a `dev_uid` cookie instead of calling Supabase.
- `/dev-login` and `/api/dev-auth` return **404 in production**.
- `npm run seed:local` refuses to run unless `DATABASE_URL` is `localhost`.

## Reverting to remote (prod-like) auth

Set `DEV_AUTH`/`NEXT_PUBLIC_DEV_AUTH` to `false` (or remove them) and restore
your remote `DATABASE_URL` + Supabase keys in `.env.local`.

## Limitations

- Avatar upload (Supabase Storage), OAuth (Google/GitHub), and real email/SMS
  don't work under dev auth — they need the real Supabase. Everything wallet/
  trading-related works fully against local Postgres.
