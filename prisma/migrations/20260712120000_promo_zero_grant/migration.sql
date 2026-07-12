-- Zero out the welcome / influencer promo grants: NEZEEM400, KIP100, SILAS50
-- now credit KSh 0 instead of KSh 50 (kill the free-credit farming surface).

UPDATE "promo_codes"
SET
  "amount_kes" = 0.00,
  "description" = 'Promo — KSh 0',
  "updated_at" = CURRENT_TIMESTAMP
WHERE "code" IN ('NEZEEM400', 'KIP100', 'SILAS50');
