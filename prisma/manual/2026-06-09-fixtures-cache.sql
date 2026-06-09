-- Fixture cache + results + bet-selection settlement targeting.
-- Apply with `bunx prisma db push` (matches the project's db:push workflow),
-- which will create these automatically from schema.prisma. This file is the
-- equivalent raw SQL for reference / manual application.

-- 1. Settlement targeting on existing selections (nullable; legacy rows stay NULL)
ALTER TABLE "bet_selections" ADD COLUMN IF NOT EXISTS "sport_key" TEXT;
ALTER TABLE "bet_selections" ADD COLUMN IF NOT EXISTS "event_id"  TEXT;
CREATE INDEX IF NOT EXISTS "bet_selections_fixture_id_idx" ON "bet_selections" ("fixture_id");

-- 2. Cache of normalized fixtures (live + upcoming), refreshed by the cron
CREATE TABLE IF NOT EXISTS "fixtures_cache" (
  "numeric_id"    BIGINT       NOT NULL,
  "event_id"      TEXT         NOT NULL,
  "sport_key"     TEXT         NOT NULL,
  "commence_time" TIMESTAMP(3) NOT NULL,
  "category"      TEXT         NOT NULL,
  "completed"     BOOLEAN      NOT NULL DEFAULT false,
  "data"          JSONB        NOT NULL,
  "updated_at"    TIMESTAMP(3) NOT NULL,
  CONSTRAINT "fixtures_cache_pkey" PRIMARY KEY ("numeric_id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "fixtures_cache_event_id_key" ON "fixtures_cache" ("event_id");
CREATE INDEX IF NOT EXISTS "fixtures_cache_category_commence_time_idx" ON "fixtures_cache" ("category", "commence_time");

-- 3. Permanent finished results (read by the settler at zero API cost)
CREATE TABLE IF NOT EXISTS "fixture_results" (
  "numeric_id"  INTEGER      NOT NULL,
  "event_id"    TEXT         NOT NULL,
  "sport_key"   TEXT         NOT NULL,
  "home_team"   TEXT         NOT NULL,
  "away_team"   TEXT         NOT NULL,
  "home_score"  INTEGER,
  "away_score"  INTEGER,
  "state_id"    INTEGER      NOT NULL,
  "data"        JSONB        NOT NULL,
  "finished_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "fixture_results_pkey" PRIMARY KEY ("numeric_id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "fixture_results_event_id_key" ON "fixture_results" ("event_id");
