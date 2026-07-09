-- Merge separated bonus credit back into the main KES wallet.
-- The bonus columns remain for compatibility, but should no longer carry value.

UPDATE "users"
SET
  "wallet_balance" = "wallet_balance" + "bonus_balance",
  "bonus_balance" = 0.00,
  "bonus_wager_remaining" = 0.00,
  "bonus_cashout_cap" = 0.00,
  "bonus_expires_at" = NULL
WHERE "bonus_balance" <> 0.00
   OR "bonus_wager_remaining" <> 0.00
   OR "bonus_cashout_cap" <> 0.00
   OR "bonus_expires_at" IS NOT NULL;
