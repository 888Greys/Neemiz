-- Maker-pays P2P platform fee. Records the fee rate an ad was created under so
-- release can charge the maker the amount it reserved. Defaults to 0 so all
-- pre-existing ads remain fee-free (no retroactive under-debit of their escrow).
ALTER TABLE "p2p_ads" ADD COLUMN "fee_rate" DECIMAL(6,4) NOT NULL DEFAULT 0;
