-- ==========================================================================
-- Lighthouse — Platform features (profiles, preferences, admin, scenarios)
-- Run AFTER schema.sql and schema_wellbeing.sql
-- ==========================================================================

-- Profiles (roles + display info)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  account_status TEXT NOT NULL DEFAULT 'active' CHECK (account_status IN ('active', 'inactive', 'suspended')),
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS profiles_role_idx ON public.profiles (role);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Preferences
CREATE TABLE IF NOT EXISTS public.user_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  theme TEXT NOT NULL DEFAULT 'light' CHECK (theme IN ('light', 'dark')),
  notifications_enabled BOOLEAN NOT NULL DEFAULT true,
  privacy_mode TEXT NOT NULL DEFAULT 'private' CHECK (privacy_mode IN ('private', 'anonymous_analytics')),
  language TEXT NOT NULL DEFAULT 'en',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

-- Scenario bank: enable/disable
ALTER TABLE public.scenario_bank
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- Helper: is current user an admin?
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role = 'admin'
  );
$$;

-- Auto-create profile + preferences on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    'user'
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_preferences (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill profiles for existing users
INSERT INTO public.profiles (id, display_name, role)
SELECT
  u.id,
  COALESCE(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1)),
  'user'
FROM auth.users u
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_preferences (user_id)
SELECT u.id FROM auth.users u
ON CONFLICT (user_id) DO NOTHING;

-- -------------------------- Profiles RLS ----------------------------------
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;

CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = id OR public.is_admin());

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND role = (SELECT role FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "Admins can update all profiles"
  ON public.profiles FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- -------------------------- Preferences RLS -------------------------------
DROP POLICY IF EXISTS "Users manage own preferences" ON public.user_preferences;
DROP POLICY IF EXISTS "Users insert own preferences" ON public.user_preferences;

CREATE POLICY "Users manage own preferences"
  ON public.user_preferences FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own preferences"
  ON public.user_preferences FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own preferences"
  ON public.user_preferences FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Allow admins to read wellbeing tables for monitoring (no journal text exposure in UI)
DROP POLICY IF EXISTS "Admins can view all checkins" ON public.daily_checkins;
CREATE POLICY "Admins can view all checkins"
  ON public.daily_checkins FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Admins can view all reflections meta" ON public.reflections;
CREATE POLICY "Admins can view all reflections meta"
  ON public.reflections FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Admins can view all scenario responses" ON public.scenario_responses;
CREATE POLICY "Admins can view all scenario responses"
  ON public.scenario_responses FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Admins can view all visual reflections" ON public.visual_reflections;
CREATE POLICY "Admins can view all visual reflections"
  ON public.visual_reflections FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_admin());

-- Scenario bank admin write access
DROP POLICY IF EXISTS "Admins manage scenarios" ON public.scenario_bank;
CREATE POLICY "Admins manage scenarios"
  ON public.scenario_bank FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Keep existing authenticated read for active scenarios (users)
-- Users already have SELECT true; they should filter is_active in app.

-- NOTE: Promote your account to admin manually after signup:
--   UPDATE public.profiles SET role = 'admin' WHERE id = '<your-user-uuid>';
-- Find your UUID in Authentication → Users.
