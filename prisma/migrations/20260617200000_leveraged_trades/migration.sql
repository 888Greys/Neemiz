-- Leveraged contracts: Multipliers (stop-out) and Turbos (knockout barrier).
-- Open-ended, live cash-out positions on the same server-authoritative spine as
-- accumulators. Idempotent because prod applies DDL by hand.

DO $$ BEGIN
  CREATE TYPE "LeveragedKind" AS ENUM ('MULTIPLIER', 'TURBO');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "LeveragedStatus" AS ENUM ('OPEN', 'CLOSED', 'STOPPED', 'KNOCKED_OUT', 'VOID');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "leveraged_trades" (
  "id"               TEXT NOT NULL,
  "user_id"          TEXT NOT NULL,
  "market"           TEXT NOT NULL,
  "kind"             "LeveragedKind" NOT NULL,
  "direction"        TEXT NOT NULL,
  "stake"            DECIMAL(18,2) NOT NULL,
  "multiplier"       INTEGER,
  "barrier"          DECIMAL(18,5),
  "payout_per_point" DECIMAL(24,8),
  "entry_spot"       DECIMAL(18,5) NOT NULL,
  "entry_epoch"      INTEGER NOT NULL,
  "take_profit"      DECIMAL(18,2),
  "stop_loss"        DECIMAL(18,2),
  "max_payout"       DECIMAL(18,2) NOT NULL,
  "exit_spot"        DECIMAL(18,5),
  "payout"           DECIMAL(18,2),
  "status"           "LeveragedStatus" NOT NULL DEFAULT 'OPEN',
  "settled_at"       TIMESTAMP(3),
  "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"       TIMESTAMP(3) NOT NULL,
  CONSTRAINT "leveraged_trades_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "leveraged_trades_user_id_created_at_idx" ON "leveraged_trades" ("user_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "leveraged_trades_status_idx" ON "leveraged_trades" ("status");

DO $$ BEGIN
  ALTER TABLE "leveraged_trades"
    ADD CONSTRAINT "leveraged_trades_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
