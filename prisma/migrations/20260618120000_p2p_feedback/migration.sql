CREATE TABLE IF NOT EXISTS public.p2p_feedback (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES public.p2p_orders(id) ON DELETE CASCADE,
  from_user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  to_user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL,
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT p2p_feedback_rating_check CHECK (rating >= 1 AND rating <= 5)
);

CREATE UNIQUE INDEX IF NOT EXISTS p2p_feedback_order_id_from_user_id_key
  ON public.p2p_feedback (order_id, from_user_id);

CREATE INDEX IF NOT EXISTS p2p_feedback_to_user_id_created_at_idx
  ON public.p2p_feedback (to_user_id, created_at DESC);

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.p2p_orders;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;
