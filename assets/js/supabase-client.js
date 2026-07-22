/* ==========================================================================
   Lighthouse — Supabase client + domain helpers
   Requires: config.js, @supabase/supabase-js (CDN)
   Extends existing auth + reflections with check-ins, scenarios, visual flow
   ========================================================================== */
(function (global) {
  'use strict';

  const cfg = global.LIGHTHOUSE_CONFIG || {};
  const url = (cfg.SUPABASE_URL || '').trim();
  const key = (cfg.SUPABASE_ANON_KEY || '').trim();

  const isConfigured =
    url &&
    key &&
    !url.includes('YOUR_SUPABASE') &&
    !key.includes('YOUR_SUPABASE');

  let client = null;

  const MOODS = ['Very Low', 'Low', 'Neutral', 'Good', 'Excellent'];
  const ACTIVITIES = ['None', 'Light', 'Moderate', 'High'];
  const MOOD_SCORES = { 'Very Low': 1, Low: 2, Neutral: 3, Good: 4, Excellent: 5 };
  const ACTIVITY_SCORES = { None: 1, Light: 2, Moderate: 3, High: 4 };

  const VISUAL_OPTIONS = [
    {
      id: 'ocean',
      title: 'Calm',
      label: 'Ocean',
      image: 'https://images.unsplash.com/photo-1505142468610-359e7d316be0?auto=format&fit=crop&w=800&q=80',
    },
    {
      id: 'forest',
      title: 'Peaceful',
      label: 'Forest',
      image: 'https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=800&q=80',
    },
    {
      id: 'mountain',
      title: 'Hopeful',
      label: 'Mountain',
      image: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=800&q=80',
    },
    {
      id: 'rain',
      title: 'Reflective',
      label: 'Rain',
      image: 'https://images.unsplash.com/photo-1515694346937-94d85e41e6f0?auto=format&fit=crop&w=800&q=80',
    },
    {
      id: 'coffee_shop',
      title: 'Focused',
      label: 'Coffee Shop',
      image: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=800&q=80',
    },
    {
      id: 'city_night',
      title: 'Busy',
      label: 'City Night',
      image: 'https://images.unsplash.com/photo-1519501025264-65ba15a82390?auto=format&fit=crop&w=800&q=80',
    },
    {
      id: 'overcast',
      title: 'Heavy',
      label: 'Overcast Shore',
      image: 'https://images.unsplash.com/photo-1643184658122-4493cccf7c43?auto=format&fit=crop&w=800&q=80',
    },
    {
      id: 'storm',
      title: 'Overwhelmed',
      label: 'Storm Sky',
      image: 'https://images.unsplash.com/photo-1527482797697-8795b05a13fe?auto=format&fit=crop&w=800&q=80',
    },
  ];

  function getClient() {
    if (!isConfigured) {
      throw new Error(
        'Supabase is not configured. Open assets/js/config.js and set SUPABASE_URL and SUPABASE_ANON_KEY.'
      );
    }
    if (!global.supabase || typeof global.supabase.createClient !== 'function') {
      throw new Error('Supabase JS library failed to load. Check your network connection.');
    }
    if (!client) {
      client = global.supabase.createClient(url, key, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          storage: global.localStorage,
        },
      });
    }
    return client;
  }

  function displayNameFromUser(user) {
    if (!user) return 'User';
    const meta = user.user_metadata || {};
    if (meta.full_name && String(meta.full_name).trim()) return String(meta.full_name).trim();
    if (meta.name && String(meta.name).trim()) return String(meta.name).trim();
    const email = user.email || '';
    const local = email.split('@')[0] || 'User';
    return local.replace(/[._-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }

  function initialsFromName(name) {
    return (name || 'U')
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0].toUpperCase())
      .join('') || 'U';
  }

  function localDateString(date) {
    const d = date instanceof Date ? date : new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function isSameLocalDay(iso, dayStr) {
    if (!iso) return false;
    return localDateString(new Date(iso)) === (dayStr || localDateString());
  }

  async function getSession() {
    const { data, error } = await getClient().auth.getSession();
    if (error) throw error;
    return data.session || null;
  }

  async function getUser() {
    const session = await getSession();
    return session ? session.user : null;
  }

  async function requireAuth(redirectTo) {
    const user = await getUser();
    if (!user) {
      window.location.href = redirectTo || 'index.html#auth';
      return null;
    }
    return user;
  }

  async function signUp({ email, password, fullName }) {
    const { data, error } = await getClient().auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    if (error) throw error;
    return data;
  }

  async function signIn({ email, password }) {
    const { data, error } = await getClient().auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  }

  async function signOut() {
    const { error } = await getClient().auth.signOut();
    if (error) throw error;
  }

  async function resetPassword(email) {
    const addr = String(email || '').trim();
    if (!addr) throw new Error('Enter your email above first, then click Forgot password.');
    const redirectTo = `${window.location.origin}${window.location.pathname}`.replace(/index\.html$/i, '') + 'index.html#auth';
    const { error } = await getClient().auth.resetPasswordForEmail(addr, { redirectTo });
    if (error) throw error;
    return true;
  }

  /* ---------------------------- Reflections CRUD --------------------------- */

  async function listReflections({ limit } = {}) {
    let query = getClient()
      .from('reflections')
      .select('id, user_id, reflection_text, created_at')
      .order('created_at', { ascending: false });
    if (limit && Number(limit) > 0) query = query.limit(Number(limit));
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  async function createReflection(reflectionText) {
    const user = await getUser();
    if (!user) throw new Error('You must be logged in to save a reflection.');
    const text = String(reflectionText || '').trim();
    if (!text) throw new Error('Reflection text cannot be empty.');
    const { data, error } = await getClient()
      .from('reflections')
      .insert({ user_id: user.id, reflection_text: text })
      .select('id, user_id, reflection_text, created_at')
      .single();
    if (error) throw error;
    return data;
  }

  async function deleteReflection(id) {
    if (!id) throw new Error('Missing reflection id.');
    const { error } = await getClient().from('reflections').delete().eq('id', id);
    if (error) throw error;
  }

  async function countReflections() {
    const { count, error } = await getClient()
      .from('reflections')
      .select('id', { count: 'exact', head: true });
    if (error) throw error;
    return count || 0;
  }

  async function hasReflectionToday() {
    const rows = await listReflections({ limit: 40 });
    const today = localDateString();
    return rows.some((r) => isSameLocalDay(r.created_at, today));
  }

  /* ---------------------------- Daily check-ins ---------------------------- */

  function validateCheckinPayload(payload) {
    const sleep = Number(payload.sleep_hours);
    if (Number.isNaN(sleep) || sleep < 0 || sleep > 12) {
      throw new Error('Sleep hours must be between 0 and 12.');
    }
    if (!MOODS.includes(payload.mood)) throw new Error('Please select a valid mood.');
    const energy = Number(payload.energy_level);
    const productivity = Number(payload.productivity);
    if (!Number.isInteger(energy) || energy < 1 || energy > 5) {
      throw new Error('Energy level must be between 1 and 5.');
    }
    if (!Number.isInteger(productivity) || productivity < 1 || productivity > 5) {
      throw new Error('Productivity must be between 1 and 5.');
    }
    if (!ACTIVITIES.includes(payload.physical_activity)) {
      throw new Error('Please select a valid physical activity level.');
    }
    return {
      sleep_hours: Math.round(sleep * 10) / 10,
      mood: payload.mood,
      energy_level: energy,
      productivity,
      physical_activity: payload.physical_activity,
      water_intake: payload.water_intake ? String(payload.water_intake).trim() : null,
      notes: payload.notes ? String(payload.notes).trim() : null,
    };
  }

  async function listCheckins({ limit } = {}) {
    let query = getClient()
      .from('daily_checkins')
      .select('*')
      .order('checkin_date', { ascending: false });
    if (limit && Number(limit) > 0) query = query.limit(Number(limit));
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  async function getTodayCheckin() {
    const today = localDateString();
    const { data, error } = await getClient()
      .from('daily_checkins')
      .select('*')
      .eq('checkin_date', today)
      .maybeSingle();
    if (error) throw error;
    return data || null;
  }

  async function upsertTodayCheckin(payload) {
    const user = await getUser();
    if (!user) throw new Error('You must be logged in to save a check-in.');
    const clean = validateCheckinPayload(payload);
    const today = localDateString();
    const existing = await getTodayCheckin();

    if (existing) {
      const { data, error } = await getClient()
        .from('daily_checkins')
        .update({ ...clean, updated_at: new Date().toISOString() })
        .eq('id', existing.id)
        .select('*')
        .single();
      if (error) throw error;
      return { row: data, created: false };
    }

    const { data, error } = await getClient()
      .from('daily_checkins')
      .insert({
        user_id: user.id,
        checkin_date: today,
        ...clean,
      })
      .select('*')
      .single();
    if (error) throw error;
    return { row: data, created: true };
  }

  async function deleteCheckin(id) {
    if (!id) throw new Error('Missing check-in id.');
    const { error } = await getClient().from('daily_checkins').delete().eq('id', id);
    if (error) throw error;
  }

  /* ---------------------------- Scenarios --------------------------------- */

  function hashString(str) {
    let h = 0;
    for (let i = 0; i < str.length; i += 1) h = (h * 31 + str.charCodeAt(i)) >>> 0;
    return h;
  }

  async function listScenarios({ includeInactive } = {}) {
    let query = getClient()
      .from('scenario_bank')
      .select('*')
      .order('created_at', { ascending: true });
    if (!includeInactive) {
      query = query.eq('is_active', true);
    }
    const { data, error } = await query;
    if (error) {
      // Fallback if is_active column not migrated yet
      if (String(error.message || '').includes('is_active')) {
        const retry = await getClient().from('scenario_bank').select('*').order('created_at', { ascending: true });
        if (retry.error) throw retry.error;
        return retry.data || [];
      }
      throw error;
    }
    return data || [];
  }

  async function listScenarioResponses() {
    const { data, error } = await getClient()
      .from('scenario_responses')
      .select('id, user_id, scenario_id, selected_option, response_date, created_at')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  async function getTodayScenarioResponse() {
    const today = localDateString();
    const { data, error } = await getClient()
      .from('scenario_responses')
      .select('*, scenario:scenario_bank(*)')
      .eq('response_date', today)
      .maybeSingle();
    if (error) throw error;
    return data || null;
  }

  async function pickTodaysScenario(userId) {
    const [scenarios, responses] = await Promise.all([listScenarios(), listScenarioResponses()]);
    if (!scenarios.length) {
      throw new Error('No scenarios found. Run supabase/schema_wellbeing.sql in your project.');
    }

    const answeredIds = new Set(responses.map((r) => r.scenario_id));
    let pool = scenarios.filter((s) => !answeredIds.has(s.id));
    if (!pool.length) pool = scenarios.slice();

    const seed = hashString(`${userId || 'user'}-${localDateString()}`);
    return pool[seed % pool.length];
  }

  async function saveScenarioResponse(scenarioId, selectedOption) {
    const user = await getUser();
    if (!user) throw new Error('You must be logged in to save a scenario response.');
    const opt = String(selectedOption || '').toUpperCase();
    if (!['A', 'B', 'C', 'D'].includes(opt)) throw new Error('Please select one of the four options.');

    const today = localDateString();
    const existing = await getTodayScenarioResponse();
    if (existing) {
      throw new Error('You already completed today’s scenario assessment.');
    }

    const { data, error } = await getClient()
      .from('scenario_responses')
      .insert({
        user_id: user.id,
        scenario_id: scenarioId,
        selected_option: opt,
        response_date: today,
      })
      .select('*, scenario:scenario_bank(*)')
      .single();
    if (error) throw error;
    return data;
  }

  /* ---------------------------- Visual reflections ------------------------ */

  async function listVisualReflections({ limit } = {}) {
    let query = getClient()
      .from('visual_reflections')
      .select('*')
      .order('created_at', { ascending: false });
    if (limit && Number(limit) > 0) query = query.limit(Number(limit));
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  async function getTodayVisualReflection() {
    const today = localDateString();
    const { data, error } = await getClient()
      .from('visual_reflections')
      .select('*')
      .eq('reflection_date', today)
      .maybeSingle();
    if (error) throw error;
    return data || null;
  }

  async function saveVisualReflection({ imageCategory, optionalNote }) {
    const user = await getUser();
    if (!user) throw new Error('You must be logged in to save a visual reflection.');
    const category = String(imageCategory || '').trim();
    if (!VISUAL_OPTIONS.some((v) => v.id === category)) {
      throw new Error('Please select one image.');
    }
    const today = localDateString();
    const note = optionalNote ? String(optionalNote).trim() : null;
    const existing = await getTodayVisualReflection();

    if (existing) {
      const { data, error } = await getClient()
        .from('visual_reflections')
        .update({ image_category: category, optional_note: note })
        .eq('id', existing.id)
        .select('*')
        .single();
      if (error) throw error;
      return { row: data, created: false };
    }

    const { data, error } = await getClient()
      .from('visual_reflections')
      .insert({
        user_id: user.id,
        image_category: category,
        optional_note: note,
        reflection_date: today,
      })
      .select('*')
      .single();
    if (error) throw error;
    return { row: data, created: true };
  }

  /* ---------------------------- Today’s journey --------------------------- */

  async function getTodaysProgress() {
    const [checkin, scenario, visual, journalToday] = await Promise.all([
      getTodayCheckin(),
      getTodayScenarioResponse(),
      getTodayVisualReflection(),
      hasReflectionToday(),
    ]);

    const steps = {
      checkin: !!checkin,
      scenario: !!scenario,
      visual: !!visual,
      journal: !!journalToday,
    };
    const order = ['checkin', 'scenario', 'visual', 'journal'];
    const completed = order.filter((k) => steps[k]).length;
    const next = order.find((k) => !steps[k]) || null;

    const nextHref = {
      checkin: 'checkins.html?flow=1',
      scenario: 'scenario.html?flow=1',
      visual: 'visual.html?flow=1',
      journal: 'journal.html?flow=1',
    };

    return {
      steps,
      completed,
      total: 4,
      next,
      nextHref: next ? nextHref[next] : null,
      labels: {
        checkin: 'Daily Check-in',
        scenario: 'Scenario Assessment',
        visual: 'Visual Reflection',
        journal: 'Reflection Journal',
      },
    };
  }

  /* ---------------------------- Dashboard analytics ----------------------- */

  function average(nums) {
    if (!nums.length) return null;
    return nums.reduce((a, b) => a + b, 0) / nums.length;
  }

  async function getDashboardMetrics() {
    const [checkins, reflectionsCount, scenarioResponses, visualRows, progress, reflectionsList] = await Promise.all([
      listCheckins({ limit: 90 }),
      countReflections(),
      listScenarioResponses(),
      listVisualReflections({ limit: 90 }),
      getTodaysProgress(),
      listReflections({ limit: 90 }),
    ]);

    const recentCheckins = checkins.slice(0, 30);
    const sleepVals = recentCheckins.map((c) => Number(c.sleep_hours)).filter((n) => !Number.isNaN(n));
    const moodVals = recentCheckins.map((c) => MOOD_SCORES[c.mood]).filter(Boolean);
    const energyVals = recentCheckins.map((c) => Number(c.energy_level)).filter((n) => n >= 1 && n <= 5);
    const prodVals = recentCheckins.map((c) => Number(c.productivity)).filter((n) => n >= 1 && n <= 5);
    const activityVals = recentCheckins.map((c) => ACTIVITY_SCORES[c.physical_activity]).filter(Boolean);

    const sleepAvg = average(sleepVals);
    const moodAvg = average(moodVals);
    const energyAvg = average(energyVals);
    const prodAvg = average(prodVals);
    const activityAvg = average(activityVals);

    const activeDays = new Set(checkins.map((c) => c.checkin_date)).size;
    // Approx. completed journeys: days with a check-in (journey starts there)
    const completedJourneys = activeDays;

    const THRESH = {
      trend: 7,
      dist: 7,
      sleep: 7,
      mood: 7,
      productivity: 7,
      behavior: 10,
      wellness: 7,
    };

    const checkinCount = checkins.length;
    const needs = {
      wellnessScore: checkinCount < THRESH.wellness,
      trend: checkinCount < THRESH.trend,
      dist: checkinCount < THRESH.dist,
      sleep: checkinCount < THRESH.sleep,
      mood: checkinCount < THRESH.mood,
      productivity: checkinCount < THRESH.productivity,
      behavior: completedJourneys < THRESH.behavior,
    };

    // Deterministic demo seed so charts stay stable across reloads
    let seed = (checkinCount * 17 + reflectionsCount * 13 + activeDays * 7) % 997 || 41;
    function nextDemo() {
      seed = (seed * 16807) % 2147483647;
      return (seed % 1000) / 1000;
    }

    function buildDemoTrend(days) {
      const labels = [];
      const values = [];
      let base = 76 + nextDemo() * 8;
      for (let i = days - 1; i >= 0; i -= 1) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        labels.push(d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }));
        const wave = Math.sin((days - i) / 4.2) * 6;
        const drift = ((days - i) / days) * 4;
        const noise = (nextDemo() - 0.5) * 5;
        values.push(Math.round(Math.max(62, Math.min(94, base + wave + drift + noise))));
      }
      return { labels, values };
    }

    function distFromValues(vals) {
      const dist = { Excellent: 0, Good: 0, Moderate: 0, 'Needs Attention': 0 };
      vals.filter((v) => v != null).forEach((v) => {
        if (v >= 80) dist.Excellent += 1;
        else if (v >= 65) dist.Good += 1;
        else if (v >= 50) dist.Moderate += 1;
        else dist['Needs Attention'] += 1;
      });
      return dist;
    }

    // Real last-30-day wellness series from check-ins
    const byDate = {};
    recentCheckins.forEach((c) => {
      const sleepScore = Math.max(0, Math.min(100, (Number(c.sleep_hours) / 8) * 100));
      const moodScore = ((MOOD_SCORES[c.mood] - 1) / 4) * 100;
      const energyScore = ((Number(c.energy_level) - 1) / 4) * 100;
      const prodScore = ((Number(c.productivity) - 1) / 4) * 100;
      const actScore = ((ACTIVITY_SCORES[c.physical_activity] - 1) / 3) * 100;
      byDate[c.checkin_date] = Math.round(
        sleepScore * 0.25 + moodScore * 0.25 + energyScore * 0.2 + prodScore * 0.15 + actScore * 0.15
      );
    });

    const realTrendLabels = [];
    const realTrendValues = [];
    for (let i = 29; i >= 0; i -= 1) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = localDateString(d);
      realTrendLabels.push(d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }));
      realTrendValues.push(byDate[key] != null ? byDate[key] : null);
    }

    const demoTrend = buildDemoTrend(30);
    const realDist = distFromValues(realTrendValues);
    const demoDist = distFromValues(demoTrend.values);

    // Reflection frequency (last 14 days)
    const twoWeeksAgo = Date.now() - 14 * 86400000;
    const recentReflectionCount = (reflectionsList || []).filter(
      (r) => new Date(r.created_at).getTime() >= twoWeeksAgo
    ).length;

    let realWellnessScore = null;
    if (!needs.wellnessScore) {
      const sleepScore = Math.max(0, Math.min(100, (sleepAvg / 8) * 100));
      const moodScore = ((moodAvg - 1) / 4) * 100;
      const prodScore = ((prodAvg - 1) / 4) * 100;
      const actScore = ((activityAvg - 1) / 3) * 100;
      const reflectionScore = Math.min(100, (recentReflectionCount / 7) * 100);
      const journeyScore = Math.round(
        (progress.completed / progress.total) * 60 + Math.min(40, (completedJourneys / 14) * 40)
      );
      realWellnessScore = Math.round(
        sleepScore * 0.2 +
        moodScore * 0.2 +
        prodScore * 0.15 +
        actScore * 0.15 +
        reflectionScore * 0.15 +
        journeyScore * 0.15
      );
    }

    const demoWellnessScore = Math.round(72 + nextDemo() * 18);
    const demoSleepSeries = Array.from({ length: 7 }, () => Math.round((6.2 + nextDemo() * 2.2) * 10) / 10);
    const demoMoodSeries = Array.from({ length: 7 }, () => Math.round((3.2 + nextDemo() * 1.4) * 10) / 10);
    const demoProdSeries = Array.from({ length: 7 }, () => Math.round(2.8 + nextDemo() * 1.8));
    const demoEnergySeries = Array.from({ length: 7 }, () => Math.round(2.8 + nextDemo() * 1.8));

    const realAnalytics = {
      wellnessScore: realWellnessScore,
      sleepAvg: sleepAvg == null ? null : Math.round(sleepAvg * 10) / 10,
      moodAvg: moodAvg == null ? null : Math.round(moodAvg * 10) / 10,
      energyAvg: energyAvg == null ? null : Math.round(energyAvg * 10) / 10,
      prodAvg: prodAvg == null ? null : Math.round(prodAvg * 10) / 10,
      trendLabels: realTrendLabels,
      trendValues: realTrendValues,
      dist: realDist,
      enoughForTrends: !needs.trend,
    };

    const demoAnalytics = {
      wellnessScore: demoWellnessScore,
      sleepAvg: Math.round((6.8 + nextDemo() * 1.2) * 10) / 10,
      moodAvg: Math.round((3.5 + nextDemo() * 1.0) * 10) / 10,
      energyAvg: Math.round((3.5 + nextDemo() * 1.0) * 10) / 10,
      prodAvg: Math.round((3.4 + nextDemo() * 1.0) * 10) / 10,
      trendLabels: demoTrend.labels,
      trendValues: demoTrend.values,
      dist: demoDist,
      sleepSeries: demoSleepSeries,
      moodSeries: demoMoodSeries,
      prodSeries: demoProdSeries,
      energySeries: demoEnergySeries,
      enoughForTrends: true,
    };

    return {
      progress,
      journalCount: reflectionsCount,
      checkinCount,
      activeDays,
      scenarioCount: scenarioResponses.length,
      visualCount: visualRows.length,
      completedJourneys,
      recentCheckins: checkins.slice(0, 5),
      needs,
      realAnalytics,
      demoAnalytics,
      thresholds: THRESH,
      insufficientMessage: 'Not enough data yet.',
      unlockMessage: 'Not enough data yet. Complete more daily check-ins to unlock this insight.',
      demoCaption: 'Sample visualization for demonstration.',
    };
  }

  function formatDate(iso) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }

  function formatTime(iso) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  }

  function formatRelativeDate(iso) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const now = new Date();
    const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startThen = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const diffDays = Math.round((startToday - startThen) / 86400000);
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays > 1 && diffDays < 7) return `${diffDays} days ago`;
    return formatDate(iso);
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function isFlowMode() {
    try {
      return new URLSearchParams(window.location.search).get('flow') === '1';
    } catch (e) {
      return false;
    }
  }

  /* ---------------------------- Profiles / preferences -------------------- */

  async function ensureProfile(user) {
    const u = user || (await getUser());
    if (!u) return null;
    const { data, error } = await getClient()
      .from('profiles')
      .select('*')
      .eq('id', u.id)
      .maybeSingle();
    if (error) {
      // Table may not exist yet
      if (String(error.message || '').includes('schema cache') || error.code === '42P01') {
        return { id: u.id, display_name: displayNameFromUser(u), role: 'user', avatar_url: null };
      }
      throw error;
    }
    if (data) return data;

    const insert = {
      id: u.id,
      display_name: displayNameFromUser(u),
      role: 'user',
    };
    const { data: created, error: insErr } = await getClient()
      .from('profiles')
      .insert(insert)
      .select('*')
      .single();
    if (insErr) throw insErr;
    await getClient().from('user_preferences').upsert({ user_id: u.id });
    return created;
  }

  async function updateProfile({ displayName, avatarUrl }) {
    const user = await getUser();
    if (!user) throw new Error('Not signed in.');
    const patch = { updated_at: new Date().toISOString() };
    if (displayName != null) patch.display_name = String(displayName).trim();
    if (avatarUrl != null) patch.avatar_url = avatarUrl;
    const { data, error } = await getClient()
      .from('profiles')
      .update(patch)
      .eq('id', user.id)
      .select('*')
      .single();
    if (error) throw error;

    if (displayName != null) {
      await getClient().auth.updateUser({ data: { full_name: patch.display_name } });
    }
    return data;
  }

  async function touchLastLogin() {
    const user = await getUser();
    if (!user) return;
    await getClient()
      .from('profiles')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', user.id);
  }

  async function getPreferences() {
    const user = await getUser();
    if (!user) return null;
    const { data, error } = await getClient()
      .from('user_preferences')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();
    if (error) {
      if (String(error.message || '').includes('schema cache')) {
        return { theme: localStorage.getItem('lh_theme') || 'light', notifications_enabled: true, privacy_mode: 'private', language: 'en' };
      }
      throw error;
    }
    if (data) return data;
    const { data: created, error: insErr } = await getClient()
      .from('user_preferences')
      .upsert({ user_id: user.id })
      .select('*')
      .single();
    if (insErr) throw insErr;
    return created;
  }

  async function updatePreferences(patch) {
    const user = await getUser();
    if (!user) throw new Error('Not signed in.');
    const clean = { updated_at: new Date().toISOString() };
    if (patch.theme) clean.theme = patch.theme === 'dark' ? 'dark' : 'light';
    if (typeof patch.notifications_enabled === 'boolean') clean.notifications_enabled = patch.notifications_enabled;
    if (patch.privacy_mode) clean.privacy_mode = patch.privacy_mode;
    if (patch.language) clean.language = patch.language;
    const { data, error } = await getClient()
      .from('user_preferences')
      .upsert({ user_id: user.id, ...clean })
      .select('*')
      .single();
    if (error) throw error;
    if (clean.theme && global.LighthouseTheme) global.LighthouseTheme.apply(clean.theme, { silent: true });
    return data;
  }

  async function changePassword(newPassword) {
    if (!newPassword || String(newPassword).length < 6) {
      throw new Error('Password must be at least 6 characters.');
    }
    const { error } = await getClient().auth.updateUser({ password: String(newPassword) });
    if (error) throw error;
  }

  async function getProfileStats() {
    const [reflections, checkins, scenarios, visuals] = await Promise.all([
      listReflections({ limit: 500 }),
      listCheckins({ limit: 500 }),
      listScenarioResponses(),
      listVisualReflections({ limit: 500 }),
    ]);

    const dayCounts = {};
    const bump = (isoOrDate) => {
      if (!isoOrDate) return;
      const key = String(isoOrDate).slice(0, 10);
      const d = new Date(key + 'T12:00:00');
      if (Number.isNaN(d.getTime())) return;
      const name = d.toLocaleDateString(undefined, { weekday: 'long' });
      dayCounts[name] = (dayCounts[name] || 0) + 1;
    };
    reflections.forEach((r) => bump(r.created_at));
    checkins.forEach((c) => bump(c.checkin_date));
    scenarios.forEach((s) => bump(s.response_date || s.created_at));
    visuals.forEach((v) => bump(v.reflection_date || v.created_at));

    let mostActiveDay = null;
    let max = 0;
    Object.keys(dayCounts).forEach((k) => {
      if (dayCounts[k] > max) { max = dayCounts[k]; mostActiveDay = k; }
    });

    return {
      totalReflections: reflections.length,
      totalCheckins: checkins.length,
      totalScenarios: scenarios.length,
      totalVisuals: visuals.length,
      mostActiveDay: mostActiveDay || 'Not enough data yet.',
    };
  }

  /* ---------------------------- Insights / reports ------------------------ */

  function weekBounds(offsetWeeks) {
    const now = new Date();
    const day = now.getDay(); // 0 Sun
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - day - (offsetWeeks * 7));
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    return { start, end };
  }

  function inRange(dateLike, start, end) {
    const d = new Date(dateLike);
    return d >= start && d < end;
  }

  async function getInsightsData() {
    const [checkins, reflections, scenarios, visuals] = await Promise.all([
      listCheckins({ limit: 120 }),
      listReflections({ limit: 120 }),
      listScenarioResponses(),
      listVisualReflections({ limit: 120 }),
    ]);

    const thisWeek = weekBounds(0);
    const lastWeek = weekBounds(1);

    const checkinsThis = checkins.filter((c) => inRange(c.checkin_date, thisWeek.start, thisWeek.end));
    const checkinsLast = checkins.filter((c) => inRange(c.checkin_date, lastWeek.start, lastWeek.end));
    const reflectionsThis = reflections.filter((r) => inRange(r.created_at, thisWeek.start, thisWeek.end));
    const reflectionsLast = reflections.filter((r) => inRange(r.created_at, lastWeek.start, lastWeek.end));

    const sleepSeries = checkins.slice(0, 30).reverse().map((c) => ({
      label: c.checkin_date,
      value: Number(c.sleep_hours),
    }));
    const moodSeries = checkins.slice(0, 30).reverse().map((c) => ({
      label: c.checkin_date,
      value: MOOD_SCORES[c.mood] || null,
    }));
    const prodSeries = checkins.slice(0, 30).reverse().map((c) => ({
      label: c.checkin_date,
      value: Number(c.productivity),
    }));
    const activitySeries = checkins.slice(0, 30).reverse().map((c) => ({
      label: c.checkin_date,
      value: ACTIVITY_SCORES[c.physical_activity] || null,
    }));

    const visualCounts = {};
    visuals.forEach((v) => {
      visualCounts[v.image_category] = (visualCounts[v.image_category] || 0) + 1;
    });
    let topVisual = null;
    let topVisualCount = 0;
    Object.keys(visualCounts).forEach((k) => {
      if (visualCounts[k] > topVisualCount) {
        topVisualCount = visualCounts[k];
        topVisual = k;
      }
    });
    const topVisualMeta = VISUAL_OPTIONS.find((v) => v.id === topVisual);

    const enough = checkins.length >= 3;
    const sleepAvgThis = average(checkinsThis.map((c) => Number(c.sleep_hours)));
    const sleepAvgLast = average(checkinsLast.map((c) => Number(c.sleep_hours)));

    const summaries = [];
    if (checkinsThis.length >= 4) {
      summaries.push('You completed your daily check-ins consistently this week.');
    }
    if (reflectionsThis.length > reflectionsLast.length && reflectionsThis.length > 0) {
      summaries.push('You reflected more often this week than last week.');
    }
    if (sleepAvgThis != null && sleepAvgLast != null && sleepAvgThis > sleepAvgLast) {
      summaries.push('Your average sleep increased compared to last week.');
    }
    if (topVisualMeta) {
      summaries.push(`You most frequently selected “${topVisualMeta.title}” visual themes.`);
    }
    if (scenarios.length > 0) {
      summaries.push(`You have completed ${scenarios.length} scenario assessment${scenarios.length === 1 ? '' : 's'}.`);
    }
    if (!summaries.length) {
      summaries.push('Continue using Lighthouse to unlock personalized insights.');
    }

    return {
      enough,
      insufficientMessage: 'Not enough data yet.',
      unlockMessage: 'Continue using Lighthouse to unlock personalized insights.',
      sleepSeries,
      moodSeries,
      prodSeries,
      activitySeries,
      reflectionCount: reflections.length,
      reflectionThisWeek: reflectionsThis.length,
      checkinCount: checkins.length,
      checkinThisWeek: checkinsThis.length,
      scenarioCount: scenarios.length,
      visualCount: visuals.length,
      visualCounts,
      topVisual: topVisualMeta ? topVisualMeta.title : null,
      summaries,
      weekly: {
        checkinsThis: checkinsThis.length,
        checkinsLast: checkinsLast.length,
        reflectionsThis: reflectionsThis.length,
        reflectionsLast: reflectionsLast.length,
        sleepAvgThis: sleepAvgThis == null ? null : Math.round(sleepAvgThis * 10) / 10,
        sleepAvgLast: sleepAvgLast == null ? null : Math.round(sleepAvgLast * 10) / 10,
      },
    };
  }

  async function getReport(period) {
    const isMonth = period === 'monthly';
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    if (isMonth) start.setDate(start.getDate() - 30);
    else start.setDate(start.getDate() - 7);
    const end = new Date();

    const [checkins, reflections, scenarios, visuals] = await Promise.all([
      listCheckins({ limit: 120 }),
      listReflections({ limit: 120 }),
      listScenarioResponses(),
      listVisualReflections({ limit: 120 }),
    ]);

    const c = checkins.filter((x) => inRange(x.checkin_date, start, end));
    const r = reflections.filter((x) => inRange(x.created_at, start, end));
    const s = scenarios.filter((x) => inRange(x.response_date || x.created_at, start, end));
    const v = visuals.filter((x) => inRange(x.reflection_date || x.created_at, start, end));

    const sleepAvg = average(c.map((x) => Number(x.sleep_hours)));
    const moodAvg = average(c.map((x) => MOOD_SCORES[x.mood]).filter(Boolean));
    const prodAvg = average(c.map((x) => Number(x.productivity)));
    const activityAvg = average(c.map((x) => ACTIVITY_SCORES[x.physical_activity]).filter(Boolean));

    const activityDist = { None: 0, Light: 0, Moderate: 0, High: 0 };
    c.forEach((x) => { if (activityDist[x.physical_activity] != null) activityDist[x.physical_activity] += 1; });

    const visualDist = {};
    v.forEach((x) => { visualDist[x.image_category] = (visualDist[x.image_category] || 0) + 1; });

    const engagement = Math.min(100, Math.round(((c.length + r.length + s.length + v.length) / (isMonth ? 40 : 16)) * 100));

    return {
      period: isMonth ? 'Monthly' : 'Weekly',
      start: localDateString(start),
      end: localDateString(end),
      reflectionCount: r.length,
      checkinCount: c.length,
      scenarioCount: s.length,
      visualCount: v.length,
      sleepAvg: sleepAvg == null ? null : Math.round(sleepAvg * 10) / 10,
      moodAvg: moodAvg == null ? null : Math.round(moodAvg * 10) / 10,
      prodAvg: prodAvg == null ? null : Math.round(prodAvg * 10) / 10,
      activityAvg: activityAvg == null ? null : Math.round(activityAvg * 10) / 10,
      activityDist,
      visualDist,
      engagement,
      enough: c.length + r.length >= 2,
      unlockMessage: 'Continue using Lighthouse to unlock insights.',
      insufficientMessage: 'Not enough data yet.',
    };
  }

  /* ---------------------------- Admin APIs -------------------------------- */

  async function requireAdmin() {
    const user = await requireAuth();
    if (!user) return null;
    const profile = await ensureProfile(user);
    if (!profile || profile.role !== 'admin') {
      throw new Error('Admin access required.');
    }
    return { user, profile };
  }

  async function adminListProfiles() {
    await requireAdmin();
    const { data, error } = await getClient()
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  async function adminUpdateProfile(id, patch) {
    await requireAdmin();
    const clean = { updated_at: new Date().toISOString() };
    if (patch.account_status) clean.account_status = patch.account_status;
    if (patch.role) clean.role = patch.role;
    if (patch.display_name != null) clean.display_name = patch.display_name;
    if (Object.prototype.hasOwnProperty.call(patch, 'monitoring_until')) {
      clean.monitoring_until = patch.monitoring_until;
    }
    const { data, error } = await getClient()
      .from('profiles')
      .update(clean)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  }

  const DEFAULT_NUDGE =
    "We've noticed you've been quieter lately — a short check-in can help.";

  function isMonitoringActive(until) {
    if (!until) return false;
    return new Date(until).getTime() > Date.now();
  }

  function computeFlagSignals(p, checkinRows, reflectionRows, scenarioRows) {
    const uid = p.id;
    const userCheckins = checkinRows
      .filter((r) => r.user_id === uid)
      .sort((a, b) => (a.checkin_date < b.checkin_date ? 1 : -1));
    const userRefs = reflectionRows
      .filter((r) => r.user_id === uid)
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    const userScenarios = scenarioRows.filter((r) => r.user_id === uid);
    const lastDates = [
      userCheckins[0] && userCheckins[0].checkin_date,
      userRefs[0] && localDateString(new Date(userRefs[0].created_at)),
      userScenarios[0] && (userScenarios[0].response_date || localDateString(new Date(userScenarios[0].created_at))),
      p.last_login_at && localDateString(new Date(p.last_login_at)),
    ].filter(Boolean).sort().reverse();
    const lastActivity = lastDates[0] || localDateString(new Date(p.created_at));
    const daysSince = Math.round((Date.now() - new Date(lastActivity + 'T12:00:00').getTime()) / 86400000);

    const recentMoods = userCheckins.slice(0, 5).map((c) => MOOD_SCORES[c.mood] || 3);
    const lowMoodStreak = recentMoods.filter((m) => m <= 2).length;
    const lowSleep = userCheckins.slice(0, 5).filter((c) => Number(c.sleep_hours) < 5).length;
    const avoidance = userScenarios.filter((s) => s.selected_option === 'B' || s.selected_option === 'D').length;
    const avoidRate = userScenarios.length ? avoidance / userScenarios.length : 0;
    const reflectionGap = userRefs.length === 0
      ? 14
      : Math.round((Date.now() - new Date(userRefs[0].created_at).getTime()) / 86400000);

    const reasons = [];
    let score = 0;
    if (daysSince >= 7) {
      score += 2;
      reasons.push(`Inactive for ${daysSince} days`);
    } else if (daysSince >= 4) {
      score += 1;
      reasons.push(`Quieter lately (${daysSince} days since activity)`);
    }
    if (lowMoodStreak >= 3) {
      score += 2;
      reasons.push(`Low mood in ${lowMoodStreak} of last 5 check-ins`);
    } else if (lowMoodStreak >= 2) {
      score += 1;
      reasons.push(`Low mood in ${lowMoodStreak} of last 5 check-ins`);
    }
    if (lowSleep >= 3) {
      score += 2;
      reasons.push(`Short sleep (<5h) in ${lowSleep} of last 5 check-ins`);
    } else if (lowSleep >= 2) {
      score += 1;
      reasons.push(`Short sleep (<5h) in ${lowSleep} of last 5 check-ins`);
    }
    if (avoidRate >= 0.6 && userScenarios.length >= 3) {
      score += 1;
      reasons.push(`High avoidance pattern in scenarios (${Math.round(avoidRate * 100)}%)`);
    }
    if (reflectionGap >= 10) {
      score += 1;
      reasons.push(userRefs.length === 0
        ? 'No reflection entries yet'
        : `No reflection for ${reflectionGap} days`);
    }

    let risk = 'Low';
    if (score >= 5) risk = 'High';
    else if (score >= 3) risk = 'Moderate';

    return {
      id: uid,
      name: p.display_name || 'User',
      email: null,
      lastActivity,
      risk,
      status: p.account_status,
      monitoring: isMonitoringActive(p.monitoring_until),
      monitoringUntil: p.monitoring_until || null,
      checkinCount: userCheckins.length,
      reflectionCount: userRefs.length,
      scenarioCount: userScenarios.length,
      score,
      reasons,
    };
  }

  async function clearMonitoringIfImproved(profiles, flaggedMap) {
    const clears = profiles.filter((p) => {
      if (!p.monitoring_until) return false;
      if (!isMonitoringActive(p.monitoring_until)) return true; // expired
      const f = flaggedMap[p.id];
      return !f || f.risk === 'Low'; // signals improved
    });
    await Promise.all(clears.map(async (p) => {
      try {
        await getClient()
          .from('profiles')
          .update({ monitoring_until: null, updated_at: new Date().toISOString() })
          .eq('id', p.id);
        p.monitoring_until = null;
      } catch (e) { /* ignore */ }
    }));
  }

  const SHOWCASE_REASONS = [
    [
      'Showcase sample: low mood in 3 of last 5 check-ins',
      'Showcase sample: short sleep (<5h) in 2 of last 5 check-ins',
    ],
    [
      'Showcase sample: quieter lately (5 days since activity)',
      'Showcase sample: no reflection for 12 days',
    ],
  ];

  function showcaseUserIds(profiles) {
    if (cfg.SHOWCASE_FLAGGED === false) return [];
    return profiles
      .filter((p) => (p.role || 'user') !== 'admin')
      .sort((a, b) => String(a.created_at || '').localeCompare(String(b.created_at || '')))
      .slice(0, 2)
      .map((p) => p.id);
  }

  function applyShowcaseFlag(flag, index) {
    if (!flag) return flag;
    const reasons = SHOWCASE_REASONS[index] || SHOWCASE_REASONS[0];
    // Keep real High; otherwise ensure Moderate for demo Care workflow
    if (flag.risk === 'High') {
      flag.reasons = [...reasons, ...(flag.reasons || [])];
      flag.showcase = true;
      return flag;
    }
    flag.risk = 'Moderate';
    flag.score = Math.max(flag.score || 0, 3);
    flag.reasons = [...reasons];
    flag.showcase = true;
    // Put the first showcase user on a display watchlist badge
    if (index === 0 && !flag.monitoring) {
      flag.monitoring = true;
      const until = new Date();
      until.setDate(until.getDate() + 7);
      flag.monitoringUntil = until.toISOString();
      flag.showcaseWatchlist = true;
    }
    return flag;
  }

  function applyShowcaseFlags(profiles, allFlags) {
    const ids = showcaseUserIds(profiles);
    if (!ids.length) return allFlags;
    const byId = {};
    allFlags.forEach((f) => { byId[f.id] = f; });
    ids.forEach((id, index) => {
      if (byId[id]) applyShowcaseFlag(byId[id], index);
    });
    return allFlags;
  }

  async function adminListNotes(userId) {
    await requireAdmin();
    const { data, error } = await getClient()
      .from('admin_notes')
      .select('id, user_id, admin_id, note, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) throw error;
    return data || [];
  }

  async function adminAddNote(userId, note) {
    await requireAdmin();
    const text = String(note || '').trim();
    if (!text) throw new Error('Note cannot be empty.');
    const user = await requireAuth();
    const { data, error } = await getClient()
      .from('admin_notes')
      .insert({ user_id: userId, admin_id: user.id, note: text })
      .select('id, user_id, admin_id, note, created_at')
      .single();
    if (error) throw error;
    return data;
  }

  async function adminSendNudge(userId, message) {
    await requireAdmin();
    const text = String(message || DEFAULT_NUDGE).trim() || DEFAULT_NUDGE;
    const user = await requireAuth();
    const { data, error } = await getClient()
      .from('user_nudges')
      .insert({ user_id: userId, admin_id: user.id, message: text })
      .select('id, user_id, message, created_at, dismissed_at')
      .single();
    if (error) throw error;
    return data;
  }

  async function adminListNudges(userId) {
    await requireAdmin();
    const { data, error } = await getClient()
      .from('user_nudges')
      .select('id, user_id, message, created_at, dismissed_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20);
    if (error) throw error;
    return data || [];
  }

  async function adminSetWatchlist(userId, days = 7) {
    await requireAdmin();
    const until = new Date();
    until.setDate(until.getDate() + Number(days) || 7);
    return adminUpdateProfile(userId, { monitoring_until: until.toISOString() });
  }

  async function adminClearWatchlist(userId) {
    await requireAdmin();
    return adminUpdateProfile(userId, { monitoring_until: null });
  }

  async function getActiveNudge() {
    const user = await requireAuth();
    const { data, error } = await getClient()
      .from('user_nudges')
      .select('id, message, created_at')
      .eq('user_id', user.id)
      .is('dismissed_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  async function dismissNudge(nudgeId) {
    const user = await requireAuth();
    const { data, error } = await getClient()
      .from('user_nudges')
      .update({ dismissed_at: new Date().toISOString() })
      .eq('id', nudgeId)
      .eq('user_id', user.id)
      .select('id')
      .single();
    if (error) throw error;
    return data;
  }

  async function adminGetAnalytics() {
    await requireAdmin();
    const [profiles, checkins, reflections, scenarios, visuals] = await Promise.all([
      adminListProfiles(),
      getClient().from('daily_checkins').select('id, user_id, checkin_date, sleep_hours, mood, created_at'),
      getClient().from('reflections').select('id, user_id, created_at'),
      getClient().from('scenario_responses').select('id, user_id, selected_option, response_date, created_at, scenario_id'),
      getClient().from('visual_reflections').select('id, user_id, image_category, reflection_date, created_at'),
    ]);

    if (checkins.error) throw checkins.error;
    if (reflections.error) throw reflections.error;
    if (scenarios.error) throw scenarios.error;
    if (visuals.error) throw visuals.error;

    const today = localDateString();
    const checkinRows = checkins.data || [];
    const reflectionRows = reflections.data || [];
    const scenarioRows = scenarios.data || [];
    const visualRows = visuals.data || [];

    const activeToday = new Set([
      ...checkinRows.filter((r) => r.checkin_date === today).map((r) => r.user_id),
      ...reflectionRows.filter((r) => isSameLocalDay(r.created_at, today)).map((r) => r.user_id),
      ...scenarioRows.filter((r) => r.response_date === today).map((r) => r.user_id),
      ...visualRows.filter((r) => r.reflection_date === today).map((r) => r.user_id),
    ]);

    const growthLabels = [];
    const growthValues = [];
    for (let i = 13; i >= 0; i -= 1) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = localDateString(d);
      growthLabels.push(d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }));
      growthValues.push(profiles.filter((p) => localDateString(new Date(p.created_at)) <= key).length);
    }

    const activityLabels = [];
    const activityCheckins = [];
    const activityReflections = [];
    for (let i = 13; i >= 0; i -= 1) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = localDateString(d);
      activityLabels.push(d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }));
      activityCheckins.push(checkinRows.filter((r) => r.checkin_date === key).length);
      activityReflections.push(reflectionRows.filter((r) => isSameLocalDay(r.created_at, key)).length);
    }

    const totalUsers = profiles.length || 1;
    const usersWithScenario = new Set(scenarioRows.map((r) => r.user_id)).size;
    const usersWithVisual = new Set(visualRows.map((r) => r.user_id)).size;

    // Flagged users (summary only — no journal text)
    let allFlags = profiles.map((p) =>
      computeFlagSignals(p, checkinRows, reflectionRows, scenarioRows)
    );
    allFlags = applyShowcaseFlags(profiles, allFlags);
    const flaggedMap = {};
    allFlags.forEach((f) => { flaggedMap[f.id] = f; });
    await clearMonitoringIfImproved(profiles, flaggedMap);

    // Refresh monitoring flags after possible auto-clear (keep showcase watch badge)
    allFlags.forEach((f) => {
      const p = profiles.find((x) => x.id === f.id);
      if (f.showcaseWatchlist) return;
      f.monitoring = isMonitoringActive(p && p.monitoring_until);
      f.monitoringUntil = (p && p.monitoring_until) || null;
    });

    const flagged = allFlags
      .filter((f) => f.risk !== 'Low' || f.score >= 2 || f.monitoring)
      .sort((a, b) => b.score - a.score);

    return {
      totalUsers: profiles.length,
      activeUsersToday: activeToday.size,
      checkinsTotal: checkinRows.length,
      reflectionsTotal: reflectionRows.length,
      scenarioCompletionRate: Math.round((usersWithScenario / totalUsers) * 100),
      visualCompletionRate: Math.round((usersWithVisual / totalUsers) * 100),
      flaggedCount: flagged.filter((f) => f.risk !== 'Low').length,
      watchlistCount: profiles.filter((p) => isMonitoringActive(p.monitoring_until)).length,
      growthLabels,
      growthValues,
      activityLabels,
      activityCheckins,
      activityReflections,
      flagged,
      profiles,
    };
  }

  async function adminGetUserSummary(userId) {
    await requireAdmin();
    const [profileRes, checkins, reflections, scenarios, visuals] = await Promise.all([
      getClient().from('profiles').select('*').eq('id', userId).maybeSingle(),
      getClient().from('daily_checkins').select('id, user_id, checkin_date, sleep_hours, mood, energy_level, productivity, physical_activity, created_at').eq('user_id', userId).order('checkin_date', { ascending: false }).limit(30),
      getClient().from('reflections').select('id, user_id, created_at').eq('user_id', userId),
      getClient().from('scenario_responses').select('id, user_id, selected_option, response_date, created_at').eq('user_id', userId),
      getClient().from('visual_reflections').select('id, image_category, reflection_date').eq('user_id', userId),
    ]);
    if (profileRes.error) throw profileRes.error;
    if (checkins.error) throw checkins.error;
    if (reflections.error) throw reflections.error;
    if (scenarios.error) throw scenarios.error;
    if (visuals.error) throw visuals.error;

    let notes = [];
    let nudges = [];
    try { notes = await adminListNotes(userId); } catch (e) { notes = []; }
    try { nudges = await adminListNudges(userId); } catch (e) { nudges = []; }

    const visualDist = {};
    (visuals.data || []).forEach((v) => {
      visualDist[v.image_category] = (visualDist[v.image_category] || 0) + 1;
    });

    const profile = profileRes.data || { id: userId };
    let flag = computeFlagSignals(
      profile,
      (checkins.data || []).map((c) => ({ ...c, user_id: userId })),
      (reflections.data || []).map((r) => ({ ...r, user_id: userId })),
      (scenarios.data || []).map((s) => ({ ...s, user_id: userId }))
    );

    // Match showcase Moderate users in Care panel
    if (cfg.SHOWCASE_FLAGGED !== false) {
      try {
        const allProfiles = await adminListProfiles();
        const ids = showcaseUserIds(allProfiles);
        const idx = ids.indexOf(userId);
        if (idx >= 0) flag = applyShowcaseFlag(flag, idx);
      } catch (e) { /* ignore */ }
    }

    // Auto-clear watchlist if signals improved (skip showcase-only watch badge)
    if (!flag.showcaseWatchlist && isMonitoringActive(profile.monitoring_until) && flag.risk === 'Low') {
      try {
        await adminClearWatchlist(userId);
        profile.monitoring_until = null;
        flag.monitoring = false;
        flag.monitoringUntil = null;
      } catch (e) { /* ignore */ }
    } else if (!flag.showcaseWatchlist) {
      flag.monitoring = isMonitoringActive(profile.monitoring_until);
      flag.monitoringUntil = profile.monitoring_until || null;
    }

    return {
      profile,
      flag,
      checkinCount: (checkins.data || []).length,
      reflectionCount: (reflections.data || []).length,
      scenarioCount: (scenarios.data || []).length,
      visualCount: (visuals.data || []).length,
      recentCheckins: checkins.data || [],
      visualDist,
      notes,
      nudges,
      defaultNudge: DEFAULT_NUDGE,
      // Intentionally omit reflection text
    };
  }

  async function adminCreateScenario(payload) {
    await requireAdmin();
    const row = {
      title: String(payload.title || '').trim(),
      category: String(payload.category || '').trim(),
      story: String(payload.story || '').trim(),
      question: String(payload.question || '').trim(),
      option_a: String(payload.option_a || '').trim(),
      option_b: String(payload.option_b || '').trim(),
      option_c: String(payload.option_c || '').trim(),
      option_d: String(payload.option_d || '').trim(),
      is_active: payload.is_active !== false,
    };
    if (!row.title || !row.story || !row.question) throw new Error('Title, story, and question are required.');
    const { data, error } = await getClient().from('scenario_bank').insert(row).select('*').single();
    if (error) throw error;
    return data;
  }

  async function adminUpdateScenario(id, payload) {
    await requireAdmin();
    const { data, error } = await getClient()
      .from('scenario_bank')
      .update({
        title: payload.title,
        category: payload.category,
        story: payload.story,
        question: payload.question,
        option_a: payload.option_a,
        option_b: payload.option_b,
        option_c: payload.option_c,
        option_d: payload.option_d,
        is_active: payload.is_active,
      })
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  }

  async function adminDeleteScenario(id) {
    await requireAdmin();
    const { error } = await getClient().from('scenario_bank').delete().eq('id', id);
    if (error) throw error;
  }

  global.Lighthouse = {
    isConfigured,
    getClient,
    getSession,
    getUser,
    requireAuth,
    signUp,
    signIn,
    signOut,
    resetPassword,
    displayNameFromUser,
    initialsFromName,
    localDateString,
    listReflections,
    createReflection,
    deleteReflection,
    countReflections,
    hasReflectionToday,
    MOODS,
    ACTIVITIES,
    VISUAL_OPTIONS,
    listCheckins,
    getTodayCheckin,
    upsertTodayCheckin,
    deleteCheckin,
    listScenarios,
    listScenarioResponses,
    getTodayScenarioResponse,
    pickTodaysScenario,
    saveScenarioResponse,
    listVisualReflections,
    getTodayVisualReflection,
    saveVisualReflection,
    getTodaysProgress,
    getDashboardMetrics,
    formatDate,
    formatTime,
    formatRelativeDate,
    escapeHtml,
    isFlowMode,
    ensureProfile,
    updateProfile,
    touchLastLogin,
    getPreferences,
    updatePreferences,
    changePassword,
    getProfileStats,
    getInsightsData,
    getReport,
    requireAdmin,
    adminListProfiles,
    adminUpdateProfile,
    adminGetAnalytics,
    adminGetUserSummary,
    adminCreateScenario,
    adminUpdateScenario,
    adminDeleteScenario,
    adminListNotes,
    adminAddNote,
    adminSendNudge,
    adminListNudges,
    adminSetWatchlist,
    adminClearWatchlist,
    getActiveNudge,
    dismissNudge,
    DEFAULT_NUDGE,
  };
})(window);
