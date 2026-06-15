-- Local-only stubs for the Supabase-managed objects that some migrations touch
-- (storage buckets/objects, the `authenticated` role, auth.uid(), foldername()).
-- On real Supabase these are provided by the platform; on a plain local Postgres
-- they don't exist, so migrations like 20260606170000 fail. This file creates
-- minimal stand-ins so `prisma migrate deploy` succeeds locally. It is NEVER run
-- against production. See LOCAL-DEV.md.

CREATE SCHEMA IF NOT EXISTS storage;
CREATE SCHEMA IF NOT EXISTS auth;

-- Roles referenced by RLS policies (TO authenticated / anon / service_role).
DO $$ BEGIN CREATE ROLE authenticated NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE anon          NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE service_role  NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- storage.buckets — columns cover what migrations INSERT.
CREATE TABLE IF NOT EXISTS storage.buckets (
  id                 TEXT PRIMARY KEY,
  name               TEXT NOT NULL,
  owner              UUID,
  public             BOOLEAN DEFAULT FALSE,
  file_size_limit    BIGINT,
  allowed_mime_types TEXT[],
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW()
);

-- storage.objects — columns cover what RLS policies reference (bucket_id, name).
CREATE TABLE IF NOT EXISTS storage.objects (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  bucket_id  TEXT REFERENCES storage.buckets(id),
  name       TEXT,
  owner      UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- auth.uid() — Supabase returns the current user's uuid; locally a null is fine
-- (RLS isn't enforced in dev because we bypass Supabase auth).
CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID LANGUAGE SQL STABLE AS $$
  SELECT NULL::UUID;
$$;

-- storage.foldername() — splits an object path into folder segments.
CREATE OR REPLACE FUNCTION storage.foldername(name TEXT) RETURNS TEXT[] LANGUAGE SQL IMMUTABLE AS $$
  SELECT string_to_array($1, '/');
$$;
