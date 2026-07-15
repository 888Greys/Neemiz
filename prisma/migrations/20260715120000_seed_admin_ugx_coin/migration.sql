-- Seed UG Coin (UGX) into the admin's P2P balance.
--
-- UG Coin is one of the in-app local coins: a 1:1-pegged in-app currency that
-- trades over the generic crypto escrow rails (user_crypto_balances), NOT a
-- blockchain asset and NOT the fiat wallet (that's KES Coin / users.wallet_balance).
-- Its "network" is its own currency code, matching defaultNetwork("UGX") = "UGX".
--
-- Idempotent: re-running sets the balance to the target amount rather than
-- stacking. If the target account doesn't exist, the SELECT yields no rows and
-- the statement is a safe no-op.
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
WHERE u."email" = 'toxicgreys001@gmail.com'
ON CONFLICT ("user_id", "crypto", "network")
DO UPDATE SET "available" = EXCLUDED."available", "updated_at" = CURRENT_TIMESTAMP;
