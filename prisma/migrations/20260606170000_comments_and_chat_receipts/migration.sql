CREATE TABLE IF NOT EXISTS public.polymarket_comments (
  id TEXT PRIMARY KEY,
  market_id TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS polymarket_comments_market_id_created_at_idx
  ON public.polymarket_comments (market_id, created_at DESC);

CREATE INDEX IF NOT EXISTS polymarket_comments_user_id_created_at_idx
  ON public.polymarket_comments (user_id, created_at DESC);

ALTER TABLE public.p2p_messages
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS p2p_messages_order_id_created_at_idx
  ON public.p2p_messages (order_id, created_at);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'p2p-chat',
  'p2p-chat',
  TRUE,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "p2p chat authenticated uploads" ON storage.objects;
CREATE POLICY "p2p chat authenticated uploads"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'p2p-chat'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "p2p chat owners update" ON storage.objects;
CREATE POLICY "p2p chat owners update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'p2p-chat'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "p2p chat owners delete" ON storage.objects;
CREATE POLICY "p2p chat owners delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'p2p-chat'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.polymarket_comments;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.p2p_messages;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;
