/* ==========================================================================
   Lighthouse — Visual Reflection (guided journey step)
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

  let selectedId = null;

  function setHint(msg, isError) {
    const el = $('#visualHint');
    el.textContent = msg || '';
    el.classList.toggle('error', !!isError);
  }

  function renderGrid(preselect) {
    const options = window.Lighthouse.VISUAL_OPTIONS;
    $('#visualGrid').innerHTML = options.map((o) => `
      <button type="button" class="visual-card${preselect === o.id ? ' selected' : ''}" data-id="${o.id}">
        <img src="${o.image}" alt="${window.Lighthouse.escapeHtml(o.label)}" loading="lazy" />
        <span class="visual-meta">
          <strong>${window.Lighthouse.escapeHtml(o.title)}</strong>
          <small>${window.Lighthouse.escapeHtml(o.label)}</small>
        </span>
      </button>
    `).join('');
    if (preselect) {
      selectedId = preselect;
      $('#whyBox').hidden = false;
      $('#saveVisualBtn').disabled = false;
    }
  }

  $('#visualGrid').addEventListener('click', (e) => {
    const btn = e.target.closest('.visual-card');
    if (!btn) return;
    $$('.visual-card').forEach((el) => el.classList.remove('selected'));
    btn.classList.add('selected');
    selectedId = btn.dataset.id;
    $('#whyBox').hidden = false;
    $('#saveVisualBtn').disabled = false;
    setHint('');
  });

  $('#saveVisualBtn').addEventListener('click', async () => {
    if (!selectedId) {
      setHint('Please select one image.', true);
      return;
    }
    try {
      $('#saveVisualBtn').disabled = true;
      $('#saveVisualBtn').textContent = 'Saving…';
      await window.Lighthouse.saveVisualReflection({
        imageCategory: selectedId,
        optionalNote: $('#visualNote').value,
      });
      // After Visual Reflection → always go to Scenario 3
      const goScenario3 = window.LighthouseJourney.hrefFor('scenario_3');
      if (window.Lighthouse.isFlowMode()) {
        window.LighthouseJourney.showTransitionThen('visual', goScenario3, { force: true });
      } else {
        try {
          const progress = await window.Lighthouse.getTodaysProgress();
          if (progress && progress.steps.visual && !progress.steps.scenario_3) {
            window.LighthouseJourney.showTransitionThen('visual', goScenario3, { force: true });
          } else {
            showToast('Visual reflection saved.');
            $('#saveVisualBtn').disabled = false;
            $('#saveVisualBtn').textContent = 'Update & Continue';
          }
        } catch (e) {
          showToast('Visual reflection saved.');
          $('#saveVisualBtn').disabled = false;
          $('#saveVisualBtn').textContent = 'Update & Continue';
        }
      }
    } catch (err) {
      const msg = (err && err.message) || 'Could not save.';
      setHint(msg, true);
      showToast(msg);
      $('#saveVisualBtn').disabled = false;
      $('#saveVisualBtn').textContent = 'Save & Continue';
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
      const allowed = await window.LighthouseJourney.enforceStepAccess('visual', { showToast });
      if (!allowed) return;

      const existing = await window.Lighthouse.getTodayVisualReflection();
      // Already done in flow and journey has moved on → advance
      if (
        existing
        && window.Lighthouse.isFlowMode()
        && progress.next
        && progress.next !== 'visual'
        && progress.nextHref
      ) {
        const guardKey = `lh_vis_done_${window.Lighthouse.localDateString()}`;
        if (sessionStorage.getItem(guardKey) !== progress.next) {
          sessionStorage.setItem(guardKey, progress.next);
          showToast('Visual reflection already done — continuing…');
          setTimeout(() => { window.location.href = progress.nextHref; }, 500);
          return;
        }
      }
      renderGrid(existing ? existing.image_category : null);
      if (existing && existing.optional_note) {
        $('#visualNote').value = existing.optional_note;
      }
      if (existing) {
        $('#saveVisualBtn').textContent = 'Update & Continue';
      }
    } catch (err) {
      showToast((err && err.message) || 'Unable to load visual reflection.');
    }
  })();
})();
