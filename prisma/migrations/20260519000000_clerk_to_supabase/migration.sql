-- Rename clerk_id → supabase_id in users table
ALTER TABLE "users" RENAME COLUMN "clerk_id" TO "supabase_id";
