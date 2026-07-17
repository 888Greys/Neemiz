-- Persist the merchant's Market-mode margin % so the browse list can show it.
ALTER TABLE "p2p_ads" ADD COLUMN IF NOT EXISTS "profit_margin_pct" DECIMAL(8,4);
