/* ==========================================================================
   Lighthouse — Daily Check-ins page
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

  let todayRow = null;
  const inFlow = () => window.Lighthouse.isFlowMode();

  function setHint(msg, isError) {
    const el = $('#formHint');
    el.textContent = msg || '';
    el.classList.toggle('error', !!isError);
  }

  function fillForm(row) {
    if (!row) {
      $('#sleepHours').value = '';
      $('#mood').value = '';
      $('#energy').value = '3';
      $('#productivity').value = '3';
      $('#energyVal').textContent = '3';
      $('#prodVal').textContent = '3';
      $('#activity').value = '';
      $('#water').value = '';
      $('#notes').value = '';
      $('#todayBadge').hidden = true;
      $('#deleteTodayBtn').hidden = true;
      $('#formTitle').textContent = "Today’s Check-in";
      $('#formSub').textContent = 'Record how today feels so far.';
      $('#saveCheckinBtn').textContent = 'Save Check-in';
      return;
    }
    $('#sleepHours').value = row.sleep_hours;
    $('#mood').value = row.mood;
    $('#energy').value = String(row.energy_level);
    $('#productivity').value = String(row.productivity);
    $('#energyVal').textContent = String(row.energy_level);
    $('#prodVal').textContent = String(row.productivity);
    $('#activity').value = row.physical_activity;
    $('#water').value = row.water_intake || '';
    $('#notes').value = row.notes || '';
    $('#todayBadge').hidden = false;
    $('#deleteTodayBtn').hidden = false;
    $('#formTitle').textContent = "Edit today’s check-in";
    $('#formSub').textContent = 'Update your entry — only one check-in is kept per day.';
    $('#saveCheckinBtn').textContent = 'Update Check-in';
  }

  function renderHistory(rows) {
    const el = $('#checkinHistory');
    if (!rows.length) {
      el.innerHTML = '<div class="empty-state"><p>No check-ins yet. Save today’s entry to start your history.</p></div>';
      return;
    }
    const LH = window.Lighthouse;
    el.innerHTML = rows.map((r) => `
      <article class="journal-card card history-card">
        <div class="journal-card-head">
          <div class="journal-meta">
            <span class="journal-date">${LH.escapeHtml(r.checkin_date)}</span>
            <span class="journal-dot">·</span>
            <span class="journal-time">${LH.escapeHtml(r.mood)} · Sleep ${LH.escapeHtml(String(r.sleep_hours))}h</span>
          </div>
          <button type="button" class="journal-delete" data-id="${LH.escapeHtml(r.id)}" aria-label="Delete check-in" title="Delete">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
          </button>
        </div>
        <p class="journal-text">Energy ${r.energy_level}/5 · Productivity ${r.productivity}/5 · Activity ${LH.escapeHtml(r.physical_activity)}${r.water_intake ? ` · Water ${LH.escapeHtml(r.water_intake)}` : ''}</p>
        ${r.notes ? `<p class="journal-text" style="margin-top:8px">${LH.escapeHtml(r.notes)}</p>` : ''}
      </article>
    `).join('');
  }

  async function refresh() {
    const [today, history] = await Promise.all([
      window.Lighthouse.getTodayCheckin(),
      window.Lighthouse.listCheckins({ limit: 60 }),
    ]);
    todayRow = today;
    fillForm(today);
    renderHistory(history);
  }

  $('#energy').addEventListener('input', () => { $('#energyVal').textContent = $('#energy').value; });
  $('#productivity').addEventListener('input', () => { $('#prodVal').textContent = $('#productivity').value; });

  $('#checkinForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    setHint('');
    const payload = {
      sleep_hours: $('#sleepHours').value,
      mood: $('#mood').value,
      energy_level: Number($('#energy').value),
      productivity: Number($('#productivity').value),
      physical_activity: $('#activity').value,
      water_intake: $('#water').value,
      notes: $('#notes').value,
    };
    try {
      $('#saveCheckinBtn').disabled = true;
      const result = await window.Lighthouse.upsertTodayCheckin(payload);
      showToast(result.created ? 'Check-in saved.' : 'Check-in updated.');
      await refresh();

      // Guided journey: continue to scenario after save
      if (inFlow() || result.created) {
        setTimeout(() => { window.location.href = 'scenario.html?flow=1'; }, 700);
      }
    } catch (err) {
      const msg = (err && err.message) || 'Could not save check-in.';
      setHint(msg, true);
      showToast(msg);
    } finally {
      $('#saveCheckinBtn').disabled = false;
    }
  });

  $('#deleteTodayBtn').addEventListener('click', async () => {
    if (!todayRow) return;
    if (!confirm('Delete today’s check-in?')) return;
    try {
      await window.Lighthouse.deleteCheckin(todayRow.id);
      showToast('Today’s check-in deleted.');
      await refresh();
    } catch (err) {
      showToast((err && err.message) || 'Could not delete.');
    }
  });

  $('#checkinHistory').addEventListener('click', async (e) => {
    const btn = e.target.closest('.journal-delete');
    if (!btn) return;
    if (!confirm('Delete this check-in?')) return;
    try {
      await window.Lighthouse.deleteCheckin(btn.dataset.id);
      showToast('Check-in deleted.');
      await refresh();
    } catch (err) {
      showToast((err && err.message) || 'Could not delete.');
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
        showToast('Configure Supabase in assets/js/config.js first.');
        setTimeout(() => { window.location.href = 'index.html#auth'; }, 1000);
        return;
      }
      const user = await window.Lighthouse.requireAuth('index.html#auth');
      if (!user) return;
      const name = window.Lighthouse.displayNameFromUser(user);
      $('#userName').textContent = name;
      $('#userAva').textContent = window.Lighthouse.initialsFromName(name);
      $('#todayDate').textContent = new Date().toLocaleDateString(undefined, {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      });
      if (inFlow()) $('#flowBanner').hidden = false;
      if (window.LighthouseTheme) window.LighthouseTheme.bindToggles();
      try {
        const profile = await window.Lighthouse.ensureProfile(user);
        if (profile && profile.role === 'admin') {
          showToast('Redirecting to Admin Portal…');
          setTimeout(() => { window.location.href = '/admin/index.html'; }, 400);
          return;
        }
      } catch (e) { /* ignore */ }
      await refresh();
    } catch (err) {
      showToast((err && err.message) || 'Unable to load check-ins.');
    }
  })();
})();
