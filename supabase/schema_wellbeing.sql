-- ==========================================================================
-- Lighthouse — Daily wellbeing features (v2)
-- Run AFTER reflections schema (or together) in Supabase SQL Editor
-- ==========================================================================

-- --------------------------------------------------------------------------
-- 1) daily_checkins
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.daily_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  checkin_date DATE NOT NULL DEFAULT (CURRENT_DATE),
  sleep_hours NUMERIC(4,1) NOT NULL CHECK (sleep_hours >= 0 AND sleep_hours <= 12),
  mood TEXT NOT NULL CHECK (mood IN ('Very Low', 'Low', 'Neutral', 'Good', 'Excellent')),
  energy_level INTEGER NOT NULL CHECK (energy_level BETWEEN 1 AND 5),
  productivity INTEGER NOT NULL CHECK (productivity BETWEEN 1 AND 5),
  physical_activity TEXT NOT NULL CHECK (physical_activity IN ('None', 'Light', 'Moderate', 'High')),
  water_intake TEXT NULL,
  notes TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, checkin_date)
);

CREATE INDEX IF NOT EXISTS daily_checkins_user_date_idx
  ON public.daily_checkins (user_id, checkin_date DESC);

ALTER TABLE public.daily_checkins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own checkins" ON public.daily_checkins;
DROP POLICY IF EXISTS "Users can create their own checkins" ON public.daily_checkins;
DROP POLICY IF EXISTS "Users can update their own checkins" ON public.daily_checkins;
DROP POLICY IF EXISTS "Users can delete their own checkins" ON public.daily_checkins;

CREATE POLICY "Users can view their own checkins"
  ON public.daily_checkins FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own checkins"
  ON public.daily_checkins FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own checkins"
  ON public.daily_checkins FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own checkins"
  ON public.daily_checkins FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- --------------------------------------------------------------------------
-- 2) scenario_bank (shared catalog — readable by authenticated users)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.scenario_bank (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  story TEXT NOT NULL,
  question TEXT NOT NULL,
  option_a TEXT NOT NULL,
  option_b TEXT NOT NULL,
  option_c TEXT NOT NULL,
  option_d TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.scenario_bank ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read scenarios" ON public.scenario_bank;
CREATE POLICY "Authenticated users can read scenarios"
  ON public.scenario_bank FOR SELECT TO authenticated
  USING (true);

-- Seed ~20 scenarios (idempotent: only insert when empty)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.scenario_bank LIMIT 1) THEN
    INSERT INTO public.scenario_bank
      (title, category, story, question, option_a, option_b, option_c, option_d)
    VALUES
    (
      'Assignment Crunch',
      'Academic Pressure',
      'A university student has several assignments due tomorrow but has spent the evening scrolling through social media.',
      'What would you most likely do?',
      'Break the work into smaller tasks and start with one.',
      'Continue scrolling and hope it works out.',
      'Ask a classmate or friend for help organizing priorities.',
      'Leave everything until tomorrow morning.'
    ),
    (
      'Crowded Calendar',
      'Time Management',
      'Your week is packed with meetings, classes, and personal errands. You notice you have not planned any buffer time.',
      'What would you most likely do?',
      'Block short recovery breaks between commitments.',
      'Keep the schedule as-is and push through.',
      'Cancel one lower-priority item to create space.',
      'Ignore the overload and decide later.'
    ),
    (
      'Late Night Scroll',
      'Sleep Habits',
      'It is past midnight and you are still on your phone, even though you need to wake up early.',
      'What would you most likely do?',
      'Put the phone away and prepare for sleep now.',
      'Tell yourself “just ten more minutes.”',
      'Set an alarm reminder for a wind-down routine tomorrow.',
      'Stay up as long as you feel awake.'
    ),
    (
      'Motivation Dip',
      'Motivation',
      'You planned to work on a personal project, but you feel unmotivated and keep postponing the start.',
      'What would you most likely do?',
      'Start with a five-minute easy task to get moving.',
      'Wait until inspiration arrives.',
      'Ask a friend to check in with you later.',
      'Drop the project for the week.'
    ),
    (
      'Unclear Message',
      'Communication',
      'A teammate sends a vague message that could be read as criticism. You are unsure of their intent.',
      'What would you most likely do?',
      'Ask a clarifying question calmly.',
      'Assume the worst and reply defensively.',
      'Ignore the message for now.',
      'Talk about it with someone else instead of them.'
    ),
    (
      'Group Disagreement',
      'Conflict Resolution',
      'During a group project, two members disagree strongly about the approach and the mood turns tense.',
      'What would you most likely do?',
      'Suggest a short pause and list pros/cons of each option.',
      'Take one side immediately to end the debate.',
      'Leave the conversation and stay quiet.',
      'Propose flipping a coin and moving on.'
    ),
    (
      'Invitation Dilemma',
      'Social Interaction',
      'Friends invite you out, but you feel low-energy after a long day and are unsure whether to go.',
      'What would you most likely do?',
      'Suggest a shorter or quieter alternative plan.',
      'Go anyway to avoid disappointing anyone.',
      'Decline politely and rest tonight.',
      'Leave the invitation unanswered.'
    ),
    (
      'Weekend Balance',
      'Lifestyle Balance',
      'Your weekend is filled with chores and leftover work, with little time left for rest or hobbies.',
      'What would you most likely do?',
      'Schedule one protected block for rest or a hobby.',
      'Use the whole weekend to catch up on tasks.',
      'Skip chores and only rest.',
      'Decide spontaneously without a plan.'
    ),
    (
      'Two Good Options',
      'Decision Making',
      'You have two appealing opportunities but can only choose one, and the deadline is approaching.',
      'What would you most likely do?',
      'List values and constraints, then choose deliberately.',
      'Pick the option friends recommend.',
      'Delay until the last possible moment.',
      'Try to keep both somehow.'
    ),
    (
      'Skipped Self-care',
      'Self-care',
      'You realize you have skipped meals and breaks while trying to finish a busy day.',
      'What would you most likely do?',
      'Pause for a short meal/break before continuing.',
      'Push through until everything is done.',
      'Promise to “make up for it tomorrow.”',
      'Feel guilty and stop working entirely.'
    ),
    (
      'Exam Week Fog',
      'Academic Pressure',
      'Exam week is close and your notes feel messy. You are unsure where to begin studying.',
      'What would you most likely do?',
      'Create a simple priority list for the toughest topics first.',
      'Reread everything from the beginning.',
      'Study only what friends are studying.',
      'Avoid studying until you feel ready.'
    ),
    (
      'Notification Avalanche',
      'Time Management',
      'Your phone keeps buzzing with notifications while you are trying to finish focused work.',
      'What would you most likely do?',
      'Silence notifications for a focused block.',
      'Answer each notification immediately.',
      'Keep the phone nearby “just in case.”',
      'Stop working and browse for a while.'
    ),
    (
      'Inconsistent Sleep',
      'Sleep Habits',
      'Your sleep times have drifted later each night this week, and mornings feel harder.',
      'What would you most likely do?',
      'Set a consistent wind-down and bedtime tonight.',
      'Catch up with a long nap tomorrow instead.',
      'Drink more caffeine to compensate.',
      'Accept irregular sleep as normal right now.'
    ),
    (
      'Half-finished Goals',
      'Motivation',
      'You have several half-finished goals and feel stuck switching between them.',
      'What would you most likely do?',
      'Pick one small goal and finish a next step today.',
      'Start a brand-new goal for motivation.',
      'Abandon all current goals.',
      'Make a huge plan but take no action yet.'
    ),
    (
      'Feedback Moment',
      'Communication',
      'Someone asks for honest feedback on their work, and you notice both strengths and weak spots.',
      'What would you most likely do?',
      'Share balanced feedback with specific examples.',
      'Only praise to keep things comfortable.',
      'Only point out problems.',
      'Avoid giving feedback altogether.'
    ),
    (
      'Missed Deadline Friction',
      'Conflict Resolution',
      'A collaborator missed a deadline that affects your work. You feel frustrated.',
      'What would you most likely do?',
      'Discuss impact and agree on a revised plan.',
      'Complain to others without talking to them.',
      'Do their work yourself without saying anything.',
      'End the collaboration immediately.'
    ),
    (
      'Quiet Gathering',
      'Social Interaction',
      'At a gathering, conversation slows and you feel awkward in the silence.',
      'What would you most likely do?',
      'Ask an open question to restart conversation.',
      'Leave the group without explanation.',
      'Stay silent and wait for someone else.',
      'Check your phone to avoid the moment.'
    ),
    (
      'Always On',
      'Lifestyle Balance',
      'You notice most evenings are spent responding to messages and unfinished tasks.',
      'What would you most likely do?',
      'Set an evening cutoff for work messages.',
      'Stay available in case something important appears.',
      'Delete apps temporarily.',
      'Keep going until you burn out.'
    ),
    (
      'Trade-off Choice',
      'Decision Making',
      'You can attend an important event, but it conflicts with needed rest before a demanding day.',
      'What would you most likely do?',
      'Choose based on which need is more critical right now.',
      'Attend and ignore the rest impact.',
      'Skip the event and feel resentful.',
      'Ask someone else to decide for you.'
    ),
    (
      'Gentle Reset',
      'Self-care',
      'After a stressful afternoon, you have thirty free minutes before your next commitment.',
      'What would you most likely do?',
      'Use the time for a short restorative break.',
      'Squeeze in more tasks immediately.',
      'Replay the stressful moments mentally.',
      'Scroll without noticing the time pass.'
    );
  END IF;
END $$;

-- --------------------------------------------------------------------------
-- 3) scenario_responses
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.scenario_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  scenario_id UUID NOT NULL REFERENCES public.scenario_bank (id) ON DELETE CASCADE,
  selected_option TEXT NOT NULL CHECK (selected_option IN ('A', 'B', 'C', 'D')),
  response_date DATE NOT NULL DEFAULT (CURRENT_DATE),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, response_date)
);

CREATE INDEX IF NOT EXISTS scenario_responses_user_date_idx
  ON public.scenario_responses (user_id, response_date DESC);

ALTER TABLE public.scenario_responses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own scenario responses" ON public.scenario_responses;
DROP POLICY IF EXISTS "Users can create their own scenario responses" ON public.scenario_responses;
DROP POLICY IF EXISTS "Users can delete their own scenario responses" ON public.scenario_responses;

CREATE POLICY "Users can view their own scenario responses"
  ON public.scenario_responses FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own scenario responses"
  ON public.scenario_responses FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own scenario responses"
  ON public.scenario_responses FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- --------------------------------------------------------------------------
-- 4) visual_reflections
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.visual_reflections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  image_category TEXT NOT NULL,
  optional_note TEXT NULL,
  reflection_date DATE NOT NULL DEFAULT (CURRENT_DATE),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, reflection_date)
);

CREATE INDEX IF NOT EXISTS visual_reflections_user_date_idx
  ON public.visual_reflections (user_id, reflection_date DESC);

ALTER TABLE public.visual_reflections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own visual reflections" ON public.visual_reflections;
DROP POLICY IF EXISTS "Users can create their own visual reflections" ON public.visual_reflections;
DROP POLICY IF EXISTS "Users can update their own visual reflections" ON public.visual_reflections;
DROP POLICY IF EXISTS "Users can delete their own visual reflections" ON public.visual_reflections;

CREATE POLICY "Users can view their own visual reflections"
  ON public.visual_reflections FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own visual reflections"
  ON public.visual_reflections FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own visual reflections"
  ON public.visual_reflections FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own visual reflections"
  ON public.visual_reflections FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
