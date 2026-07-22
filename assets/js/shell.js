/* ==========================================================================
   Lighthouse — Shared shell helpers (sidebar, toast, theme, logout)
   ========================================================================== */
(function (global) {
  'use strict';

  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return Array.from((ctx || document).querySelectorAll(sel)); }

  function showToast(msg) {
    const toast = $('#toast');
    const toastMsg = $('#toastMsg');
    if (!toast || !toastMsg) {
      // eslint-disable-next-line no-alert
      window.alert(msg);
      return;
    }
    toastMsg.textContent = msg;
    toast.classList.add('show');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => toast.classList.remove('show'), 2800);
  }

  function wireSidebar() {
    const sidebar = $('#sidebar');
    const overlay = $('#overlay');
    const hamburger = $('#hamburger');
    if (hamburger && sidebar && overlay) {
      hamburger.addEventListener('click', () => {
        sidebar.classList.add('open');
        overlay.classList.add('show');
      });
      overlay.addEventListener('click', () => {
        sidebar.classList.remove('open');
        overlay.classList.remove('show');
      });
    }
    $$('.side-nav a').forEach((a) => {
      a.addEventListener('click', (e) => {
        const href = a.getAttribute('href') || '';
        if (href === '#' || !href) {
          e.preventDefault();
          showToast(`${a.dataset.nav || 'This page'} is coming soon.`);
        }
        if (sidebar && overlay) {
          sidebar.classList.remove('open');
          overlay.classList.remove('show');
        }
      });
    });
  }

  function wireLogout() {
    const btn = $('#logoutBtn');
    if (!btn) return;
    btn.addEventListener('click', async () => {
      try {
        if (global.Lighthouse) await global.Lighthouse.signOut();
      } catch (e) { /* ignore */ }
      showToast('Logged out. See you soon!');
      const path = window.location.pathname || '';
      const dest = path.includes('/admin/') ? '../index.html#admin' : 'index.html';
      setTimeout(() => { window.location.href = dest; }, 700);
    });
  }

  function wireUserChip() {
    $$('.user-chip').forEach((chip) => {
      if (chip.dataset.wiredChip) return;
      chip.dataset.wiredChip = '1';
      chip.style.cursor = 'pointer';
      chip.addEventListener('click', () => {
        const path = window.location.pathname || '';
        if (path.includes('/admin/')) {
          window.location.href = '/admin/settings.html';
        } else {
          window.location.href = 'profile.html';
        }
      });
    });
  }

  function setUserChip(user) {
    if (!global.Lighthouse || !user) return;
    const name = global.Lighthouse.displayNameFromUser(user);
    const nameEl = $('#userName');
    const avaEl = $('#userAva');
    if (nameEl) nameEl.textContent = name;
    if (avaEl) {
      // Prefer avatar if present on profile later
      avaEl.textContent = global.Lighthouse.initialsFromName(name);
    }
  }

  async function bootUserPage({ requireUser = true, adminOnly = false } = {}) {
    if (global.LighthouseTheme) global.LighthouseTheme.bindToggles();
    wireSidebar();
    wireLogout();
    wireUserChip();

    if (!global.Lighthouse || !global.Lighthouse.isConfigured) {
      showToast('Configure Supabase in assets/js/config.js first.');
      setTimeout(() => { window.location.href = 'index.html#auth'; }, 1000);
      return null;
    }

    if (!requireUser) return null;

    const user = await global.Lighthouse.requireAuth(
      adminOnly ? '../index.html#admin' : 'index.html#auth'
    );
    if (!user) return null;

    try {
      const profile = await global.Lighthouse.ensureProfile(user);
      const prefs = await global.Lighthouse.getPreferences();
      if (prefs && prefs.theme && global.LighthouseTheme) {
        global.LighthouseTheme.apply(prefs.theme, { silent: true });
        global.LighthouseTheme.bindToggles();
      }
      setUserChip(user);
      if (profile && profile.avatar_url && $('#userAva')) {
        const ava = $('#userAva');
        ava.style.backgroundImage = `url(${profile.avatar_url})`;
        ava.style.backgroundSize = 'cover';
        ava.style.backgroundPosition = 'center';
        ava.textContent = '';
      }

      if (adminOnly) {
        if (!profile || profile.role !== 'admin') {
          try { await global.Lighthouse.signOut(); } catch (e) { /* ignore */ }
          showToast('Admin access required.');
          setTimeout(() => { window.location.href = '../index.html#admin'; }, 700);
          return null;
        }
      } else if (profile && profile.role === 'admin') {
        // Admins belong in the admin portal — keep interfaces separate
        const path = window.location.pathname || '';
        if (!path.includes('/admin/')) {
          showToast('Redirecting to Admin Portal…');
          setTimeout(() => { window.location.href = '/admin/index.html'; }, 400);
          return null;
        }
      }

      global.Lighthouse.touchLastLogin().catch(() => {});
      return { user, profile, prefs };
    } catch (err) {
      setUserChip(user);
      if (adminOnly) {
        showToast('Admin access required.');
        setTimeout(() => { window.location.href = '../index.html#admin'; }, 700);
        return null;
      }
      return { user, profile: null, prefs: null };
    }
  }

  function themeToggleHtml() {
    return `<button type="button" class="theme-toggle icon-btn" data-theme-toggle aria-label="Toggle theme" title="Toggle light/dark">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5"/></svg>
    </button>`;
  }

  global.LighthouseShell = {
    $,
    $$,
    showToast,
    wireSidebar,
    wireLogout,
    setUserChip,
    bootUserPage,
    themeToggleHtml,
  };
})(window);
