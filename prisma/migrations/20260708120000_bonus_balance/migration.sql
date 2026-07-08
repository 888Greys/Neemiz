-- Non-withdrawable, non-transferable promo credit, kept separate from wallet_balance (real cash).
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "bonus_balance" DECIMAL(18,2) NOT NULL DEFAULT 0.00;
