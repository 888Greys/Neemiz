-- AddColumn: hd_index to crypto_deposit_addresses
-- Used for BIP44 HD wallet derivation — lets the hot wallet sign withdrawals
-- from the user's own deposit address without floating tokens through a pool.

ALTER TABLE "crypto_deposit_addresses"
    ADD COLUMN IF NOT EXISTS "hd_index" INTEGER;
