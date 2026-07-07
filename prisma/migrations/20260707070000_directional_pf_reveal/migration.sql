ALTER TABLE "directional_trades"
  ADD COLUMN "pf_server_seed" TEXT,
  ADD COLUMN "pf_commitment" TEXT,
  ADD COLUMN "pf_signature" TEXT,
  ADD COLUMN "pf_client_seed" TEXT,
  ADD COLUMN "pf_nonce" TEXT,
  ADD COLUMN "pf_payout_multiplier" DECIMAL(10, 4);
