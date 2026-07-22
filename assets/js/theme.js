/* ==========================================================================
   Lighthouse — Theme system (light / dark)
   Apply as early as possible to avoid flash. Persists to localStorage and
   optionally syncs to user_preferences when authenticated.
   ========================================================================== */
(function (global) {
  'use strict';

  const STORAGE_KEY = 'lh_theme';

  function getStoredTheme() {
    try {
      const t = localStorage.getItem(STORAGE_KEY);
      return t === 'dark' ? 'dark' : 'light';
    } catch (e) {
      return 'light';
    }
  }

  function applyTheme(theme, { silent } = {}) {
    const next = theme === 'dark' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem(STORAGE_KEY, next); } catch (e) { /* ignore */ }
    document.querySelectorAll('[data-theme-toggle]').forEach((btn) => {
      btn.setAttribute('aria-pressed', next === 'dark' ? 'true' : 'false');
      const label = btn.querySelector('[data-theme-label]');
      if (label) label.textContent = next === 'dark' ? 'Dark' : 'Light';
    });
    if (!silent) {
      try {
        global.dispatchEvent(new CustomEvent('lh-theme-change', { detail: { theme: next } }));
      } catch (e) { /* ignore */ }
    }
    return next;
  }

  function toggleTheme() {
    const cur = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    const next = applyTheme(cur === 'dark' ? 'light' : 'dark');
    // Best-effort sync to Supabase preferences
    if (global.Lighthouse && typeof global.Lighthouse.updatePreferences === 'function') {
      global.Lighthouse.updatePreferences({ theme: next }).catch(() => {});
    }
    return next;
  }

  // Apply immediately
  applyTheme(getStoredTheme(), { silent: true });

  global.LighthouseTheme = {
    get: () => (document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'),
    apply: applyTheme,
    toggle: toggleTheme,
    bindToggles() {
      document.querySelectorAll('[data-theme-toggle]').forEach((btn) => {
        if (btn.dataset.bound === '1') return;
        btn.dataset.bound = '1';
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          toggleTheme();
        });
      });
      applyTheme(getStoredTheme(), { silent: true });
    },
  };
})(window);
