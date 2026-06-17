-- Binary trades that can never be settled (e.g. the live Deriv feed was
-- unreachable for the whole settlement window) are now refunded and marked
-- VOID instead of being stranded PENDING forever. Add the enum value
-- idempotently so the prod DB (baselined before this) gets it safely.
ALTER TYPE "BinaryTradeStatus" ADD VALUE IF NOT EXISTS 'VOID';
