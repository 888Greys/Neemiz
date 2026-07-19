-- Binary copy trading MVP: opt-in leader → follower mirrors (not a signals shop).

CREATE TYPE "CopyLeaderStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED');
CREATE TYPE "CopyStakeMode" AS ENUM ('FIXED', 'PERCENT_OF_LEADER');
CREATE TYPE "CopySignalStatus" AS ENUM ('PENDING', 'PROCESSING', 'DONE');
CREATE TYPE "CopyFillStatus" AS ENUM ('COPIED', 'SKIPPED', 'FAILED');

CREATE TABLE "copy_leader_profiles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "display_name" TEXT,
    "bio" TEXT,
    "is_public" BOOLEAN NOT NULL DEFAULT true,
    "allowed_families" TEXT NOT NULL DEFAULT 'binary:Even,binary:Odd,directional:RISE_FALL',
    "status" "CopyLeaderStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "copy_leader_profiles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "copy_leader_profiles_user_id_key" ON "copy_leader_profiles"("user_id");
CREATE INDEX "copy_leader_profiles_status_is_public_idx" ON "copy_leader_profiles"("status", "is_public");

CREATE TABLE "copy_follows" (
    "id" TEXT NOT NULL,
    "follower_id" TEXT NOT NULL,
    "leader_id" TEXT NOT NULL,
    "leader_profile_id" TEXT NOT NULL,
    "stake_mode" "CopyStakeMode" NOT NULL DEFAULT 'FIXED',
    "fixed_stake_kes" DECIMAL(18,2) NOT NULL DEFAULT 129,
    "percent" DECIMAL(8,2) NOT NULL DEFAULT 100,
    "max_stake_kes" DECIMAL(18,2) NOT NULL,
    "max_daily_loss_kes" DECIMAL(18,2) NOT NULL,
    "paused" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "copy_follows_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "copy_follows_follower_id_leader_id_key" ON "copy_follows"("follower_id", "leader_id");
CREATE INDEX "copy_follows_leader_id_paused_idx" ON "copy_follows"("leader_id", "paused");
CREATE INDEX "copy_follows_follower_id_idx" ON "copy_follows"("follower_id");

CREATE TABLE "copy_signals" (
    "id" TEXT NOT NULL,
    "leader_id" TEXT NOT NULL,
    "leader_profile_id" TEXT NOT NULL,
    "game" TEXT NOT NULL,
    "leader_trade_id" TEXT NOT NULL,
    "family_token" TEXT NOT NULL,
    "leader_stake" DECIMAL(18,2) NOT NULL,
    "params" JSONB NOT NULL,
    "status" "CopySignalStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "copy_signals_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "copy_signals_game_leader_trade_id_key" ON "copy_signals"("game", "leader_trade_id");
CREATE INDEX "copy_signals_status_created_at_idx" ON "copy_signals"("status", "created_at");

CREATE TABLE "copy_trade_links" (
    "id" TEXT NOT NULL,
    "signal_id" TEXT NOT NULL,
    "follow_id" TEXT NOT NULL,
    "follower_id" TEXT NOT NULL,
    "follower_trade_id" TEXT,
    "game" TEXT NOT NULL,
    "stake" DECIMAL(18,2),
    "status" "CopyFillStatus" NOT NULL,
    "skip_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "copy_trade_links_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "copy_trade_links_signal_id_follow_id_key" ON "copy_trade_links"("signal_id", "follow_id");
CREATE INDEX "copy_trade_links_follower_id_created_at_idx" ON "copy_trade_links"("follower_id", "created_at" DESC);
CREATE INDEX "copy_trade_links_follower_trade_id_idx" ON "copy_trade_links"("follower_trade_id");

ALTER TABLE "copy_leader_profiles" ADD CONSTRAINT "copy_leader_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "copy_follows" ADD CONSTRAINT "copy_follows_follower_id_fkey" FOREIGN KEY ("follower_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "copy_follows" ADD CONSTRAINT "copy_follows_leader_id_fkey" FOREIGN KEY ("leader_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "copy_follows" ADD CONSTRAINT "copy_follows_leader_profile_id_fkey" FOREIGN KEY ("leader_profile_id") REFERENCES "copy_leader_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "copy_signals" ADD CONSTRAINT "copy_signals_leader_id_fkey" FOREIGN KEY ("leader_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "copy_signals" ADD CONSTRAINT "copy_signals_leader_profile_id_fkey" FOREIGN KEY ("leader_profile_id") REFERENCES "copy_leader_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "copy_trade_links" ADD CONSTRAINT "copy_trade_links_signal_id_fkey" FOREIGN KEY ("signal_id") REFERENCES "copy_signals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "copy_trade_links" ADD CONSTRAINT "copy_trade_links_follow_id_fkey" FOREIGN KEY ("follow_id") REFERENCES "copy_follows"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
