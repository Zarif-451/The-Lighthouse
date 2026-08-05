/* ==========================================================================
   Lighthouse — Groq AI Companion Server
   Secure proxy: holds GROQ_API_KEY, serves static files, handles chat API.
   ========================================================================== */
require('dotenv').config();

const express = require('express');
const path = require('path');
const Groq = require('groq-sdk');

const app = express();
const PORT = process.env.PORT || 3000;

// ---------------------------------------------------------------- Groq setup
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const MODEL = 'llama-3.3-70b-versatile';

// ---------------------------------------------------------------- System prompt
const SYSTEM_PROMPT = `You are the Lighthouse Companion — a warm, intelligent, privacy-first wellbeing assistant built into the Lighthouse personal wellbeing platform.

Your purpose is to help users understand, reflect on, and make sense of their own Lighthouse data. You are NOT a general-purpose AI assistant. You are a personalised companion for this specific application.

## Your responsibilities
You help users understand:
- Their Dashboard analytics (wellness score, sleep average, mood trends, productivity, activity)
- Their Daily Check-ins (sleep, mood, energy, productivity, physical activity)
- Their Reflection Journal entries
- Their Scenario Assessment responses
- Their Behavioral activities: Memory Challenge, Reaction Challenge, Click Accuracy Challenge
- Their Daily Journey progress and step completion
- Their weekly and monthly progress reports
- Their streaks and consistency patterns

## Behaviour rules
- ALWAYS base your responses on the user's actual Lighthouse data provided in the context snapshot below.
- If a user asks about data that is NOT in the snapshot or has insufficient entries, say clearly: "I don't have enough Lighthouse data to answer that yet — completing more [activity] will unlock this insight."
- NEVER fabricate scores, dates, streaks, or trends.
- NEVER diagnose depression, anxiety, stress disorders, or any mental health condition.
- NEVER claim certainty about the user's emotional state.
- NEVER access or reference data belonging to any other user.
- Only describe observations that are directly supported by the data provided.

## Response style
- Concise by default: 2–5 sentences.
- Only expand when the user explicitly asks for more detail.
- Skip unnecessary introductions and preambles — get straight to the insight.
- Skip safety disclaimers unless genuinely relevant — do not add them to every message.
- Tone: friendly, professional, supportive, calm, encouraging.
- Use "I" not "We". You are a personal companion, not a corporate chatbot.
- When celebrating achievements, be genuine and specific — not generic.

## Context snapshot
The user's real Lighthouse data is provided in a separate system message immediately following this one. Always refer to it when answering questions about their data.`;

// ---------------------------------------------------------------- Context formatter
function buildContextMessage(context) {
  if (!context || typeof context !== 'object') return null;

  const lines = ['## User\'s Lighthouse Data Snapshot\n'];
  const today = new Date().toISOString().slice(0, 10);
  lines.push(`Today's date: ${today}\n`);

  // Profile
  if (context.profile) {
    const p = context.profile;
    lines.push(`### Profile`);
    if (p.displayName) lines.push(`- Name: ${p.displayName}`);
    if (p.occupation) lines.push(`- Occupation: ${p.occupation}`);
    if (p.interests && p.interests.length) lines.push(`- Interests: ${p.interests.join(', ')}`);
    if (p.shortBio) lines.push(`- Bio: ${p.shortBio}`);
    lines.push('');
  }

  // Today's journey
  if (context.todaysProgress) {
    const tp = context.todaysProgress;
    lines.push(`### Today's Journey`);
    lines.push(`- Steps completed: ${tp.completed} of ${tp.total}`);
    if (tp.next) lines.push(`- Next step: ${tp.labels?.[tp.next] || tp.next}`);
    if (tp.steps) {
      const done = Object.entries(tp.steps)
        .filter(([k, v]) => v && !k.startsWith('scenario') && k !== 'scenario')
        .map(([k]) => tp.labels?.[k] || k);
      if (done.length) lines.push(`- Completed today: ${done.join(', ')}`);
    }
    lines.push('');
  }

  // Check-ins (last 14)
  if (context.recentCheckins && context.recentCheckins.length) {
    const checkins = context.recentCheckins;
    lines.push(`### Recent Check-ins (last ${checkins.length})`);
    const sleepVals = checkins.map(c => Number(c.sleep_hours)).filter(n => !isNaN(n));
    const avgSleep = sleepVals.length
      ? (sleepVals.reduce((a, b) => a + b, 0) / sleepVals.length).toFixed(1)
      : null;
    const moodMap = { 'Very Low': 1, Low: 2, Neutral: 3, Good: 4, Excellent: 5 };
    const moodVals = checkins.map(c => moodMap[c.mood]).filter(Boolean);
    const avgMoodNum = moodVals.length
      ? moodVals.reduce((a, b) => a + b, 0) / moodVals.length
      : null;
    const moodLabels = ['Very Low', 'Low', 'Neutral', 'Good', 'Excellent'];
    const avgMood = avgMoodNum != null ? moodLabels[Math.round(avgMoodNum) - 1] : null;
    const energyVals = checkins.map(c => Number(c.energy_level)).filter(n => n >= 1 && n <= 5);
    const avgEnergy = energyVals.length
      ? (energyVals.reduce((a, b) => a + b, 0) / energyVals.length).toFixed(1)
      : null;
    const prodVals = checkins.map(c => Number(c.productivity)).filter(n => n >= 1 && n <= 5);
    const avgProd = prodVals.length
      ? (prodVals.reduce((a, b) => a + b, 0) / prodVals.length).toFixed(1)
      : null;

    if (avgSleep) lines.push(`- Average sleep: ${avgSleep} hours`);
    if (avgMood) lines.push(`- Average mood: ${avgMood}`);
    if (avgEnergy) lines.push(`- Average energy: ${avgEnergy}/5`);
    if (avgProd) lines.push(`- Average productivity: ${avgProd}/5`);

    // Most recent check-in details
    const latest = checkins[0];
    if (latest) {
      lines.push(`- Most recent (${latest.checkin_date}): sleep ${latest.sleep_hours}h, mood ${latest.mood}, energy ${latest.energy_level}/5, productivity ${latest.productivity}/5, activity ${latest.physical_activity}`);
      if (latest.notes) lines.push(`  Notes: "${latest.notes.slice(0, 200)}"`);
    }
    lines.push('');
  } else {
    lines.push(`### Check-ins\n- No check-in data yet.\n`);
  }

  // Behavioral activities
  if (context.activityStats) {
    const a = context.activityStats;
    lines.push(`### Behavioral Activities`);
    lines.push(`- Total completed: ${a.totalCompleted}`);
    lines.push(`- Current streak: ${a.streak} day(s)`);
    if (a.weeklyCompletionDays != null) lines.push(`- Activity days this week: ${a.weeklyCompletionDays}`);
    if (a.memoryAvgAccuracy != null) lines.push(`- Memory Challenge avg accuracy: ${a.memoryAvgAccuracy}%`);
    if (a.reactionAvgMs != null) lines.push(`- Reaction Challenge avg time: ${a.reactionAvgMs}ms`);
    if (a.clickAccuracyAvg != null) lines.push(`- Click Accuracy avg: ${a.clickAccuracyAvg}% (${a.clickAccuracyCount} sessions)`);
    if (a.favorite) lines.push(`- Favourite activity: ${a.favorite}`);
    if (a.lastActivityDate) lines.push(`- Last activity date: ${a.lastActivityDate}`);

    // Today's specific results
    if (context.todayActivities) {
      const ta = context.todayActivities;
      if (ta.memory) lines.push(`- Today's Memory: accuracy ${ta.memory.accuracy}%, score ${ta.memory.score}`);
      if (ta.reaction) lines.push(`- Today's Reaction: ${ta.reaction.score}ms`);
      if (ta.click_accuracy) lines.push(`- Today's Click Accuracy: ${ta.click_accuracy.accuracy}%`);
    }
    lines.push('');
  }

  // Dashboard wellness score
  if (context.dashboardMetrics) {
    const d = context.dashboardMetrics;
    lines.push(`### Dashboard`);
    if (d.realAnalytics?.wellnessScore != null) {
      lines.push(`- Wellness score: ${d.realAnalytics.wellnessScore}/100`);
    }
    if (d.realAnalytics?.sleepAvg != null) lines.push(`- Sleep avg (30 days): ${d.realAnalytics.sleepAvg}h`);
    if (d.realAnalytics?.moodAvg != null) lines.push(`- Mood avg (30 days): ${d.realAnalytics.moodAvg}/5`);
    if (d.realAnalytics?.prodAvg != null) lines.push(`- Productivity avg (30 days): ${d.realAnalytics.prodAvg}/5`);
    lines.push(`- Total check-ins on record: ${d.checkinCount || 0}`);
    lines.push(`- Total reflections on record: ${d.journalCount || 0}`);
    lines.push('');
  }

  // Weekly report
  if (context.weeklyReport) {
    const w = context.weeklyReport;
    lines.push(`### Weekly Report (${w.start} → ${w.end})`);
    lines.push(`- Check-ins this week: ${w.checkinCount}`);
    lines.push(`- Reflections this week: ${w.reflectionCount}`);
    lines.push(`- Activities this week: ${w.activityCount}`);
    if (w.sleepAvg != null) lines.push(`- Sleep avg this week: ${w.sleepAvg}h`);
    const moodLabels = ['Very Low', 'Low', 'Neutral', 'Good', 'Excellent'];
    if (w.moodAvg != null) lines.push(`- Mood avg this week: ${moodLabels[Math.round(w.moodAvg) - 1] || w.moodAvg}`);
    lines.push('');
  }

  // Reflections (actual text)
  if (context.recentReflections && context.recentReflections.length) {
    lines.push(`### Recent Journal Reflections`);
    context.recentReflections.forEach((r, i) => {
      const date = r.created_at ? r.created_at.slice(0, 10) : 'unknown date';
      const text = (r.reflection_text || '').slice(0, 350);
      lines.push(`${i + 1}. [${date}] "${text}${r.reflection_text?.length > 350 ? '…' : ''}"`);
    });
    lines.push('');
  } else {
    lines.push(`### Journal Reflections\n- No reflections written yet.\n`);
  }

  // Scenario responses (summary only — no question text)
  if (context.scenarioCount != null) {
    lines.push(`### Scenario Assessments`);
    lines.push(`- Total scenarios completed: ${context.scenarioCount}`);
    lines.push('');
  }

  return lines.join('\n');
}

let groqClient = null;

function getGroqClient() {
  if (!GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY is not set. Please add it to your .env file.');
  }
  if (!groqClient) {
    groqClient = new Groq({ apiKey: GROQ_API_KEY });
  }
  return groqClient;
}

// ------------------------------------------------------------ Middleware
app.use(express.json({ limit: '64kb' }));

// Serve all static files from the root
app.use(express.static(path.join(__dirname)));

// ------------------------------------------------------------ /api/chat
app.post('/api/chat', async (req, res) => {
  const { message, history, context } = req.body;

  // Validate message
  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'Message is required.' });
  }
  const trimmed = message.trim();
  if (!trimmed || trimmed.length > 1200) {
    return res.status(400).json({ error: 'Message must be between 1 and 1200 characters.' });
  }

  // Build conversation history
  const historyMessages = Array.isArray(history)
    ? history
        .filter(m => m && m.role && m.content)
        .slice(-20)
        .map(m => ({
          role: m.role === 'ai' ? 'assistant' : 'user',
          content: String(m.content).slice(0, 1200),
        }))
    : [];

  // Build messages array:
  // [system: persona] [system: context snapshot] [...history] [user: message]
  const messages = [{ role: 'system', content: SYSTEM_PROMPT }];

  const contextText = buildContextMessage(context);
  if (contextText) {
    messages.push({ role: 'system', content: contextText });
  }

  messages.push(...historyMessages);
  messages.push({ role: 'user', content: trimmed });

  try {
    const client = getGroqClient();
    const completion = await client.chat.completions.create({
      model: MODEL,
      messages,
      temperature: 0.7,
      max_tokens: 600,
      top_p: 0.9,
    });

    const reply = completion.choices?.[0]?.message?.content;
    if (!reply) {
      return res.status(500).json({ error: 'The AI did not return a response. Please try again.' });
    }

    return res.json({ reply: reply.trim() });

  } catch (err) {
    console.error('[Groq error]', err?.message || err);
    const status = err?.status || err?.statusCode;

    if (status === 429) {
      return res.status(429).json({
        error: 'The AI is receiving too many requests right now. Please wait a moment and try again.',
      });
    }
    if (status === 401 || status === 403) {
      return res.status(500).json({
        error: 'The AI service is not configured correctly. Please contact the administrator.',
      });
    }
    if (status === 408 || err?.code === 'ECONNRESET' || err?.code === 'ETIMEDOUT') {
      return res.status(503).json({
        error: 'The AI took too long to respond. Please try again.',
      });
    }
    if (status >= 500) {
      return res.status(503).json({
        error: 'The AI service is temporarily unavailable. Please try again in a moment.',
      });
    }

    return res.status(500).json({
      error: 'Something went wrong with the AI. Please try again.',
    });
  }
});

// ------------------------------------------------------------ Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', groqConfigured: !!GROQ_API_KEY, model: MODEL });
});

// ------------------------------------------------------------ SPA fallback
app.get('/{*path}', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, 'index.html'));
  }
});

// ------------------------------------------------------------ Start
app.listen(PORT, () => {
  if (!GROQ_API_KEY) {
    console.warn('\n⚠️  WARNING: GROQ_API_KEY is not set!');
    console.warn('   Create a .env file in the project root with:');
    console.warn('   GROQ_API_KEY=your_key_here\n');
  } else {
    console.log(`\n✅  Groq API key loaded (model: ${MODEL})`);
  }
  console.log(`🗼  Lighthouse running at http://localhost:${PORT}\n`);
});
