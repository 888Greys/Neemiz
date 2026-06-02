-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "BetType" AS ENUM ('SINGLE', 'MULTI');

-- CreateEnum
CREATE TYPE "BetStatus" AS ENUM ('PENDING', 'WON', 'LOST', 'VOID', 'CASHED_OUT');

-- CreateEnum
CREATE TYPE "SelectionResult" AS ENUM ('PENDING', 'WON', 'LOST', 'VOID');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('DEPOSIT', 'WITHDRAWAL', 'BET_STAKE', 'BET_WIN', 'BONUS', 'REFUND');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('PENDING', 'PENDING_APPROVAL', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AdSide" AS ENUM ('BUY', 'SELL');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'PAID', 'RELEASED', 'CANCELLED', 'DISPUTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "KycStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "PaymentType" AS ENUM ('MPESA', 'BANK');

-- CreateEnum
CREATE TYPE "DisputeStatus" AS ENUM ('OPEN', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "DepositStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "PolymarketBetStatus" AS ENUM ('PENDING', 'WON', 'LOST', 'VOID');

-- CreateEnum
CREATE TYPE "AviatorRoundState" AS ENUM ('WAITING', 'BETTING', 'FLYING', 'CRASHED');

-- CreateEnum
CREATE TYPE "AviatorBetStatus" AS ENUM ('ACTIVE', 'CASHEDOUT', 'LOST');

-- CreateEnum
CREATE TYPE "ForexTradeDirection" AS ENUM ('BUY', 'SELL');

-- CreateEnum
CREATE TYPE "ForexTradeStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "BinaryTradeStatus" AS ENUM ('PENDING', 'WON', 'LOST');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "supabase_id" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "username" TEXT,
    "first_name" TEXT,
    "last_name" TEXT,
    "image_url" TEXT,
    "wallet_balance" DECIMAL(18,2) NOT NULL DEFAULT 0.00,
    "currency" TEXT NOT NULL DEFAULT 'KES',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_admin" BOOLEAN NOT NULL DEFAULT false,
    "totp_secret" TEXT,
    "totp_enabled" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bets" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "bet_type" "BetType" NOT NULL DEFAULT 'SINGLE',
    "stake" DECIMAL(18,2) NOT NULL,
    "total_odds" DECIMAL(10,4) NOT NULL,
    "potential_win" DECIMAL(18,2) NOT NULL,
    "status" "BetStatus" NOT NULL DEFAULT 'PENDING',
    "settled_at" TIMESTAMP(3),
    "win_amount" DECIMAL(18,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bet_selections" (
    "id" TEXT NOT NULL,
    "bet_id" TEXT NOT NULL,
    "fixture_id" TEXT NOT NULL,
    "match_name" TEXT NOT NULL,
    "market" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "odds" DECIMAL(10,4) NOT NULL,
    "result" "SelectionResult" NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "bet_selections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" "TransactionType" NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'KES',
    "status" "TransactionStatus" NOT NULL DEFAULT 'PENDING',
    "reference" TEXT,
    "provider" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "merchant_profiles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "is_online" BOOLEAN NOT NULL DEFAULT false,
    "total_trades" INTEGER NOT NULL DEFAULT 0,
    "completed_trades" INTEGER NOT NULL DEFAULT 0,
    "completion_rate" DECIMAL(5,2) NOT NULL DEFAULT 100,
    "avg_release_time" INTEGER NOT NULL DEFAULT 0,
    "kyc_status" "KycStatus" NOT NULL DEFAULT 'PENDING',
    "kyc_document_url" TEXT,
    "kyc_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "merchant_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "p2p_payment_methods" (
    "id" TEXT NOT NULL,
    "merchant_id" TEXT NOT NULL,
    "type" "PaymentType" NOT NULL,
    "name" TEXT NOT NULL,
    "account_name" TEXT NOT NULL,
    "account_no" TEXT NOT NULL,
    "bank_name" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "p2p_payment_methods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "p2p_crypto_balances" (
    "id" TEXT NOT NULL,
    "merchant_id" TEXT NOT NULL,
    "crypto" TEXT NOT NULL,
    "total" DECIMAL(18,8) NOT NULL DEFAULT 0,
    "locked" DECIMAL(18,8) NOT NULL DEFAULT 0,
    "available" DECIMAL(18,8) NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "p2p_crypto_balances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "p2p_ads" (
    "id" TEXT NOT NULL,
    "merchant_id" TEXT NOT NULL,
    "side" "AdSide" NOT NULL,
    "crypto" TEXT NOT NULL,
    "fiat" TEXT NOT NULL DEFAULT 'KES',
    "price_per_unit" DECIMAL(18,2) NOT NULL,
    "total_amount" DECIMAL(18,8) NOT NULL,
    "available_amount" DECIMAL(18,8) NOT NULL,
    "min_limit" DECIMAL(18,2) NOT NULL,
    "max_limit" DECIMAL(18,2) NOT NULL,
    "payment_methods" TEXT[],
    "payment_window" INTEGER NOT NULL DEFAULT 15,
    "terms" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "p2p_ads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "p2p_orders" (
    "id" TEXT NOT NULL,
    "ad_id" TEXT NOT NULL,
    "buyer_id" TEXT NOT NULL,
    "seller_id" TEXT NOT NULL,
    "crypto" TEXT NOT NULL,
    "crypto_amount" DECIMAL(18,8) NOT NULL,
    "fiat_amount" DECIMAL(18,2) NOT NULL,
    "price_per_unit" DECIMAL(18,2) NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "payment_method" TEXT NOT NULL,
    "payment_ref" TEXT,
    "payment_proof_url" TEXT,
    "paid_at" TIMESTAMP(3),
    "escrow_released" BOOLEAN NOT NULL DEFAULT false,
    "released_at" TIMESTAMP(3),
    "cancelled_by" TEXT,
    "cancel_reason" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "p2p_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "p2p_messages" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "sender_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "image_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "p2p_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "p2p_disputes" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "raised_by_id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "evidence" TEXT,
    "status" "DisputeStatus" NOT NULL DEFAULT 'OPEN',
    "resolution" TEXT,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "p2p_disputes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "link" TEXT,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "p2p_crypto_deposits" (
    "id" TEXT NOT NULL,
    "merchant_id" TEXT NOT NULL,
    "crypto" TEXT NOT NULL,
    "amount" DECIMAL(18,8) NOT NULL,
    "tx_hash" TEXT,
    "network" TEXT NOT NULL DEFAULT 'TRC20',
    "status" "DepositStatus" NOT NULL DEFAULT 'PENDING',
    "admin_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "p2p_crypto_deposits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_crypto_balances" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "crypto" TEXT NOT NULL,
    "network" TEXT NOT NULL DEFAULT 'TRC20',
    "available" DECIMAL(18,8) NOT NULL DEFAULT 0,
    "locked" DECIMAL(18,8) NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_crypto_balances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crypto_deposit_addresses" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "crypto" TEXT NOT NULL,
    "network" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "hd_index" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crypto_deposit_addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "polymarket_bets" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "market_id" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "price" DECIMAL(10,6) NOT NULL,
    "stake" DECIMAL(18,2) NOT NULL,
    "potential_win" DECIMAL(18,2) NOT NULL,
    "status" "PolymarketBetStatus" NOT NULL DEFAULT 'PENDING',
    "settled_at" TIMESTAMP(3),
    "win_amount" DECIMAL(18,2),
    "execution_mode" TEXT NOT NULL DEFAULT 'internal',
    "clob_order_id" TEXT,
    "clob_status" TEXT,
    "clob_token_id" TEXT,
    "clob_trade_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "clob_tx_hashes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "clob_raw" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "polymarket_bets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aviator_rounds" (
    "id" TEXT NOT NULL,
    "roundNumber" SERIAL NOT NULL,
    "server_seed" TEXT NOT NULL,
    "server_seed_hash" TEXT NOT NULL,
    "crash_point" DECIMAL(10,2) NOT NULL,
    "state" "AviatorRoundState" NOT NULL DEFAULT 'WAITING',
    "betting_ends_at" TIMESTAMP(3),
    "flying_started_at" TIMESTAMP(3),
    "crashed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "aviator_rounds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aviator_bets" (
    "id" TEXT NOT NULL,
    "round_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "panel_index" INTEGER NOT NULL DEFAULT 0,
    "bet_amount" DECIMAL(10,2) NOT NULL,
    "auto_cashout" DECIMAL(10,2),
    "cashout_at" DECIMAL(10,2),
    "win_amount" DECIMAL(10,2),
    "status" "AviatorBetStatus" NOT NULL DEFAULT 'ACTIVE',
    "placed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "aviator_bets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "forex_trades" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "direction" "ForexTradeDirection" NOT NULL,
    "size" INTEGER NOT NULL,
    "entry_price" DECIMAL(12,6) NOT NULL,
    "close_price" DECIMAL(12,6),
    "stop_loss" DECIMAL(12,6) NOT NULL,
    "take_profit" DECIMAL(12,6) NOT NULL,
    "precision" INTEGER NOT NULL DEFAULT 5,
    "margin" DECIMAL(18,2) NOT NULL,
    "profit_loss" DECIMAL(18,2),
    "status" "ForexTradeStatus" NOT NULL DEFAULT 'OPEN',
    "opened_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMP(3),

    CONSTRAINT "forex_trades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "binary_trades" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "market" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "stake" DECIMAL(18,2) NOT NULL,
    "payout" DECIMAL(18,2) NOT NULL,
    "target_digit" INTEGER NOT NULL,
    "entry_digit" INTEGER NOT NULL,
    "exit_digit" INTEGER,
    "duration_ticks" INTEGER NOT NULL,
    "settle_before" TIMESTAMP(3) NOT NULL,
    "status" "BinaryTradeStatus" NOT NULL DEFAULT 'PENDING',
    "settled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "binary_trades_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_supabase_id_key" ON "users"("supabase_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_reference_key" ON "transactions"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "merchant_profiles_user_id_key" ON "merchant_profiles"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "p2p_crypto_balances_merchant_id_crypto_key" ON "p2p_crypto_balances"("merchant_id", "crypto");

-- CreateIndex
CREATE UNIQUE INDEX "p2p_disputes_order_id_key" ON "p2p_disputes"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_crypto_balances_user_id_crypto_network_key" ON "user_crypto_balances"("user_id", "crypto", "network");

-- CreateIndex
CREATE UNIQUE INDEX "crypto_deposit_addresses_user_id_crypto_network_key" ON "crypto_deposit_addresses"("user_id", "crypto", "network");

-- CreateIndex
CREATE UNIQUE INDEX "aviator_rounds_roundNumber_key" ON "aviator_rounds"("roundNumber");

-- CreateIndex
CREATE UNIQUE INDEX "aviator_bets_round_id_user_id_panel_index_key" ON "aviator_bets"("round_id", "user_id", "panel_index");

-- AddForeignKey
ALTER TABLE "bets" ADD CONSTRAINT "bets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bet_selections" ADD CONSTRAINT "bet_selections_bet_id_fkey" FOREIGN KEY ("bet_id") REFERENCES "bets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merchant_profiles" ADD CONSTRAINT "merchant_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "p2p_payment_methods" ADD CONSTRAINT "p2p_payment_methods_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "merchant_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "p2p_crypto_balances" ADD CONSTRAINT "p2p_crypto_balances_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "merchant_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "p2p_ads" ADD CONSTRAINT "p2p_ads_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "merchant_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "p2p_orders" ADD CONSTRAINT "p2p_orders_ad_id_fkey" FOREIGN KEY ("ad_id") REFERENCES "p2p_ads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "p2p_orders" ADD CONSTRAINT "p2p_orders_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "p2p_orders" ADD CONSTRAINT "p2p_orders_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "merchant_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "p2p_messages" ADD CONSTRAINT "p2p_messages_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "p2p_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "p2p_messages" ADD CONSTRAINT "p2p_messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "p2p_disputes" ADD CONSTRAINT "p2p_disputes_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "p2p_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "p2p_crypto_deposits" ADD CONSTRAINT "p2p_crypto_deposits_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "merchant_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_crypto_balances" ADD CONSTRAINT "user_crypto_balances_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crypto_deposit_addresses" ADD CONSTRAINT "crypto_deposit_addresses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "polymarket_bets" ADD CONSTRAINT "polymarket_bets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aviator_bets" ADD CONSTRAINT "aviator_bets_round_id_fkey" FOREIGN KEY ("round_id") REFERENCES "aviator_rounds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aviator_bets" ADD CONSTRAINT "aviator_bets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forex_trades" ADD CONSTRAINT "forex_trades_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "binary_trades" ADD CONSTRAINT "binary_trades_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

