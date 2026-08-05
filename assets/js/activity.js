/* ==========================================================================
   Lighthouse — Behavioral Activities (memory, word_puzzle, reaction)
   Extensible via ACTIVITY_DEFS registry.
   ========================================================================== */
(function () {
  'use strict';

  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  const toast = $('#toast');
  const toastMsg = $('#toastMsg');
  let toastTimer;
  function showToast(msg) {
    toastMsg.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2800);
  }

  const sidebar = $('#sidebar');
  const overlay = $('#overlay');
  $('#hamburger').addEventListener('click', () => { sidebar.classList.add('open'); overlay.classList.add('show'); });
  overlay.addEventListener('click', () => { sidebar.classList.remove('open'); overlay.classList.remove('show'); });
  $$('.side-nav a').forEach((a) => {
    a.addEventListener('click', () => {
      sidebar.classList.remove('open');
      overlay.classList.remove('show');
    });
  });

  const MEMORY_ICONS = ['🌊', '🌲', '☀️', '🌙', '⭐', '🔥', '🍃', '🎵', '📚', '🧩', '🔑', '🏠'];
  const WORDS = ['CALM', 'FOCUS', 'BREATHE', 'BALANCE', 'ENERGY', 'GROWTH', 'HABIT', 'MINDFUL', 'REST', 'CLARITY'];

  const ACTIVITY_DEFS = {
    memory: {
      title: 'Memory Challenge',
      eyebrow: 'Concentration',
      intro: 'You will see several symbols briefly. Then pick which ones were shown. This helps track short-term focus.',
      stepKey: 'memory',
    },
    word_puzzle: {
      title: 'Word Puzzle',
      eyebrow: 'Cognitive engagement',
      intro: 'Unscramble the wellbeing-related word. Use a hint if needed. Aim to finish within about a minute.',
      stepKey: 'word_puzzle',
    },
    reaction: {
      title: 'Reaction Challenge',
      eyebrow: 'Attention',
      intro: 'Wait for the screen to turn teal, then tap as quickly as you can. Three valid attempts are recorded.',
      stepKey: 'reaction',
    },
    click_accuracy: {
      title: 'Click Accuracy Challenge',
      eyebrow: 'Precision',
      intro: 'Circular targets will appear one at a time. Click each target before it fades. Targets last a short while — aim carefully.',
      stepKey: 'click_accuracy',
    },
  };

  const ACTIVITY_KEYS = Object.keys(ACTIVITY_DEFS);

  let type = 'memory';
  let def = ACTIVITY_DEFS.memory;
  let startedAt = 0;
  let hintsUsed = 0;

  function syncUrlType(t) {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('flow', '1');
      url.searchParams.set('type', t);
      window.history.replaceState({}, '', url.pathname + url.search + url.hash);
    } catch (e) { /* ignore */ }
  }

  function setActivity(t) {
    type = t;
    def = ACTIVITY_DEFS[t];
    syncUrlType(t);
  }

  function setHint(msg, isError) {
    const el = $('#activityHint');
    if (!el) return;
    el.textContent = msg || '';
    el.classList.toggle('error', !!isError);
  }

  function showIntro() {
    $('#activityIntro').hidden = false;
    $('#activityPlay').hidden = true;
    $('#activityDone').hidden = true;
    $('#activityTitle').textContent = def.title;
    $('#activitySub').textContent = 'Sequential step in today’s wellbeing journey';
    $('#activityEyebrow').textContent = def.eyebrow;
    $('#introTitle').textContent = def.title;
    $('#introBody').textContent = def.intro;
    const startBtn = $('#startActivityBtn');
    if (startBtn) {
      startBtn.disabled = false;
      startBtn.textContent = 'Start';
    }
  }

  function showDone(summary) {
    $('#activityIntro').hidden = true;
    $('#activityPlay').hidden = true;
    $('#activityDone').hidden = false;
    $('#doneTitle').textContent = 'Activity complete';
    $('#doneSummary').textContent = summary;
  }

  async function persist(payload) {
    await window.Lighthouse.saveActivityResult({
      activityType: type,
      score: payload.score,
      accuracy: payload.accuracy,
      completionTime: payload.completionTime,
      attempts: payload.attempts,
      meta: payload.meta || {},
    });
  }

  function finish(summary, payload) {
    const elapsed = (Date.now() - startedAt) / 1000;
    const body = { ...payload, completionTime: payload.completionTime != null ? payload.completionTime : elapsed };
    persist(body)
      .then(() => {
        const fallback = window.LighthouseJourney.staticNextHref(def.stepKey);
        if (window.Lighthouse.isFlowMode()) {
          // force: true ensures we always go to the static next step without a DB re-query,
          // preventing timing issues where the activity save hasn't propagated yet.
          window.LighthouseJourney.showTransitionThen(def.stepKey, fallback, { force: true });
        } else {
          showDone(summary);
        }
      })
      .catch((err) => {
        showToast(err.message || 'Could not save activity.');
        setHint(err.message || 'Could not save.', true);
      });
  }

  /* ----------------------------- Memory ---------------------------------- */
  function runMemory() {
    const targetCount = 6;
    const decoys = 4;
    const pool = MEMORY_ICONS.slice().sort(() => Math.random() - 0.5);
    const targets = pool.slice(0, targetCount);
    const targetSet = new Set(targets);
    const choices = pool.slice(0, targetCount + decoys).sort(() => Math.random() - 0.5);
    const selected = new Set();
    const stage = $('#activityStage');
    const actions = $('#activityActions');

    stage.innerHTML = `<p style="color:var(--text-soft);margin-bottom:14px">Memorize these symbols…</p>
      <div class="memory-grid">${targets.map((ic) => `<div class="memory-tile">${ic}</div>`).join('')}</div>`;
    actions.innerHTML = '';

    setTimeout(() => {
      stage.innerHTML = `<p style="color:var(--text-soft);margin-bottom:14px">Select the ${targetCount} symbols you saw</p>
        <div class="memory-grid" id="memoryChoices">${choices.map((ic, i) =>
          `<button type="button" class="memory-tile" data-ic="${ic}" data-i="${i}">${ic}</button>`
        ).join('')}</div>`;
      actions.innerHTML = `<button type="button" class="btn btn-primary" id="submitMemoryBtn" disabled>Check answers</button>`;

      $('#memoryChoices').addEventListener('click', (e) => {
        const btn = e.target.closest('.memory-tile');
        if (!btn) return;
        const ic = btn.dataset.ic;
        if (selected.has(ic)) {
          selected.delete(ic);
          btn.classList.remove('selected');
        } else if (selected.size < targetCount) {
          selected.add(ic);
          btn.classList.add('selected');
        }
        $('#submitMemoryBtn').disabled = selected.size !== targetCount;
      });

      $('#submitMemoryBtn').addEventListener('click', () => {
        let correct = 0;
        $$('#memoryChoices .memory-tile').forEach((btn) => {
          const ic = btn.dataset.ic;
          if (selected.has(ic) && targetSet.has(ic)) {
            correct += 1;
            btn.classList.add('correct');
          } else if (selected.has(ic)) {
            btn.classList.add('wrong');
          }
        });
        const accuracy = Math.round((correct / targetCount) * 100);
        finish(`You recalled ${correct}/${targetCount} correctly (${accuracy}% accuracy).`, {
          score: correct,
          accuracy,
          attempts: 1,
          meta: { targetCount, correct },
        });
      });
    }, 3500);
  }

  /* ----------------------------- Word puzzle ----------------------------- */
  function scramble(word) {
    const chars = word.split('');
    for (let i = chars.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = chars[i]; chars[i] = chars[j]; chars[j] = t;
    }
    const out = chars.join('');
    return out === word ? scramble(word) : out;
  }

  function runWordPuzzle() {
    const word = WORDS[Math.floor(Math.random() * WORDS.length)];
    const scrambled = scramble(word);
    hintsUsed = 0;
    const stage = $('#activityStage');
    const actions = $('#activityActions');
    stage.innerHTML = `
      <p style="color:var(--text-soft);margin-bottom:10px">Unscramble this word</p>
      <div class="scrambled-word">${scrambled}</div>
      <input class="field word-puzzle-input" id="wordGuess" maxlength="12" autocomplete="off" placeholder="Your answer" />
    `;
    actions.innerHTML = `
      <button type="button" class="btn btn-ghost" id="hintBtn">Hint</button>
      <button type="button" class="btn btn-primary" id="submitWordBtn">Submit</button>
    `;

    const check = () => {
      const guess = ($('#wordGuess').value || '').trim().toUpperCase();
      if (guess === word) {
        finish(`Solved “${word}” with ${hintsUsed} hint${hintsUsed === 1 ? '' : 's'}.`, {
          score: Math.max(0, 100 - hintsUsed * 20),
          accuracy: 100,
          attempts: 1,
          meta: { word, hintsUsed },
        });
      } else {
        setHint('Not quite — try again.', true);
      }
    };

    $('#submitWordBtn').addEventListener('click', check);
    $('#wordGuess').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); check(); }
    });
    $('#hintBtn').addEventListener('click', () => {
      hintsUsed += 1;
      const reveal = word.slice(0, Math.min(word.length, hintsUsed));
      setHint(`Hint: starts with “${reveal}…”`);
    });
  }

  /* ----------------------------- Reaction -------------------------------- */
  function runReaction() {
    const times = [];
    let attempt = 0;
    let phase = 'idle';
    let goAt = 0;
    let timer = null;
    const stage = $('#activityStage');
    const actions = $('#activityActions');
    const maxAttempts = 3;

    stage.innerHTML = `<div class="reaction-arena wait" id="reactionArena" tabindex="0"><div id="reactionMsg">Tap Start, then wait for teal</div></div>`;
    actions.innerHTML = `<button type="button" class="btn btn-primary" id="reactionStartBtn">Start attempt 1</button>`;

    const arena = () => $('#reactionArena');
    const msg = () => $('#reactionMsg');

    function arm() {
      phase = 'wait';
      arena().className = 'reaction-arena wait';
      msg().textContent = 'Wait for teal…';
      const delay = 1200 + Math.random() * 2800;
      clearTimeout(timer);
      timer = setTimeout(() => {
        phase = 'go';
        goAt = performance.now();
        arena().className = 'reaction-arena go';
        msg().textContent = 'Tap now!';
      }, delay);
    }

    function onTap() {
      if (phase === 'wait') {
        clearTimeout(timer);
        phase = 'early';
        arena().className = 'reaction-arena early';
        msg().textContent = 'Too early — wait for teal.';
        $('#reactionStartBtn').disabled = false;
        $('#reactionStartBtn').textContent = `Retry attempt ${attempt + 1}`;
        return;
      }
      if (phase !== 'go') return;
      const ms = Math.round(performance.now() - goAt);
      times.push(ms);
      attempt += 1;
      phase = 'idle';
      arena().className = 'reaction-arena wait';
      msg().textContent = `Attempt ${attempt}: ${ms} ms`;
      if (attempt >= maxAttempts) {
        const best = Math.min(...times);
        const avg = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
        finish(`Best ${best} ms · Average ${avg} ms across ${maxAttempts} attempts.`, {
          score: best,
          accuracy: null,
          attempts: maxAttempts,
          completionTime: avg / 1000,
          meta: { times, best, avg },
        });
        return;
      }
      $('#reactionStartBtn').disabled = false;
      $('#reactionStartBtn').textContent = `Start attempt ${attempt + 1}`;
    }

    arena().addEventListener('click', onTap);
    $('#reactionStartBtn').addEventListener('click', () => {
      $('#reactionStartBtn').disabled = true;
      arm();
    });
  }

  /* ----------------------------- Click Accuracy --------------------------- */
  function runClickAccuracy() {
    const DURATION = 25;
    const TARGET_LIFETIME = 2200;
    const TARGET_SIZE = 64;
    const PADDING = 48;
    let totalTargets = 0;
    let hits = 0;
    let misses = 0;
    let currentTimer = null;
    let activeTarget = null;
    let gameOver = false;

    const stage = $('#activityStage');
    const arena = document.createElement('div');
    arena.className = 'click-accuracy-arena';
    arena.id = 'clickAccuracyArena';
    stage.innerHTML = '';
    stage.appendChild(arena);
    $('#activityActions').innerHTML =
      `<div style="display:flex;align-items:center;gap:12px;justify-content:center;flex-wrap:wrap">
        <span id="clickAccHits" style="color:var(--secondary);font-weight:700">Hits: 0</span>
        <span id="clickAccTimer" style="color:var(--text-muted);font-weight:600">${DURATION}s</span>
      </div>`;

    const arenaEl = $('#clickAccuracyArena');
    const hitsEl = $('#clickAccHits');
    const timerEl = $('#clickAccTimer');

    function randomPosition() {
      const rect = arenaEl.getBoundingClientRect();
      const maxX = rect.width - TARGET_SIZE - PADDING;
      const maxY = rect.height - TARGET_SIZE - PADDING;
      if (maxX <= 0 || maxY <= 0) return { left: '40%', top: '40%' };
      const left = PADDING + Math.random() * maxX;
      const top = PADDING + Math.random() * maxY;
      return { left: `${Math.round(left)}px`, top: `${Math.round(top)}px` };
    }

    function spawnTarget() {
      if (gameOver) return;
      if (activeTarget) {
        activeTarget.remove();
        misses += 1;
      }

      totalTargets += 1;
      const target = document.createElement('button');
      target.type = 'button';
      target.className = 'click-accuracy-target';
      const pos = randomPosition();
      target.style.left = pos.left;
      target.style.top = pos.top;
      target.addEventListener('click', (e) => {
        e.stopPropagation();
        if (gameOver) return;
        hits += 1;
        hitsEl.textContent = `Hits: ${hits}`;
        clearTimeout(currentTimer);
        target.remove();
        activeTarget = null;
        spawnTarget();
      });
      arenaEl.appendChild(target);

      requestAnimationFrame(() => requestAnimationFrame(() => {
        target.classList.add('show');
        activeTarget = target;
        currentTimer = setTimeout(() => {
          if (activeTarget === target) {
            target.remove();
            activeTarget = null;
            misses += 1;
            if (!gameOver) spawnTarget();
          }
        }, TARGET_LIFETIME);
      }));
    }

    arenaEl.addEventListener('click', (e) => {
      if (e.target === arenaEl && !gameOver) {
        misses += 1;
      }
    });

    let elapsed = 0;
    const timerInterval = setInterval(() => {
      elapsed += 1;
      const remaining = DURATION - elapsed;
      timerEl.textContent = `${Math.max(0, remaining)}s`;
      if (remaining <= 0) {
        gameOver = true;
        clearInterval(timerInterval);
        clearTimeout(currentTimer);
        if (activeTarget) { activeTarget.remove(); activeTarget = null; }
        arenaEl.innerHTML = '';

        const total = Math.max(1, totalTargets);
        const accuracy = Math.round((hits / total) * 100);
        finish(
          `You hit ${hits}/${totalTargets} targets (${accuracy}% accuracy) with ${misses} missed.`,
          {
            score: hits,
            accuracy,
            attempts: 1,
            completionTime: DURATION,
            meta: { totalTargets: total, hits, misses, duration: DURATION },
          }
        );
      }
    }, 1000);

    spawnTarget();
  }

  $('#startActivityBtn').addEventListener('click', () => {
    startedAt = Date.now();
    $('#activityIntro').hidden = true;
    $('#activityPlay').hidden = false;
    setHint('');
    if (type === 'word_puzzle') runWordPuzzle();
    else if (type === 'reaction') runReaction();
    else if (type === 'click_accuracy') runClickAccuracy();
    else runMemory();
  });

  $('#continueJourneyBtn').addEventListener('click', () => {
    const fallback = window.LighthouseJourney.staticNextHref(def.stepKey);
    window.LighthouseJourney.showTransitionThen(def.stepKey, fallback, { force: true });
  });

  $('#logoutBtn').addEventListener('click', async () => {
    try { await window.Lighthouse.signOut(); } catch (e) { /* ignore */ }
    window.location.href = 'index.html';
  });

  const userChip = $('#userChip');
  if (userChip) {
    userChip.style.cursor = 'pointer';
    userChip.addEventListener('click', () => { window.location.href = 'profile.html'; });
  }

  function resolveTypeFromProgress(progress, typeParam) {
    if (typeParam && ACTIVITY_DEFS[typeParam]) return typeParam;
    const next = progress && progress.next;
    if (next && ACTIVITY_DEFS[next]) return next;
    // If next is not an activity, prefer an incomplete activity step
    for (let i = 0; i < ACTIVITY_KEYS.length; i += 1) {
      const key = ACTIVITY_KEYS[i];
      if (progress && progress.steps && !progress.steps[key]) return key;
    }
    return typeParam || 'memory';
  }

  (async function init() {
    try {
      if (!window.Lighthouse || !window.Lighthouse.isConfigured) {
        window.location.href = 'index.html#auth';
        return;
      }
      const user = await window.Lighthouse.requireAuth('index.html#auth');
      if (!user) return;
      const name = window.Lighthouse.displayNameFromUser(user);
      $('#userName').textContent = name;
      $('#userAva').textContent = window.Lighthouse.initialsFromName(name);

      const params = new URLSearchParams(window.location.search);
      const typeParam = String(params.get('type') || '').toLowerCase();
      const progress = await window.Lighthouse.getTodaysProgress();

      // If journey moved past activities, leave once (guarded)
      if (
        progress.next
        && !ACTIVITY_DEFS[progress.next]
        && typeParam
        && progress.steps[typeParam]
        && progress.nextHref
      ) {
        const guardKey = `lh_leave_act_${typeParam}_${window.Lighthouse.localDateString()}`;
        if (sessionStorage.getItem(guardKey) !== progress.next) {
          sessionStorage.setItem(guardKey, progress.next);
          window.location.href = progress.nextHref;
          return;
        }
      }

      // Resolve Word Puzzle / Memory / Reaction from live progress when ?type= is missing
      // (clean URLs like /activity often drop query params and used to default to Memory forever)
      const resolved = resolveTypeFromProgress(progress, typeParam);
      if (!ACTIVITY_DEFS[resolved]) {
        showToast('Unknown activity type.');
        setTimeout(() => { window.location.href = 'dashboard.html'; }, 800);
        return;
      }
      setActivity(resolved);

      // If this activity is already done and next is a different activity, switch in-place
      if (
        progress.steps[def.stepKey]
        && progress.next
        && ACTIVITY_DEFS[progress.next]
        && progress.next !== def.stepKey
      ) {
        setActivity(progress.next);
      }

      const allowed = await window.LighthouseJourney.enforceStepAccess(def.stepKey, { showToast });
      if (!allowed) return;

      const existing = await window.Lighthouse.getTodayActivityResult(type);
      showIntro();

      if (existing) {
        // Done + next is non-activity → advance once
        if (
          progress.next
          && progress.next !== def.stepKey
          && !ACTIVITY_DEFS[progress.next]
          && progress.nextHref
        ) {
          const guardKey = `lh_act_done_${def.stepKey}_${window.Lighthouse.localDateString()}`;
          if (sessionStorage.getItem(guardKey) !== progress.next) {
            sessionStorage.setItem(guardKey, progress.next);
            showToast('Activity already done — continuing…');
            setTimeout(() => { window.location.href = progress.nextHref; }, 500);
            return;
          }
        }
        showDone('You already completed this activity today.');
      }
    } catch (err) {
      showToast((err && err.message) || 'Unable to load activity.');
      const intro = $('#introBody');
      if (intro) intro.textContent = (err && err.message) || 'Unable to load activity.';
    }
  })();
})();
