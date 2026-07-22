-- ==========================================================================
-- Lighthouse — Moderate care workflow (notes, nudges, watchlist)
-- Run AFTER schema_platform.sql
-- ==========================================================================

-- Watchlist: on watch until this timestamp (null = not monitoring)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS monitoring_until TIMESTAMPTZ;

-- Internal admin notes (never shown to the user)
CREATE TABLE IF NOT EXISTS public.admin_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  admin_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  note TEXT NOT NULL CHECK (char_length(trim(note)) > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_notes_user_created_idx
  ON public.admin_notes (user_id, created_at DESC);

ALTER TABLE public.admin_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage notes" ON public.admin_notes;
CREATE POLICY "Admins manage notes"
  ON public.admin_notes FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Soft nudges shown on the user's dashboard
CREATE TABLE IF NOT EXISTS public.user_nudges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  admin_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  message TEXT NOT NULL CHECK (char_length(trim(message)) > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  dismissed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS user_nudges_user_open_idx
  ON public.user_nudges (user_id, created_at DESC)
  WHERE dismissed_at IS NULL;

ALTER TABLE public.user_nudges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage nudges" ON public.user_nudges;
CREATE POLICY "Admins manage nudges"
  ON public.user_nudges FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Users read own nudges" ON public.user_nudges;
CREATE POLICY "Users read own nudges"
  ON public.user_nudges FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users dismiss own nudges" ON public.user_nudges;
CREATE POLICY "Users dismiss own nudges"
  ON public.user_nudges FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
