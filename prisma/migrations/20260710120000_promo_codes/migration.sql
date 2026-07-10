-- Redeemable promo / welcome codes (credit main KES wallet).

CREATE TABLE "promo_codes" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "amount_kes" DECIMAL(18,2) NOT NULL,
    "max_redemptions" INTEGER,
    "redemption_count" INTEGER NOT NULL DEFAULT 0,
    "starts_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "promo_codes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "promo_codes_code_key" ON "promo_codes"("code");

CREATE TABLE "promo_redemptions" (
    "id" TEXT NOT NULL,
    "promo_code_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "amount_kes" DECIMAL(18,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "promo_redemptions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "promo_redemptions_promo_code_id_user_id_key" ON "promo_redemptions"("promo_code_id", "user_id");
CREATE INDEX "promo_redemptions_user_id_idx" ON "promo_redemptions"("user_id");

ALTER TABLE "promo_redemptions" ADD CONSTRAINT "promo_redemptions_promo_code_id_fkey" FOREIGN KEY ("promo_code_id") REFERENCES "promo_codes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "promo_redemptions" ADD CONSTRAINT "promo_redemptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Default welcome code: KSh 50, one redeem per user.
INSERT INTO "promo_codes" ("id", "code", "amount_kes", "max_redemptions", "redemption_count", "is_active", "description", "created_at", "updated_at")
VALUES (
  'promo_nezeem400',
  'NEZEEM400',
  50.00,
  NULL,
  0,
  true,
  'Welcome bonus — KSh 50',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);
