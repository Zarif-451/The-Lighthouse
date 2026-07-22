(function () {
  'use strict';
  const { $, $$, showToast, bootUserPage } = window.LighthouseShell;

  function syncThemeButtons(theme) {
    $$('#themePref button').forEach((b) => {
      b.classList.toggle('active', b.dataset.themeSet === theme);
    });
  }

  (async function init() {
    const session = await bootUserPage();
    if (!session) return;
    let prefs = session.prefs;
    try {
      prefs = await window.Lighthouse.getPreferences();
    } catch (e) { /* local fallback */ }

    const theme = (prefs && prefs.theme) || window.LighthouseTheme.get();
    syncThemeButtons(theme);
    window.LighthouseTheme.apply(theme, { silent: true });
    $('#notifPref').checked = !prefs || prefs.notifications_enabled !== false;
    $('#privacyPref').value = (prefs && prefs.privacy_mode) || 'private';
    $('#langPref').value = (prefs && prefs.language) || 'en';

    $('#themePref').addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      const t = btn.dataset.themeSet;
      syncThemeButtons(t);
      window.LighthouseTheme.apply(t);
    });

    // Keep theme toggle in topbar in sync with preference buttons
    window.addEventListener('lh-theme-change', (ev) => syncThemeButtons(ev.detail.theme));

    $('#saveSettingsBtn').addEventListener('click', async () => {
      const theme = $('#themePref .active') ? $('#themePref .active').dataset.themeSet : window.LighthouseTheme.get();
      try {
        await window.Lighthouse.updatePreferences({
          theme,
          notifications_enabled: $('#notifPref').checked,
          privacy_mode: $('#privacyPref').value,
          language: $('#langPref').value,
        });
        showToast('Settings saved.');
      } catch (err) {
        // Still persist theme locally
        window.LighthouseTheme.apply(theme);
        showToast(err.message || 'Saved theme locally. Run schema_platform.sql for full sync.');
      }
    });
  })();
})();
