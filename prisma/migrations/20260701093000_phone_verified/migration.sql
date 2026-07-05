-- AlterTable: track whether a user's phone number was confirmed via OTP (Twilio Verify)
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "phone_verified" BOOLEAN NOT NULL DEFAULT false;
