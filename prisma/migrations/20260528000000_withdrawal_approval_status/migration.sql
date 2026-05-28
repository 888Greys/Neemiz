-- Add PENDING_APPROVAL status for large / high-frequency withdrawal gate
ALTER TYPE "TransactionStatus" ADD VALUE IF NOT EXISTS 'PENDING_APPROVAL';
