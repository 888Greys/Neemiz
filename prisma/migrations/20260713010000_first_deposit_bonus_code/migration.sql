-- Seed the system promo code used to lock the 50% first-deposit bonus.
-- Seeded Off (is_active=false) and amount 0. Admin Active/Off is the kill
-- switch for auto-grant (lib/first-deposit-bonus.ts). Typed redeem of this
-- code is always refused (lib/promo-redeem.ts); the server writes
-- promo_redemptions rows directly so the bonus principal stays
-- non-withdrawable via the existing promo-lock.

INSERT INTO "promo_codes" ("id", "code", "amount_kes", "max_redemptions", "redemption_count", "is_active", "description", "created_at", "updated_at")
VALUES (
  'promo_first_deposit',
  'FIRSTDEPOSIT',
  0,
  NULL,
  0,
  false,
  'System: 50% first-deposit bonus (play-only)',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("code") DO NOTHING;
