-- Fold the separated Forex wallet back into the main KES wallet.
-- Column remains for backward-compatible deployments; new gameplay uses wallet_balance only.

UPDATE "users"
SET
  "wallet_balance" = "wallet_balance" + "forex_wallet_balance",
  "forex_wallet_balance" = 0.00
WHERE "forex_wallet_balance" <> 0.00;
