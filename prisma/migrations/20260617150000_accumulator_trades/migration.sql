-- Accumulator digit-index contracts. Stake grows by growth_rate% each tick the
-- spot stays inside a dynamic barrier band; busts to 0 on breakout; can be
-- cashed out any time. Settlement is server-authoritative (replay of the Deriv
-- tick path). Written idempotently because prod applies DDL by hand.

DO $$ BEGIN
  CREATE TYPE "AccumulatorStatus" AS ENUM ('OPEN', 'CLOSED', 'BUSTED', 'VOID');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "accumulator_trades" (
  "id"             TEXT NOT NULL,
  "user_id"        TEXT NOT NULL,
  "market"         TEXT NOT NULL,
  "stake"          DECIMAL(18,2) NOT NULL,
  "growth_rate"    INTEGER NOT NULL,
  "entry_spot"     DECIMAL(18,5) NOT NULL,
  "entry_epoch"    INTEGER NOT NULL,
  "barrier_frac"   DECIMAL(12,10) NOT NULL,
  "max_ticks"      INTEGER NOT NULL,
  "take_profit"    DECIMAL(18,2),
  "exit_spot"      DECIMAL(18,5),
  "ticks_survived" INTEGER,
  "payout"         DECIMAL(18,2),
  "status"         "AccumulatorStatus" NOT NULL DEFAULT 'OPEN',
  "settled_at"     TIMESTAMP(3),
  "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"     TIMESTAMP(3) NOT NULL,
  CONSTRAINT "accumulator_trades_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "accumulator_trades_user_id_created_at_idx"
  ON "accumulator_trades" ("user_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "accumulator_trades_status_idx"
  ON "accumulator_trades" ("status");

DO $$ BEGIN
  ALTER TABLE "accumulator_trades"
    ADD CONSTRAINT "accumulator_trades_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
