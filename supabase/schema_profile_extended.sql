-- ==========================================================================
-- Lighthouse — Extended profile fields (signup / profile)
-- Run AFTER schema_platform.sql
-- ==========================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone_number TEXT,
  ADD COLUMN IF NOT EXISTS date_of_birth DATE,
  ADD COLUMN IF NOT EXISTS gender TEXT,
  ADD COLUMN IF NOT EXISTS occupation TEXT,
  ADD COLUMN IF NOT EXISTS custom_occupation TEXT,
  ADD COLUMN IF NOT EXISTS interests TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS heard_about TEXT,
  ADD COLUMN IF NOT EXISTS short_bio TEXT;

-- Soft constraints (nullable optional fields stay open)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_gender_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_gender_check
      CHECK (gender IS NULL OR gender IN ('Male', 'Female'));
  END IF;
END $$;

-- Enrich auto-profile creation from signup metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  interest_arr TEXT[] := '{}';
BEGIN
  IF NEW.raw_user_meta_data ? 'interests'
     AND jsonb_typeof(NEW.raw_user_meta_data->'interests') = 'array' THEN
    SELECT COALESCE(array_agg(value), '{}')
      INTO interest_arr
    FROM jsonb_array_elements_text(NEW.raw_user_meta_data->'interests') AS t(value);
  END IF;

  INSERT INTO public.profiles (
    id,
    display_name,
    role,
    phone_number,
    date_of_birth,
    gender,
    occupation,
    custom_occupation,
    interests,
    avatar_url,
    heard_about,
    short_bio
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    'user',
    NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'phone_number', '')), ''),
    CASE
      WHEN COALESCE(NEW.raw_user_meta_data->>'date_of_birth', '') ~ '^\d{4}-\d{2}-\d{2}$'
      THEN (NEW.raw_user_meta_data->>'date_of_birth')::date
      ELSE NULL
    END,
    NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'gender', '')), ''),
    NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'occupation', '')), ''),
    NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'custom_occupation', '')), ''),
    COALESCE(interest_arr, '{}'),
    NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'avatar_url', '')), ''),
    NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'heard_about', '')), ''),
    NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'short_bio', '')), '')
  )
  ON CONFLICT (id) DO UPDATE SET
    display_name = COALESCE(EXCLUDED.display_name, public.profiles.display_name),
    phone_number = COALESCE(EXCLUDED.phone_number, public.profiles.phone_number),
    date_of_birth = COALESCE(EXCLUDED.date_of_birth, public.profiles.date_of_birth),
    gender = COALESCE(EXCLUDED.gender, public.profiles.gender),
    occupation = COALESCE(EXCLUDED.occupation, public.profiles.occupation),
    custom_occupation = COALESCE(EXCLUDED.custom_occupation, public.profiles.custom_occupation),
    interests = CASE
      WHEN EXCLUDED.interests IS NOT NULL AND cardinality(EXCLUDED.interests) > 0
      THEN EXCLUDED.interests
      ELSE public.profiles.interests
    END,
    avatar_url = COALESCE(EXCLUDED.avatar_url, public.profiles.avatar_url),
    heard_about = COALESCE(EXCLUDED.heard_about, public.profiles.heard_about),
    short_bio = COALESCE(EXCLUDED.short_bio, public.profiles.short_bio),
    updated_at = now();

  INSERT INTO public.user_preferences (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;
