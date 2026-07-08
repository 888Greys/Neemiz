-- Bonus wagering cycle: turnover requirement + cashout cap + expiry.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "bonus_wager_remaining" DECIMAL(18,2) NOT NULL DEFAULT 0.00;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "bonus_cashout_cap"     DECIMAL(18,2) NOT NULL DEFAULT 0.00;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "bonus_expires_at"      TIMESTAMP(3);

-- Backfill: existing bonus holders (pre-wagering grants) get a standard cycle —
-- x8 turnover, x4 cashout cap — with a generous 30-day runway since their
-- grants predate the expiry rule.
UPDATE "users"
SET "bonus_wager_remaining" = "bonus_balance" * 8,
    "bonus_cashout_cap"     = "bonus_balance" * 4,
    "bonus_expires_at"      = NOW() + INTERVAL '30 days'
WHERE "bonus_balance" > 0 AND "bonus_expires_at" IS NULL;
