ALTER TABLE "polymarket_bets"
ADD COLUMN "execution_mode" TEXT NOT NULL DEFAULT 'internal',
ADD COLUMN "clob_order_id" TEXT,
ADD COLUMN "clob_status" TEXT,
ADD COLUMN "clob_token_id" TEXT,
ADD COLUMN "clob_trade_ids" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "clob_tx_hashes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "clob_raw" JSONB;
