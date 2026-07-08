-- Allow fractional crypto amounts (BTC/ETH) on the transaction ledger.
-- Fiat KES values remain fine at 2 dp; this only widens precision.
ALTER TABLE "transactions" ALTER COLUMN "amount" TYPE DECIMAL(18,8);
