CREATE INDEX IF NOT EXISTS "transactions_user_id_created_at_idx"
ON "transactions" ("user_id", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "notifications_user_id_created_at_idx"
ON "notifications" ("user_id", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "notifications_user_id_is_read_created_at_idx"
ON "notifications" ("user_id", "is_read", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "p2p_ads_browse_idx"
ON "p2p_ads" ("is_active", "side", "crypto", "fiat", "featured" DESC, "created_at" DESC);

CREATE INDEX IF NOT EXISTS "p2p_ads_merchant_id_created_at_idx"
ON "p2p_ads" ("merchant_id", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "p2p_orders_buyer_id_created_at_idx"
ON "p2p_orders" ("buyer_id", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "p2p_orders_seller_id_created_at_idx"
ON "p2p_orders" ("seller_id", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "p2p_orders_status_expires_at_idx"
ON "p2p_orders" ("status", "expires_at");

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE "notifications";
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;
