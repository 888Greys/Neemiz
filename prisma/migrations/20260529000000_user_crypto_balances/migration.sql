-- CreateTable: user_crypto_balances
-- Tracks the actual crypto deposited per user (separate from KES betting wallet)

CREATE TABLE "user_crypto_balances" (
    "id"         TEXT NOT NULL,
    "user_id"    TEXT NOT NULL,
    "crypto"     TEXT NOT NULL,
    "network"    TEXT NOT NULL DEFAULT 'TRC20',
    "available"  DECIMAL(18,8) NOT NULL DEFAULT 0,
    "locked"     DECIMAL(18,8) NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_crypto_balances_pkey" PRIMARY KEY ("id")
);

-- UniqueConstraint
CREATE UNIQUE INDEX "user_crypto_balances_user_id_crypto_network_key"
    ON "user_crypto_balances"("user_id", "crypto", "network");

-- ForeignKey
ALTER TABLE "user_crypto_balances"
    ADD CONSTRAINT "user_crypto_balances_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
