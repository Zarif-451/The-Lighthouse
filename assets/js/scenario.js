/* ==========================================================================
   Lighthouse — Scenario Assessment (guided journey, slots 1–5)
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
    a.addEventListener('click', (e) => {
      const href = a.getAttribute('href') || '';
      if (href === '#' || !href) {
        e.preventDefault();
        showToast(`${a.dataset.nav} is coming soon.`);
      }
      sidebar.classList.remove('open');
      overlay.classList.remove('show');
    });
  });

  const params = new URLSearchParams(window.location.search);
  const slotParam = params.get('slot');
  let slot = Math.min(5, Math.max(1, Number(slotParam) || 1));
  let stepKey = `scenario_${slot}`;

  let currentScenario = null;
  let selected = null;

  function setHint(msg, isError) {
    const el = $('#scenarioHint');
    el.textContent = msg || '';
    el.classList.toggle('error', !!isError);
  }

  function syncUrlSlot(n) {
    // Update address bar without reloading (avoids /scenario ↔ ?slot= redirect loops)
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('flow', '1');
      url.searchParams.set('slot', String(n));
      window.history.replaceState({}, '', url.pathname + url.search + url.hash);
    } catch (e) { /* ignore */ }
  }

  function wireContinue(fromKey) {
    const cont = $('#continueVisualBtn');
    if (!cont) return;
    cont.textContent = 'Continue journey';
    cont.removeAttribute('href');
    const fallback = window.LighthouseJourney.staticNextHref(fromKey);
    cont.onclick = (e) => {
      e.preventDefault();
      window.LighthouseJourney.showTransitionThen(fromKey, fallback);
    };
  }

  function showDone(response) {
    $('#scenarioLoading').hidden = true;
    $('#scenarioContent').hidden = true;
    $('#scenarioDone').hidden = false;
    const s = response.scenario || {};
    const map = { A: s.option_a, B: s.option_b, C: s.option_c, D: s.option_d };
    const text = map[response.selected_option] || response.selected_option;
    const heading = $('#scenarioDone h3');
    if (heading) heading.textContent = `Scenario ${slot} of 5 complete`;
    $('#doneSummary').textContent = `You chose option ${response.selected_option}: ${text || ''}`;
    wireContinue(stepKey);
  }

  function renderScenario(scenario) {
    currentScenario = scenario;
    selected = null;
    $('#scenarioLoading').hidden = true;
    $('#scenarioDone').hidden = true;
    $('#scenarioContent').hidden = false;
    $('#scenarioCategory').textContent = `${scenario.category} · Scenario ${slot} of 5`;
    $('#scenarioTitle').textContent = scenario.title;
    $('#scenarioStory').textContent = scenario.story;
    $('#scenarioQuestion').textContent = scenario.question;
    $('#submitScenarioBtn').disabled = true;
    setHint('');

    const opts = [
      ['A', scenario.option_a],
      ['B', scenario.option_b],
      ['C', scenario.option_c],
      ['D', scenario.option_d],
    ];
    $('#optionGrid').innerHTML = opts.map(([key, text]) => `
      <button type="button" class="option-card" data-opt="${key}">
        <span class="opt-key">${key}</span>
        <span class="opt-text">${window.Lighthouse.escapeHtml(text)}</span>
      </button>
    `).join('');
  }

  function setGreeting() {
    const greet = document.querySelector('.greeting p');
    if (greet) greet.textContent = `Scenario ${slot} of 5 — sequential daily journey`;
  }

  $('#optionGrid').addEventListener('click', (e) => {
    const btn = e.target.closest('.option-card');
    if (!btn) return;
    $$('.option-card').forEach((el) => el.classList.remove('selected'));
    btn.classList.add('selected');
    selected = btn.dataset.opt;
    $('#submitScenarioBtn').disabled = false;
  });

  $('#submitScenarioBtn').addEventListener('click', async () => {
    if (!currentScenario || !selected) return;
    try {
      $('#submitScenarioBtn').disabled = true;
      $('#submitScenarioBtn').textContent = 'Saving…';
      await window.Lighthouse.saveScenarioResponse(currentScenario.id, selected, slot);
      const fallback = window.LighthouseJourney.staticNextHref(stepKey);
      window.LighthouseJourney.showTransitionThen(stepKey, fallback);
    } catch (err) {
      const msg = (err && err.message) || 'Could not save response.';
      const lower = String(msg).toLowerCase();
      if (lower.includes('unique') || lower.includes('duplicate')) {
        setHint('Could not save Scenario ' + slot + '. Run schema_journey_extended.sql in Supabase (allows 5 scenarios per day).', true);
      } else {
        setHint(msg, true);
      }
      showToast(msg);
      $('#submitScenarioBtn').disabled = false;
      $('#submitScenarioBtn').textContent = 'Continue';
    }
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

      const progress = await window.Lighthouse.getTodaysProgress();

      // Resolve which scenario slot to show — WITHOUT full page reloads
      // (reload loops happen when the server serves /scenario and drops ?slot=)
      if (slotParam == null && progress.next && String(progress.next).startsWith('scenario_')) {
        const n = Number(String(progress.next).split('_')[1]);
        if (n >= 1 && n <= 5) {
          slot = n;
          stepKey = `scenario_${n}`;
          syncUrlSlot(n);
        }
      } else if (slotParam == null && progress.next && !String(progress.next).startsWith('scenario_')) {
        // Journey is on a non-scenario step — leave this page once (guarded)
        const guardKey = `lh_leave_scenario_${window.Lighthouse.localDateString()}`;
        if (progress.nextHref && sessionStorage.getItem(guardKey) !== progress.next) {
          sessionStorage.setItem(guardKey, progress.next);
          window.location.href = progress.nextHref;
          return;
        }
      } else {
        slot = Math.min(5, Math.max(1, Number(slotParam) || 1));
        stepKey = `scenario_${slot}`;
      }

      setGreeting();

      // Completed this slot and journey moved on to a DIFFERENT kind of step → advance once
      const thisDone = !!progress.steps[stepKey];
      if (
        thisDone
        && progress.next
        && progress.next !== stepKey
        && progress.nextHref
        && !String(progress.next).startsWith('scenario_')
      ) {
        const guardKey = `lh_sc_done_${stepKey}_${window.Lighthouse.localDateString()}`;
        if (sessionStorage.getItem(guardKey) !== progress.next) {
          sessionStorage.setItem(guardKey, progress.next);
          showToast(`Scenario ${slot} already done — continuing…`);
          setTimeout(() => { window.location.href = progress.nextHref; }, 500);
          return;
        }
      }

      // Completed this slot but next is another scenario → switch slot in-place
      if (
        thisDone
        && progress.next
        && String(progress.next).startsWith('scenario_')
        && progress.next !== stepKey
      ) {
        const n = Number(String(progress.next).split('_')[1]);
        if (n >= 1 && n <= 5) {
          slot = n;
          stepKey = `scenario_${n}`;
          syncUrlSlot(n);
          setGreeting();
        }
      }

      const allowed = await window.LighthouseJourney.enforceStepAccess(stepKey, { showToast });
      if (!allowed) return;

      const existing = await window.Lighthouse.getTodayScenarioResponseForSlot(slot);
      if (existing) {
        showDone(existing);
        return;
      }

      $('#scenarioLoading').textContent = `Loading scenario ${slot} of 5…`;
      const scenario = await window.Lighthouse.pickTodaysScenario(user.id, slot);
      if (!scenario) {
        throw new Error('No scenario available for this slot. Run seed_scenarios_extended.sql in Supabase.');
      }
      renderScenario(scenario);
    } catch (err) {
      const msg = (err && err.message) || 'Unable to load scenario.';
      $('#scenarioLoading').hidden = false;
      $('#scenarioContent').hidden = true;
      $('#scenarioDone').hidden = true;
      $('#scenarioLoading').textContent = msg;
      showToast(msg);
    }
  })();
})();
