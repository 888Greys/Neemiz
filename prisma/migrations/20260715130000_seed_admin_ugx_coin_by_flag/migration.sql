-- Seed 1,000,000 UG Coin (UGX) to admin account(s).
--
-- The earlier seed (20260715120000) keyed on users.email and no-op'd, because
-- users.email can be NULL for accounts whose email is owned by another auth
-- identity: signing up with email-OTP then logging in with Google on the same
-- address drops the email column on the row (see lib/get-or-create-user P2002
-- handling). We therefore key on is_admin, which is reliably set.
--
-- UG Coin is a 1:1-pegged, P2P-only in-app coin on the crypto escrow rails
-- (user_crypto_balances, network = its own currency code). It is NOT a
-- blockchain asset and cannot be withdrawn — purely a marketing instrument.
--
-- Idempotent: re-running sets the balance to the target amount rather than
-- stacking. No-op if there is no admin.
INSERT INTO "user_crypto_balances" ("id", "user_id", "crypto", "network", "available", "locked", "updated_at")
SELECT
  gen_random_uuid()::text,
  u."id",
  'UGX',
  'UGX',
  1000000,
  0,
  CURRENT_TIMESTAMP
FROM "users" u
WHERE u."is_admin" = true
ON CONFLICT ("user_id", "crypto", "network")
DO UPDATE SET "available" = EXCLUDED."available", "updated_at" = CURRENT_TIMESTAMP;
