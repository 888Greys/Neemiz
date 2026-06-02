-- AddColumn: featured flag on p2p_ads for promoted/paid placement.
ALTER TABLE "p2p_ads"
    ADD COLUMN IF NOT EXISTS "featured" BOOLEAN NOT NULL DEFAULT false;
