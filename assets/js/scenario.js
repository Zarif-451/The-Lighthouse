/* ==========================================================================
   Lighthouse — Scenario Assessment (guided journey step)
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

  let currentScenario = null;
  let selected = null;

  function setHint(msg, isError) {
    const el = $('#scenarioHint');
    el.textContent = msg || '';
    el.classList.toggle('error', !!isError);
  }

  function showDone(response) {
    $('#scenarioLoading').hidden = true;
    $('#scenarioContent').hidden = true;
    $('#scenarioDone').hidden = false;
    const s = response.scenario || {};
    const map = { A: s.option_a, B: s.option_b, C: s.option_c, D: s.option_d };
    const text = map[response.selected_option] || response.selected_option;
    $('#doneSummary').textContent = `You chose option ${response.selected_option}: ${text || ''}`;
  }

  function renderScenario(scenario) {
    currentScenario = scenario;
    selected = null;
    $('#scenarioLoading').hidden = true;
    $('#scenarioDone').hidden = true;
    $('#scenarioContent').hidden = false;
    $('#scenarioCategory').textContent = scenario.category;
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
      await window.Lighthouse.saveScenarioResponse(currentScenario.id, selected);
      showToast('Scenario saved. Continuing…');
      setTimeout(() => { window.location.href = 'visual.html?flow=1'; }, 700);
    } catch (err) {
      const msg = (err && err.message) || 'Could not save response.';
      setHint(msg, true);
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

      // Ensure check-in exists when arriving via guided flow
      const progress = await window.Lighthouse.getTodaysProgress();
      if (!progress.steps.checkin) {
        showToast('Complete today’s check-in first.');
        setTimeout(() => { window.location.href = 'checkins.html?flow=1'; }, 900);
        return;
      }

      const existing = await window.Lighthouse.getTodayScenarioResponse();
      if (existing) {
        showDone(existing);
        return;
      }

      const scenario = await window.Lighthouse.pickTodaysScenario(user.id);
      renderScenario(scenario);
    } catch (err) {
      $('#scenarioLoading').textContent = (err && err.message) || 'Unable to load scenario.';
      showToast((err && err.message) || 'Unable to load scenario.');
    }
  })();
})();
