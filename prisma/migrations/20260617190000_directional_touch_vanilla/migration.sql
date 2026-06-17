-- Extend directional contracts with Touch/No-Touch (path-dependent barrier) and
-- Vanillas (Call/Put, proportional payout via payout_per_point). Idempotent
-- because prod applies DDL by hand. ADD VALUE runs outside a txn (autocommit).

ALTER TYPE "DirectionalKind" ADD VALUE IF NOT EXISTS 'TOUCH_NO_TOUCH';
ALTER TYPE "DirectionalKind" ADD VALUE IF NOT EXISTS 'VANILLA';

ALTER TABLE "directional_trades"
  ADD COLUMN IF NOT EXISTS "payout_per_point" DECIMAL(24,8);
