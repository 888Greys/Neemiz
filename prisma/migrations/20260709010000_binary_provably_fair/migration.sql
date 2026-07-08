-- Provably-fair proof for digit contracts (mirrors directional_trades).
-- Commit SHA256(serverSeed) + HMAC-signed terms at bet time; reveal the seed
-- once the trade is terminal. The outcome is a replay of public Deriv ticks
-- from entry_epoch through the open-source settlement kernel.
ALTER TABLE "binary_trades" ADD COLUMN IF NOT EXISTS "pf_server_seed"       TEXT;
ALTER TABLE "binary_trades" ADD COLUMN IF NOT EXISTS "pf_commitment"        TEXT;
ALTER TABLE "binary_trades" ADD COLUMN IF NOT EXISTS "pf_signature"         TEXT;
ALTER TABLE "binary_trades" ADD COLUMN IF NOT EXISTS "pf_client_seed"       TEXT;
ALTER TABLE "binary_trades" ADD COLUMN IF NOT EXISTS "pf_nonce"             TEXT;
ALTER TABLE "binary_trades" ADD COLUMN IF NOT EXISTS "pf_payout_multiplier" DECIMAL(10,4);
