-- Both influencer codes credit KSh 50 (KIP100 name is branding, not the amount).

UPDATE "promo_codes"
SET
  "amount_kes" = 50.00,
  "description" = 'Promo — KSh 50',
  "updated_at" = CURRENT_TIMESTAMP
WHERE "code" IN ('KIP100', 'SILAS50');
