-- ==========================================================================
-- Lighthouse — Guided journey v2 (5 scenarios/day + behavioral activities)
-- Run AFTER schema_platform.sql (and ideally schema_care.sql)
-- Then run seed_scenarios_extended.sql
-- ==========================================================================

-- --------------------------------------------------------------------------
-- 1) Allow up to 5 scenario responses per user per day (slot 1–5)
-- --------------------------------------------------------------------------
ALTER TABLE public.scenario_responses
  ADD COLUMN IF NOT EXISTS slot INTEGER;

UPDATE public.scenario_responses
SET slot = 1
WHERE slot IS NULL;

ALTER TABLE public.scenario_responses
  ALTER COLUMN slot SET DEFAULT 1;

DO $$
BEGIN
  -- Drop legacy one-per-day unique if present
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'scenario_responses_user_id_response_date_key'
  ) THEN
    ALTER TABLE public.scenario_responses
      DROP CONSTRAINT scenario_responses_user_id_response_date_key;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'scenario_responses_user_date_slot_key'
  ) THEN
    ALTER TABLE public.scenario_responses
      ADD CONSTRAINT scenario_responses_user_date_slot_key
      UNIQUE (user_id, response_date, slot);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'scenario_responses_slot_check'
  ) THEN
    ALTER TABLE public.scenario_responses
      ADD CONSTRAINT scenario_responses_slot_check
      CHECK (slot BETWEEN 1 AND 5);
  END IF;
END $$;

ALTER TABLE public.scenario_responses
  ALTER COLUMN slot SET NOT NULL;

-- --------------------------------------------------------------------------
-- 2) Daily assigned scenarios (5 unique picks per user per day)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.daily_scenario_picks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  pick_date DATE NOT NULL DEFAULT (CURRENT_DATE),
  slot INTEGER NOT NULL CHECK (slot BETWEEN 1 AND 5),
  scenario_id UUID NOT NULL REFERENCES public.scenario_bank (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, pick_date, slot),
  UNIQUE (user_id, pick_date, scenario_id)
);

CREATE INDEX IF NOT EXISTS daily_scenario_picks_user_date_idx
  ON public.daily_scenario_picks (user_id, pick_date);

ALTER TABLE public.daily_scenario_picks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own scenario picks" ON public.daily_scenario_picks;
DROP POLICY IF EXISTS "Users can create their own scenario picks" ON public.daily_scenario_picks;

CREATE POLICY "Users can view their own scenario picks"
  ON public.daily_scenario_picks FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own scenario picks"
  ON public.daily_scenario_picks FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- --------------------------------------------------------------------------
-- 3) Behavioral activity results
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.behavioral_activity_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL CHECK (
    activity_type IN ('memory', 'word_puzzle', 'reaction')
    OR activity_type ~ '^[a-z][a-z0-9_]{1,40}$'
  ),
  activity_date DATE NOT NULL DEFAULT (CURRENT_DATE),
  score NUMERIC NULL,
  accuracy NUMERIC NULL,
  completion_time NUMERIC NULL,
  attempts INTEGER NULL DEFAULT 1,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS behavioral_activity_results_user_date_idx
  ON public.behavioral_activity_results (user_id, activity_date DESC);

CREATE INDEX IF NOT EXISTS behavioral_activity_results_user_type_idx
  ON public.behavioral_activity_results (user_id, activity_type, activity_date DESC);

ALTER TABLE public.behavioral_activity_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own activity results" ON public.behavioral_activity_results;
DROP POLICY IF EXISTS "Users can create their own activity results" ON public.behavioral_activity_results;
DROP POLICY IF EXISTS "Users can delete their own activity results" ON public.behavioral_activity_results;

CREATE POLICY "Users can view their own activity results"
  ON public.behavioral_activity_results FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own activity results"
  ON public.behavioral_activity_results FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own activity results"
  ON public.behavioral_activity_results FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- One completed result per activity type per day (journey step)
CREATE UNIQUE INDEX IF NOT EXISTS behavioral_activity_one_per_day_idx
  ON public.behavioral_activity_results (user_id, activity_type, activity_date);
