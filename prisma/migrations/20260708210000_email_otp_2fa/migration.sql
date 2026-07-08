-- Email OTP as an alternative user 2FA method (choose authenticator app OR email code).
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email_otp_enabled" BOOLEAN NOT NULL DEFAULT false;
