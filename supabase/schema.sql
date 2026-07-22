-- ==========================================================================
-- Lighthouse — Reflections schema + Row Level Security
-- Run this in: Supabase Dashboard → SQL Editor → New query → Run
-- ==========================================================================

-- Table: reflections
CREATE TABLE IF NOT EXISTS public.reflections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  reflection_text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Helpful indexes
CREATE INDEX IF NOT EXISTS reflections_user_id_idx
  ON public.reflections (user_id);

CREATE INDEX IF NOT EXISTS reflections_user_created_idx
  ON public.reflections (user_id, created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.reflections ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if re-running this script
DROP POLICY IF EXISTS "Users can view their own reflections" ON public.reflections;
DROP POLICY IF EXISTS "Users can create their own reflections" ON public.reflections;
DROP POLICY IF EXISTS "Users can delete their own reflections" ON public.reflections;

-- SELECT: users can only view their own reflections
CREATE POLICY "Users can view their own reflections"
  ON public.reflections
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- INSERT: users can only create reflections for themselves
CREATE POLICY "Users can create their own reflections"
  ON public.reflections
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- DELETE: users can only delete their own reflections
CREATE POLICY "Users can delete their own reflections"
  ON public.reflections
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Optional: no UPDATE policy is created on purpose.
-- Reflections are append-only from the UI (create / read / delete only).
