-- Additional welcome / influencer promo codes.

INSERT INTO "promo_codes" ("id", "code", "amount_kes", "max_redemptions", "redemption_count", "is_active", "description", "created_at", "updated_at")
VALUES
  (
    'promo_kip100',
    'KIP100',
    50.00,
    NULL,
    0,
    true,
    'Promo — KSh 50',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  ),
  (
    'promo_silas50',
    'SILAS50',
    50.00,
    NULL,
    0,
    true,
    'Promo — KSh 50',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  )
ON CONFLICT ("code") DO NOTHING;
