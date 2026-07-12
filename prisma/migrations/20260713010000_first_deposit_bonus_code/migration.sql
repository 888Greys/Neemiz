-- Seed the system promo code used to lock the 50% first-deposit bonus.
-- It is INACTIVE and amount 0 so it can never be redeemed as a typed code; the
-- server writes promo_redemptions rows against it directly (see
-- lib/first-deposit-bonus.ts) so the bonus principal stays non-withdrawable
-- via the existing promo-lock, while each account can only receive it once.

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
