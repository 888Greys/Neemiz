-- The prod DB was baselined before `PENDING_APPROVAL` was added to the
-- 0_init enum definition, so the live `TransactionStatus` enum was missing
-- the value. Every query filtering on it (e.g. /api/admin/withdrawals,
-- /api/admin/stats) threw PrismaClientUnknownRequestError
-- ("invalid input value for enum"). This adds the value idempotently.
ALTER TYPE "TransactionStatus" ADD VALUE IF NOT EXISTS 'PENDING_APPROVAL' BEFORE 'COMPLETED';
