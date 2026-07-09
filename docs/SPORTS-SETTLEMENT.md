# Sports Data & Bet Settlement

How sports fixtures, odds, images, and bet settlement work in Neemiz.

## TL;DR

- **Odds/lines** come from **The Odds API** (one multi-sport plan).
- **Scores/results** for settlement and **team images** come from **TheSportsDB** (free) — The Odds API's score feed is unreliable, so we don't settle from it alone.
- A **server-side cache** (DB tables) sits in front of The Odds API so user traffic never spends API credits directly. The credit spend is fixed per refresh interval, not per request.
- Two crons drive it: **refresh-fixtures** (fills the cache) and **settle-bets** (settles pending bets).

```
                 ┌─────────────────┐         ┌──────────────────┐
  refresh cron → │  The Odds API   │ odds    │   TheSportsDB    │ ← settle cron
   (hourly)      │  (paid, multi-  │ +scores │  (free: scores,  │   (every 5 min)
                 │   sport plan)   │         │  results, logos) │
                 └────────┬────────┘         └────────┬─────────┘
                          │ normalize → Match                │
                          ▼                                   ▼
                 ┌──────────────────────────────────────────────┐
                 │  Postgres cache:  fixtures_cache / fixture_results
                 └────────┬───────────────────────────┬─────────┘
                   reads (0 credits)            reads (0 credits)
                          ▼                            ▼
                  /sports, /sports/[id],         /api/bets/settle
                  bet placement                  (resolves PENDING bets)
```

## Data sources

| Source | Used for | Plan | Notes |
|---|---|---|---|
| **The Odds API** (`lib/theoddsapi.ts`) | Betting **odds/lines** (1X2, totals, handicap) across all sports | Paid (100K credits/mo, resets 1st) | One key covers all sports. Bills **per market × region per request** — see "Credit budget". `/scores` exists but is thin/unreliable, so it is only a *secondary* settlement source. |
| **TheSportsDB** (`lib/thesportsdb.ts`) | **Scores/results** for settlement + **team badges/logos** | Free (30 req/min) | Reliable results where The Odds API has gaps (NBA/NHL/Gold Cup confirmed missing there). Matched by team name + date. |
| **API-Sports / api-football** (`lib/apisports.ts`) | Evaluation only | — | Opt-in via `?provider=apisports`, soccer only, **dormant**. Kept as a reference; not in the live path. Rejected because it prices **per sport**. |

## The cache layer

Why it exists: the old code hit The Odds API on every page load and looped *every* in-season sport *per fixture*, burning ~190 credits per settle run and ~48 per page view — which exhausted the plan within hours and silently broke settlement. The cache decouples credit spend from traffic.

### Tables (`prisma/schema.prisma`)

- **`fixtures_cache`** — normalized live/upcoming matches (incl. detail markets) as JSON. Read by the sports pages and bet placement. Refreshed by the cron.
  - `numericId` is **BigInt** (the Odds API id hashes to up to 4.29e9, which overflows Postgres `INTEGER`).
- **`fixture_results`** — **permanent** finished results. A finished game never changes, so once recorded the settler reads it at zero API cost.
- **`bet_selections.sport_key` / `event_id`** — captured at bet placement so settlement can target one sport instead of scanning all of them (legacy rows are null → fall back to a full scan).

### Refresh (`lib/fixtures-cache.ts` → `refreshFixtureCache`)

Fetches each in-season sport's odds + scores **once per run** (O(sports), not O(fixtures)), enriches team badges from TheSportsDB, and upserts into `fixtures_cache`; finished games are also written to `fixture_results`. Returns `apiHealthy: false` on a genuine outage (401/429/5xx) so the settler can avoid acting on missing data.

Triggered by `GET /api/cron/refresh-fixtures` (Bearer `CRON_SECRET`).

### Reads (zero API credits)

- `readLivescores()` / `readUpcoming()` → `/sports`, `/api/sports/live`
- `readFixtureDetail(id)` → `/sports/[fixtureId]` (and bet placement verification)
- `getKnownResults(ids)` → settlement

All read straight from Postgres. Mocks/raw API remain as fallback if the cache is cold.

## Settlement pipeline (`app/api/bets/settle/route.ts`)

Runs on a cron (POST or GET with Bearer `CRON_SECRET`). For each `PENDING` bet it resolves every selection's fixture, then settles atomically.

### Fixture resolution order (cheapest first)

1. **`fixture_results` cache** — permanent finished results (0 credits).
2. **The Odds API** — only for unresolved fixtures, and only the sports those bets belong to (targeted via stored `sport_key`).
3. **TheSportsDB** (`getThesportsdbResult`) — for anything still unresolved. Looks the game up by team name, **picks the event nearest the bet's placement date** (so a playoff series doesn't settle the wrong game), and maps scores to the bet's home/away (their home/away order can differ). Capped at 25 lookups/run for the rate limit.

Newly-finished fixtures from steps 2–3 are persisted to `fixture_results` so the next run is free.

### Outcome logic (`lib/settle-bet.ts`)

`resolveSelection(selection, detail, stateId)` → `WON | LOST | VOID` per market:

| Market | Rule |
|---|---|
| Full Time Result / 1X2 / Match Winner | label vs actual 1/X/2 |
| Both Teams To Score | both scores > 0 |
| Double Chance | 1X / 12 / X2 |
| Draw No Bet | draw → VOID (refund) |
| **Handicap / Asian Handicap / Spread** | label `"<1\|2> <signed line>"`; line added to the team's score; exact tie = push (VOID) |
| Abandoned/Cancelled (stateId 13/17) | VOID |
| Unknown market | VOID (never settle as LOST by mistake) |

- `determineBetOutcome` — MULTI is LOST if any leg lost; WON if ≥1 won and the rest VOID; all-VOID → VOID.
- `calculateWinAmount` — SINGLE: stake × odds; MULTI: product of WON legs (VOID legs are neutral / odds 1).
- **House profit retention** (`lib/house-retention.ts`): user keeps stake + 70% of profit; house retains 30% (`PROFIT_RETENTION_RATE = 0.30`). Applied on WON; VOID refunds the full stake.

### Money movements (atomic, idempotent per bet)

- **WON** → credit `winAmount` to wallet, `BET_WIN` transaction, notification.
- **VOID** → refund stake, `REFUND` transaction, notification.
- **LOST** → no payout.
- Each runs in a `db.$transaction` that re-checks the bet is still `PENDING` (idempotent), so duplicate cron runs can't double-pay.

### Auto-void (stuck bets)

A bet still `PENDING` after 3 days whose fixtures have left the data feed can never be settled (the score window has passed) → it is **voided and the stake refunded**. This is **gated on `apiHealthy`**: during an Odds API outage every fixture looks "missing," so voiding is paused to avoid wrongly refunding losing bets.

## Crons (VPS — `ssh nez`, `/opt/neemiz/`)

System cron on the VPS curls the production endpoints (not Vercel Cron):

| Schedule | Script / call | Purpose |
|---|---|---|
| `*/5 * * * *` | `settle-bets.sh` → `POST /api/bets/settle` | settle pending bets |
| `0 * * * *` (hourly) | `GET /api/cron/refresh-fixtures` | fill the fixture cache |
| `*/30 * * * *` | `settle-polymarket.sh` | Polymarket settlement |
| `* * * * *` | `check-deposits.sh` | deposits |

All authenticate with `Authorization: Bearer $CRON_SECRET` (from `/opt/neemiz/settle.env`).

Manual trigger:
```bash
ssh nez 'set -a; . /opt/neemiz/settle.env; set +a; \
  curl -fsS -X POST https://www.nezeem.com/api/bets/settle -H "Authorization: Bearer $CRON_SECRET"'
```

## Environment variables

| Var | Where | Purpose |
|---|---|---|
| `ODDS_API_KEY` | Vercel | The Odds API key (100K plan) |
| `ODDS_HOURLY_BUDGET` | Vercel (optional) | Max credits per refresh-fixtures run (default 220). All active leagues are wired; hot leagues every run, others rotate so the monthly cap is not blown. |
| `THESPORTSDB_KEY` | Vercel (optional) | TheSportsDB key; defaults to free `"3"` |
| `APISPORTS_KEY` | Vercel (optional) | API-Sports key for the dormant eval adapter |
| `CRON_SECRET` | Vercel + VPS `settle.env` | authorizes the cron endpoints |
| `DATABASE_URL` | Vercel + VPS `settle.env` | Postgres (Supabase pooler) |

## Credit budget (The Odds API)

Cost = **1 credit per market × per region, per request**. Scores cost 1 (live) or 2 (`daysFrom`). The 100K/mo plan ≈ 3,300/day.

**User traffic never spends Odds credits** — `/sports`, fixture detail, and bet placement read `fixtures_cache` only.

**Refresh cron** wires **all** active match leagues under `ODDS_HOURLY_BUDGET` (default 220/run):
- Hot (World Cup, top soccer, NFL/NBA/MLB/NHL when active): full `h2h,totals,spreads` + scores every run
- Warm (rotating chunk): `h2h` + scores
- Cold (rest of budget): `h2h` only, no scores this hour

Naïve “full markets for all 50 leagues every hour” ≈ 250 credits/run → ~180K/mo and **would exhaust** the plan. The rotation keeps coverage of every league while staying under budget. Tune interval / `ODDS_HOURLY_BUDGET` if usage climbs.

## Monitoring & troubleshooting

- **Settle response** includes `apiHealthy`, `fixturesFetched/Finished`, `resolvedViaSportsdb`, `betsSettled`, `betsVoided`, and a `warning` on outage.
- **Logs:** VPS `/var/log/neemiz-settle.log` and `/var/log/neemiz-refresh.log`; Vercel runtime logs for stack traces.
- **Simulation harness:** `npx tsx scripts/simulate-settlement.ts` — 43 checks over the pure settle logic (markets, MULTI aggregation, retention, handicap, end-to-end). Run after any change to `lib/settle-bet.ts`.
- **Schema changes:** `bunx prisma db push` (matches the `db:push` workflow); reference SQL in `prisma/manual/2026-06-09-fixtures-cache.sql`.

### Common symptoms

| Symptom | Likely cause |
|---|---|
| Nothing settles, `apiHealthy:false`, `resultsRecorded:0` | Odds API key out of credits |
| A finished game won't settle from the Odds API | Its score feed is missing the game → TheSportsDB fallback handles it; if TheSportsDB also lacks it (niche league / national team), the bet auto-voids after 3 days |
| Bet stuck `PENDING` past 3 days | fixture still lingering in the feed (not marked finished) — auto-void only fires once it leaves the feed |
| Wrong game settled in a series | check the bet's `created_at` vs the matched event date in `lib/thesportsdb.ts` (±5-day window, nearest-date pick) |
