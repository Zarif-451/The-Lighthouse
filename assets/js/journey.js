/* ==========================================================================
   Lighthouse — Sequential daily journey (locked progression)
   Requires: supabase-client.js (window.Lighthouse)
   ========================================================================== */
(function (global) {
  'use strict';

  const JOURNEY_STEPS = [
    { key: 'checkin', label: 'Daily Check-in', kind: 'checkin' },
    { key: 'scenario_1', label: 'Scenario 1', kind: 'scenario', slot: 1 },
    { key: 'memory', label: 'Memory Challenge', kind: 'activity', activity: 'memory' },
    { key: 'scenario_2', label: 'Scenario 2', kind: 'scenario', slot: 2 },
    { key: 'visual', label: 'Visual Reflection', kind: 'visual' },
    { key: 'scenario_3', label: 'Scenario 3', kind: 'scenario', slot: 3 },
    { key: 'word_puzzle', label: 'Word Puzzle', kind: 'activity', activity: 'word_puzzle' },
    { key: 'scenario_4', label: 'Scenario 4', kind: 'scenario', slot: 4 },
    { key: 'reaction', label: 'Reaction Challenge', kind: 'activity', activity: 'reaction' },
    { key: 'scenario_5', label: 'Scenario 5', kind: 'scenario', slot: 5 },
    { key: 'click_accuracy', label: 'Click Accuracy', kind: 'activity', activity: 'click_accuracy' },
    { key: 'journal', label: 'Reflection Journal', kind: 'journal', optional: true },
  ];

  const TRANSITIONS = {
    checkin: { title: 'Great job!', body: 'Let’s continue with Scenario 1.' },
    scenario_1: { title: 'Nice work!', body: 'Here’s a quick Memory Challenge.' },
    memory: { title: 'Well done!', body: 'Next up: Scenario 2.' },
    scenario_2: { title: 'You’re making great progress.', body: 'Time for a Visual Reflection.' },
    visual: { title: 'Nice choice.', body: 'Let’s continue with Scenario 3.' },
    scenario_3: { title: 'Great job!', body: 'Here’s a short Word Puzzle.' },
    word_puzzle: { title: 'Nice focus!', body: 'Next: Scenario 4.' },
    scenario_4: { title: 'You’re doing well.', body: 'Here’s a Reaction Challenge.' },
    reaction: { title: 'Sharp work!', body: 'One more scenario to go.' },
    scenario_5: { title: 'Journey almost complete!', body: 'One final activity — Click Accuracy Challenge.' },
    click_accuracy: { title: 'Great precision!', body: 'Optional: write a short reflection, or head to your dashboard.' },
    journal: { title: 'All set for today.', body: 'Your dashboard updates with today’s journey.' },
  };

  /** Build links that work for both /scenario and scenario.html hosts */
  function pageHref(page, query) {
    const path = (global.location && global.location.pathname) || '';
    const clean = !/\.html$/i.test(path);
    const q = query && Object.keys(query).length
      ? `?${new URLSearchParams(query).toString()}`
      : '';
    const base = String(page || '').replace(/\.html$/i, '');
    if (clean) return `/${base}${q}`;
    return `${base}.html${q}`;
  }

  function hrefFor(key) {
    switch (key) {
      case 'checkin': return pageHref('checkins', { flow: '1' });
      case 'scenario_1': return pageHref('scenario', { flow: '1', slot: '1' });
      case 'scenario_2': return pageHref('scenario', { flow: '1', slot: '2' });
      case 'scenario_3': return pageHref('scenario', { flow: '1', slot: '3' });
      case 'scenario_4': return pageHref('scenario', { flow: '1', slot: '4' });
      case 'scenario_5': return pageHref('scenario', { flow: '1', slot: '5' });
      case 'memory': return pageHref('activity', { flow: '1', type: 'memory' });
      case 'word_puzzle': return pageHref('activity', { flow: '1', type: 'word_puzzle' });
      case 'reaction': return pageHref('activity', { flow: '1', type: 'reaction' });
      case 'click_accuracy': return pageHref('activity', { flow: '1', type: 'click_accuracy' });
      case 'visual': return pageHref('visual', { flow: '1' });
      case 'journal': return pageHref('journal', { flow: '1' });
      default: return pageHref('dashboard');
    }
  }

  function stepByKey(key) {
    return JOURNEY_STEPS.find((s) => s.key === key) || null;
  }

  function stepIndex(key) {
    return JOURNEY_STEPS.findIndex((s) => s.key === key);
  }

  function nextAfter(key) {
    const i = stepIndex(key);
    if (i < 0 || i >= JOURNEY_STEPS.length - 1) return null;
    const step = JOURNEY_STEPS[i + 1];
    return { ...step, href: hrefFor(step.key) };
  }

  function staticNextHref(fromKey, fallbackHref) {
    if (fallbackHref) return fallbackHref;
    if (fromKey === 'journal') return pageHref('dashboard');
    const next = nextAfter(fromKey);
    return (next && next.href) || pageHref('dashboard');
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Resolve next URL after completing fromKey.
   * opts.force → always use the provided fallback (check-in → S1, visual → S3).
   */
  async function resolveNextHref(fromKey, fallbackHref, opts) {
    const options = opts || {};
    const staticHref = staticNextHref(fromKey, fallbackHref);
    if (options.force && staticHref) return staticHref;

    const LH = global.Lighthouse;
    if (!LH || !LH.getTodaysProgress) return staticHref;

    let progress = null;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      try {
        progress = await LH.getTodaysProgress();
      } catch (e) {
        break;
      }
      if (!progress) break;

      if (progress.steps && progress.steps[fromKey] && progress.next !== fromKey) {
        if (progress.next) return hrefFor(progress.next);
        if (progress.coreComplete || !progress.next) return pageHref('dashboard');
      }

      if (progress.steps && progress.steps[fromKey] && !progress.next) {
        return pageHref('dashboard');
      }

      await sleep(180 * (attempt + 1));
    }

    if (progress && progress.next && progress.next !== fromKey) {
      return hrefFor(progress.next);
    }
    return staticHref;
  }

  function showTransitionThen(fromKey, fallbackHref, opts) {
    const msg = TRANSITIONS[fromKey] || { title: 'Great job!', body: 'Let’s continue.' };

    let overlay = document.getElementById('journeyTransition');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'journeyTransition';
      overlay.className = 'journey-transition';
      overlay.innerHTML = `
        <div class="journey-transition-card" role="dialog" aria-modal="true" aria-labelledby="jtTitle">
          <div class="jt-check" aria-hidden="true">✓</div>
          <h2 id="jtTitle"></h2>
          <p id="jtBody"></p>
          <p class="jt-sub">Continuing…</p>
        </div>`;
      document.body.appendChild(overlay);
    }
    overlay.querySelector('#jtTitle').textContent = msg.title;
    overlay.querySelector('#jtBody').textContent = msg.body;
    overlay.classList.add('show');

    setTimeout(async () => {
      const href = await resolveNextHref(fromKey, fallbackHref, opts);
      window.location.href = href;
    }, 1100);
  }

  async function continueJourney(fromKey, fallbackHref, opts) {
    showTransitionThen(fromKey, fallbackHref, opts);
  }

  async function enforceStepAccess(stepKey, { showToast } = {}) {
    const LH = global.Lighthouse;
    if (!LH || !LH.getTodaysProgress) return true;
    const progress = await LH.getTodaysProgress();
    const done = !!progress.steps[stepKey];
    const isNext = progress.next === stepKey;
    if (stepKey === 'journal' && progress.coreComplete) return true;
    if (done || isNext) return true;

    const toast = typeof showToast === 'function' ? showToast : () => {};
    toast('Complete the previous journey steps first.');
    setTimeout(() => {
      window.location.href = (progress.next && hrefFor(progress.next)) || hrefFor('checkin');
    }, 800);
    return false;
  }

  // Live hrefs on step objects (for dashboard etc.)
  function stepsWithHrefs() {
    return JOURNEY_STEPS.map((s) => ({ ...s, href: hrefFor(s.key) }));
  }

  global.LighthouseJourney = {
    JOURNEY_STEPS,
    TRANSITIONS,
    pageHref,
    hrefFor,
    stepByKey,
    stepIndex,
    nextAfter,
    staticNextHref,
    resolveNextHref,
    showTransitionThen,
    continueJourney,
    enforceStepAccess,
    stepsWithHrefs,
  };
})(window);
