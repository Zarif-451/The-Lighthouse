/* ==========================================================================
   Lighthouse — Reflection Journal page
   ========================================================================== */
(function () {
  'use strict';

  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const MAX_CHARS = 4000;

  const toast = $('#toast');
  const toastMsg = $('#toastMsg');
  let toastTimer;
  function showToast(msg) {
    toastMsg.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2800);
  }

  function setHint(msg, isError) {
    const el = $('#journalHint');
    el.textContent = msg || '';
    el.classList.toggle('error', !!isError);
  }

  /* -------------------------------------------------- Shell UI (sidebar) -- */
  const sidebar = $('#sidebar');
  const overlay = $('#overlay');
  const openSidebar = () => { sidebar.classList.add('open'); overlay.classList.add('show'); };
  const closeSidebar = () => { sidebar.classList.remove('open'); overlay.classList.remove('show'); };
  $('#hamburger').addEventListener('click', openSidebar);
  overlay.addEventListener('click', closeSidebar);

  $$('.side-nav a').forEach((a) => {
    a.addEventListener('click', (e) => {
      const href = a.getAttribute('href') || '';
      if (href === '#' || !href) {
        e.preventDefault();
        showToast(`${a.dataset.nav} is coming soon.`);
      }
      closeSidebar();
    });
  });

  $('#todayDate').textContent = new Date().toLocaleDateString(undefined, {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  const textarea = $('#reflectionText');
  const charCount = $('#charCount');
  const saveBtn = $('#saveReflectionBtn');
  const historyEl = $('#journalHistory');
  const emptyEl = $('#historyEmpty');
  const searchInput = $('#historySearch');

  let allReflections = [];

  textarea.addEventListener('input', () => {
    charCount.textContent = String(textarea.value.length);
    setHint('');
  });

  $('#focusWriteBtn').addEventListener('click', () => {
    textarea.focus();
    textarea.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  function renderHistory(list) {
    const items = list || [];
    // Keep empty-state node, rebuild cards
    historyEl.querySelectorAll('.journal-card').forEach((n) => n.remove());

    if (!items.length) {
      emptyEl.style.display = '';
      emptyEl.querySelector('p').textContent =
        searchInput.value.trim()
          ? 'No reflections match your search.'
          : 'No reflections yet. Write your first one above — it will appear here after you save.';
      $('#historyMeta').textContent = 'Your previous reflections, newest first';
      return;
    }

    emptyEl.style.display = 'none';
    $('#historyMeta').textContent = `${items.length} reflection${items.length === 1 ? '' : 's'} · newest first`;

    const LH = window.Lighthouse;
    items.forEach((r) => {
      const card = document.createElement('article');
      card.className = 'journal-card card';
      card.dataset.id = r.id;
      card.innerHTML = `
        <div class="journal-card-head">
          <div class="journal-meta">
            <span class="journal-date">${LH.escapeHtml(LH.formatDate(r.created_at))}</span>
            <span class="journal-dot">·</span>
            <span class="journal-time">${LH.escapeHtml(LH.formatTime(r.created_at))}</span>
          </div>
          <button type="button" class="journal-delete" data-id="${LH.escapeHtml(r.id)}" aria-label="Delete reflection" title="Delete">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>
          </button>
        </div>
        <p class="journal-text">${LH.escapeHtml(r.reflection_text)}</p>
      `;
      historyEl.appendChild(card);
    });
  }

  function applySearch() {
    const q = (searchInput.value || '').trim().toLowerCase();
    if (!q) {
      renderHistory(allReflections);
      return;
    }
    renderHistory(
      allReflections.filter((r) =>
        String(r.reflection_text || '').toLowerCase().includes(q)
      )
    );
  }

  searchInput.addEventListener('input', applySearch);

  // Prefill search from dashboard (?q=)
  try {
    const q = new URLSearchParams(window.location.search).get('q');
    if (q) {
      searchInput.value = q;
    }
  } catch (e) { /* ignore */ }

  historyEl.addEventListener('click', async (e) => {
    const btn = e.target.closest('.journal-delete');
    if (!btn) return;
    const id = btn.dataset.id;
    if (!id) return;
    if (!confirm('Delete this reflection? This cannot be undone.')) return;

    try {
      btn.disabled = true;
      await window.Lighthouse.deleteReflection(id);
      allReflections = allReflections.filter((r) => r.id !== id);
      applySearch();
      showToast('Reflection deleted.');
    } catch (err) {
      showToast((err && err.message) || 'Could not delete reflection.');
      btn.disabled = false;
    }
  });

  async function loadReflections() {
    try {
      allReflections = await window.Lighthouse.listReflections();
      applySearch();
    } catch (err) {
      showToast((err && err.message) || 'Could not load reflections.');
      allReflections = [];
      applySearch();
    }
  }

  saveBtn.addEventListener('click', async () => {
    const text = textarea.value.trim();
    if (!text) {
      setHint('Please write something before saving.', true);
      textarea.focus();
      return;
    }
    if (text.length > MAX_CHARS) {
      setHint(`Reflections must be ${MAX_CHARS} characters or fewer.`, true);
      return;
    }

    try {
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving…';
      const created = await window.Lighthouse.createReflection(text);
      allReflections = [created, ...allReflections];
      textarea.value = '';
      charCount.textContent = '0';
      setHint('');
      applySearch();
      showToast('Reflection saved.');

      // Guided journey finale → return to dashboard
      if (window.Lighthouse.isFlowMode()) {
        setTimeout(() => { window.location.href = 'dashboard.html'; }, 800);
      }
    } catch (err) {
      const msg = (err && err.message) || 'Could not save reflection.';
      setHint(msg, true);
      showToast(msg);
    } finally {
      saveBtn.disabled = false;
      saveBtn.innerHTML = `Save Reflection
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/></svg>`;
    }
  });

  $('#logoutBtn').addEventListener('click', async () => {
    try {
      await window.Lighthouse.signOut();
    } catch (e) { /* ignore */ }
    showToast('Logged out. See you soon!');
    setTimeout(() => { window.location.href = 'index.html'; }, 700);
  });

  const userChip = $('#userChip');
  if (userChip) {
    userChip.style.cursor = 'pointer';
    userChip.addEventListener('click', () => { window.location.href = 'profile.html'; });
  }

  /* -------------------------------------------------- Boot / auth guard --- */
  (async function init() {
    try {
      if (!window.Lighthouse || !window.Lighthouse.isConfigured) {
        showToast('Configure Supabase in assets/js/config.js first.');
        setTimeout(() => { window.location.href = 'index.html#auth'; }, 1200);
        return;
      }
      const user = await window.Lighthouse.requireAuth('index.html#auth');
      if (!user) return;

      const name = window.Lighthouse.displayNameFromUser(user);
      $('#userName').textContent = name;
      $('#userAva').textContent = window.Lighthouse.initialsFromName(name);

      if (window.LighthouseTheme) window.LighthouseTheme.bindToggles();
      try {
        const profile = await window.Lighthouse.ensureProfile(user);
        if (profile && profile.role === 'admin') {
          showToast('Redirecting to Admin Portal…');
          setTimeout(() => { window.location.href = '/admin/index.html'; }, 400);
          return;
        }
      } catch (e) { /* ignore */ }

      // Soft gate for guided flow order
      if (window.Lighthouse.isFlowMode()) {
        const progress = await window.Lighthouse.getTodaysProgress();
        if (!progress.steps.visual) {
          showToast('Complete Visual Reflection first.');
          setTimeout(() => { window.location.href = 'visual.html?flow=1'; }, 900);
          return;
        }
        if (progress.steps.journal) {
          showToast('Today’s journal step is already complete.');
          setTimeout(() => { window.location.href = 'dashboard.html'; }, 900);
          return;
        }
        showToast('Final step — write a short reflection for today.');
      }

      await loadReflections();
    } catch (err) {
      showToast((err && err.message) || 'Unable to open journal.');
    }
  })();
})();
