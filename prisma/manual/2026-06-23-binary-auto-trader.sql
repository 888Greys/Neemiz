-- Binary auto-trader (server-driven strategy sessions).
-- Apply with `bunx prisma db push` (the project's schema workflow). This file is
-- the equivalent raw SQL for reference / manual application.

-- 1. Strategy + session status enums
DO $$ BEGIN
  CREATE TYPE "AutoStrategy" AS ENUM ('FIXED', 'MARTINGALE', 'DALEMBERT', 'OSCARS');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "AutoSessionStatus" AS ENUM ('RUNNING', 'STOPPED', 'DONE_TP', 'DONE_SL', 'DONE_RUNS', 'ERROR');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 2. Link a placed binary trade back to its auto session (plain ref, no FK)
ALTER TABLE "binary_trades" ADD COLUMN IF NOT EXISTS "auto_session_id" TEXT;
CREATE INDEX IF NOT EXISTS "binary_trades_auto_session_id_created_at_idx"
  ON "binary_trades" ("auto_session_id", "created_at" DESC);

-- 3. Auto-trader sessions
CREATE TABLE IF NOT EXISTS "auto_trade_sessions" (
  "id"             TEXT NOT NULL,
  "user_id"        TEXT NOT NULL,
  "market"         TEXT NOT NULL,
  "side"           TEXT NOT NULL,
  "target_digit"   INTEGER NOT NULL,
  "duration_ticks" INTEGER NOT NULL,
  "strategy"       "AutoStrategy" NOT NULL,
  "base_stake"     DECIMAL(18,2) NOT NULL,
  "current_stake"  DECIMAL(18,2) NOT NULL,
  "multiplier"     DECIMAL(6,2) NOT NULL DEFAULT 2,
  "take_profit"    DECIMAL(18,2) NOT NULL,
  "stop_loss"      DECIMAL(18,2) NOT NULL,
  "max_runs"       INTEGER NOT NULL,
  "runs_done"      INTEGER NOT NULL DEFAULT 0,
  "wins"           INTEGER NOT NULL DEFAULT 0,
  "losses"         INTEGER NOT NULL DEFAULT 0,
  "total_pnl"      DECIMAL(18,2) NOT NULL DEFAULT 0,
  "cycle_pnl"      DECIMAL(18,2) NOT NULL DEFAULT 0,
  "last_trade_id"  TEXT,
  "status"         "AutoSessionStatus" NOT NULL DEFAULT 'RUNNING',
  "stop_reason"    TEXT,
  "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"     TIMESTAMP(3) NOT NULL,
  CONSTRAINT "auto_trade_sessions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "auto_trade_sessions_status_idx" ON "auto_trade_sessions" ("status");
CREATE INDEX IF NOT EXISTS "auto_trade_sessions_user_id_created_at_idx" ON "auto_trade_sessions" ("user_id", "created_at" DESC);
DO $$ BEGIN
  ALTER TABLE "auto_trade_sessions" ADD CONSTRAINT "auto_trade_sessions_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
