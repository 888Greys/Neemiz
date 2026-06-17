-- Directional contracts: Rise/Fall (exit vs entry) and Higher/Lower (exit vs a
-- chosen barrier). Fixed-duration, settled server-side on the exit tick.
-- Written idempotently because prod applies DDL by hand.

DO $$ BEGIN
  CREATE TYPE "DirectionalKind" AS ENUM ('RISE_FALL', 'HIGHER_LOWER');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "DirectionalStatus" AS ENUM ('PENDING', 'WON', 'LOST', 'VOID');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "directional_trades" (
  "id"             TEXT NOT NULL,
  "user_id"        TEXT NOT NULL,
  "market"         TEXT NOT NULL,
  "kind"           "DirectionalKind" NOT NULL,
  "side"           TEXT NOT NULL,
  "stake"          DECIMAL(18,2) NOT NULL,
  "payout"         DECIMAL(18,2) NOT NULL,
  "entry_spot"     DECIMAL(18,5) NOT NULL,
  "entry_epoch"    INTEGER NOT NULL,
  "barrier"        DECIMAL(18,5),
  "duration_ticks" INTEGER NOT NULL,
  "settle_before"  TIMESTAMP(3) NOT NULL,
  "exit_spot"      DECIMAL(18,5),
  "status"         "DirectionalStatus" NOT NULL DEFAULT 'PENDING',
  "settled_at"     TIMESTAMP(3),
  "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"     TIMESTAMP(3) NOT NULL,
  CONSTRAINT "directional_trades_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "directional_trades_user_id_created_at_idx"
  ON "directional_trades" ("user_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "directional_trades_status_idx"
  ON "directional_trades" ("status");

DO $$ BEGIN
  ALTER TABLE "directional_trades"
    ADD CONSTRAINT "directional_trades_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
