-- P2P hardening (2026-07-20): buyer↔seller ring signals detected at order
-- creation. Any stored flag forces admin review at release time.
-- NULL = not evaluated (orders created before this column existed).
ALTER TABLE "p2p_orders" ADD COLUMN "risk_flags" JSONB;
