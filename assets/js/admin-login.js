/* ==========================================================================
   Lighthouse — Dedicated Admin Login
   Only profiles.role = 'admin' may enter the admin portal.
   ========================================================================== */
(function () {
  'use strict';

  const $ = (sel) => document.querySelector(sel);
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const toast = $('#toast');
  const toastMsg = $('#toastMsg');
  let toastTimer;
  function showToast(msg) {
    if (!toast || !toastMsg) return;
    toastMsg.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2800);
  }

  function setError(msg) {
    const el = $('#adminLoginError');
    if (!el) return;
    el.textContent = msg || 'Invalid credentials or not an admin account.';
    el.classList.add('show');
  }

  function clearError() {
    const el = $('#adminLoginError');
    if (el) el.classList.remove('show');
  }

  async function ensureAdminOrKick(user) {
    const profile = await window.Lighthouse.ensureProfile(user);
    if (!profile || profile.role !== 'admin') {
      try { await window.Lighthouse.signOut(); } catch (e) { /* ignore */ }
      throw new Error('This account is not an admin. Use the user login instead.');
    }
    return profile;
  }

  // If already signed in as admin, go straight to portal
  (async function boot() {
    try {
      if (!window.Lighthouse || !window.Lighthouse.isConfigured) return;
      const user = await window.Lighthouse.getUser();
      if (!user) return;
      const profile = await window.Lighthouse.ensureProfile(user);
      if (profile && profile.role === 'admin') {
        window.location.replace('index.html');
      }
    } catch (e) { /* stay on login */ }
  })();

  $('#adminLoginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    clearError();

    const email = $('#adminEmail').value.trim();
    const password = $('#adminPassword').value;
    const btn = $('#adminLoginBtn');

    if (!emailRe.test(email) || password.length < 6) {
      setError('Enter a valid email and password (min 6 characters).');
      return;
    }

    try {
      if (!window.Lighthouse || !window.Lighthouse.isConfigured) {
        throw new Error('Supabase is not configured. Check assets/js/config.js.');
      }

      btn.disabled = true;
      btn.textContent = 'Signing in…';

      await window.Lighthouse.signIn({ email, password });
      const user = await window.Lighthouse.getUser();
      await ensureAdminOrKick(user);

      showToast('Welcome, Admin. Opening portal…');
      setTimeout(() => { window.location.href = 'index.html'; }, 500);
    } catch (err) {
      const msg = (err && err.message) || 'Admin sign-in failed.';
      setError(msg);
      showToast(msg);
      btn.disabled = false;
      btn.textContent = 'Sign in to Admin';
    }
  });
})();
