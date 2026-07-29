/* One-off generator: node scripts/gen-scenarios.js */
const fs = require('fs');
const path = require('path');

const cats = [
  'Academic Pressure', 'Time Management', 'Sleep Habits', 'Motivation', 'Communication',
  'Conflict Resolution', 'Social Interaction', 'Lifestyle Balance', 'Decision Making', 'Self-care',
  'Work Stress', 'Family Relationships', 'Friendships', 'Digital Wellbeing', 'Financial Responsibility',
  'Leadership', 'Teamwork', 'Goal Setting', 'Emotional Regulation', 'Healthy Habits',
];

const situations = [
  ['Deadline Creep', 'You have an important deadline tomorrow, but smaller tasks keep pulling your attention away.'],
  ['Overloaded Inbox', 'Messages and notifications piled up while you were focused on other work.'],
  ['Energy Crash', 'Mid-afternoon your energy drops and concentrating becomes difficult.'],
  ['Plan Disruption', 'Your carefully made plan for the day is disrupted by an unexpected request.'],
  ['Comparison Spiral', 'You catch yourself comparing your progress to someone who seems ahead.'],
  ['Awkward Pause', 'A conversation with someone important stalls and feels uncomfortable.'],
  ['Boundary Moment', 'Someone asks for help at a time when you already feel stretched thin.'],
  ['Habit Slip', 'You missed a healthy habit you usually keep and feel annoyed with yourself.'],
  ['Meeting Overload', 'Back-to-back meetings leave little time to think or recover.'],
  ['Silent Team', 'In a group chat, nobody replies to a question you asked hours ago.'],
  ['Budget Tension', 'An unexpected expense appears and your monthly budget feels tight.'],
  ['Screen Fatigue', 'You realize you have been on screens for hours without a real break.'],
  ['Family Expectation', 'A family member expects more time than you can comfortably give this week.'],
  ['Friend Distance', 'A close friend seems distant and you are unsure whether to bring it up.'],
  ['Goal Drift', 'You notice your weekly goals have slipped for the third time in a row.'],
  ['Feedback Sting', 'You receive blunt feedback that feels harsh even if partly useful.'],
  ['Shared Credit', 'A teammate presents shared work as mostly their own idea.'],
  ['Late Night Work', 'You feel tempted to keep working late to finish “just one more thing.”'],
  ['Morning Rush', 'You woke up late and the morning already feels chaotic.'],
  ['Quiet Anxiety', 'You feel restless before a presentation but do not want to cancel.'],
];

const optionSets = [
  [
    'Pause, reprioritize, then act on the highest-impact item.',
    'Keep pushing without changing your approach.',
    'Ask someone trusted for a quick perspective.',
    'Put everything off until you feel ready.',
  ],
  [
    'Set a short timer and clear the most urgent items first.',
    'Ignore it and hope it resolves itself.',
    'Delegate or ask for help where possible.',
    'Switch tasks repeatedly without finishing any.',
  ],
  [
    'Take a brief restorative break, then resume with a smaller step.',
    'Force through with willpower alone.',
    'Talk through the situation with a peer.',
    'Stop for the day and abandon the plan.',
  ],
  [
    'Renegotiate expectations and adjust the plan.',
    'Accept everything and overcommit.',
    'Avoid responding until much later.',
    'Drop your original priorities entirely.',
  ],
];

function esc(s) {
  return String(s).replace(/'/g, "''");
}

const rows = [];
for (let i = 0; i < 80; i++) {
  const cat = cats[i % cats.length];
  const sit = situations[i % situations.length];
  const opts = optionSets[i % optionSets.length];
  const title = `${sit[0]} (${cat.split(' ')[0]} ${Math.floor(i / situations.length) + 1})`;
  const story = `${sit[1]} This connects to ${cat.toLowerCase()} in everyday life.`;
  rows.push({
    title,
    category: cat,
    story,
    question: 'What would you most likely do?',
    a: opts[0],
    b: opts[1],
    c: opts[2],
    d: opts[3],
  });
}

const values = rows
  .map(
    (r) =>
      `    ('${esc(r.title)}', '${esc(r.category)}', '${esc(r.story)}', '${esc(r.question)}', '${esc(r.a)}', '${esc(r.b)}', '${esc(r.c)}', '${esc(r.d)}')`
  )
  .join(',\n');

const sql = `-- Extended scenario bank (~80 additional scenarios)
-- Run after schema_wellbeing.sql / schema_journey_extended.sql

DO $$
BEGIN
  IF (SELECT COUNT(*) FROM public.scenario_bank) < 90 THEN
    INSERT INTO public.scenario_bank
      (title, category, story, question, option_a, option_b, option_c, option_d)
    VALUES
${values};
  END IF;
END $$;
`;

const out = path.join(__dirname, '..', 'supabase', 'seed_scenarios_extended.sql');
fs.writeFileSync(out, sql);
console.log('Wrote', rows.length, 'scenarios to', out);
