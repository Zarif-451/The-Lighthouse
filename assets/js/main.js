/* ==========================================================================
   Lighthouse — Landing page interactions + Supabase Auth
   ========================================================================== */
(function () {
  'use strict';

  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  /* ------------------------------------------------------- Sticky navbar --- */
  const nav = $('#nav');
  const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 8);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ------------------------------------------------------- Mobile menu ----- */
  const navToggle = $('#navToggle');
  navToggle.addEventListener('click', () => nav.classList.toggle('open'));
  $$('#navLinks a').forEach((a) =>
    a.addEventListener('click', () => nav.classList.remove('open'))
  );

  /* ------------------------------------------------- Scroll reveal (IO) ---- */
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          io.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
  );
  $$('.reveal').forEach((el) => io.observe(el));

  /* ----------------------------------------------------------- Toast ------- */
  const toast = $('#toast');
  const toastMsg = $('#toastMsg');
  let toastTimer;
  function showToast(msg) {
    toastMsg.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 3200);
  }

  /* If already signed in, offer a quick path to the dashboard */
  async function redirectIfSignedIn() {
    try {
      if (!window.Lighthouse || !window.Lighthouse.isConfigured) return;
      const user = await window.Lighthouse.getUser();
      if (user) {
        // Soft notice only — do not force-redirect so landing remains readable.
      }
    } catch (e) {
      /* ignore */
    }
  }
  redirectIfSignedIn();

  /* ------------------------------------------------------- Auth tabs ------- */
  const tabLogin = $('#tabLogin');
  const tabSignup = $('#tabSignup');
  const tabAdmin = $('#tabAdmin');
  const loginForm = $('#loginForm');
  const signupForm = $('#signupForm');
  const adminForm = $('#adminForm');

  function setTab(which) {
    const map = {
      login: { tab: tabLogin, form: loginForm },
      signup: { tab: tabSignup, form: signupForm },
      admin: { tab: tabAdmin, form: adminForm },
    };
    Object.keys(map).forEach((key) => {
      const active = key === which;
      if (map[key].tab) map[key].tab.classList.toggle('active', active);
      if (map[key].form) map[key].form.classList.toggle('active', active);
    });
  }

  $$('[data-tab]').forEach((btn) =>
    btn.addEventListener('click', () => setTab(btn.dataset.tab))
  );

  $$('[data-auth]').forEach((btn) =>
    btn.addEventListener('click', () => {
      setTab(btn.dataset.auth === 'admin' ? 'admin' : btn.dataset.auth);
      $('#auth').scrollIntoView({ behavior: 'smooth', block: 'center' });
    })
  );

  const footerAdmin = $('#footerAdminLink');
  if (footerAdmin) {
    footerAdmin.addEventListener('click', (e) => {
      e.preventDefault();
      setTab('admin');
      $('#auth').scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }

  // Deep-link: index.html#admin or ?admin=1 opens Admin tab
  try {
    const params = new URLSearchParams(window.location.search);
    if (window.location.hash === '#admin' || params.get('admin') === '1') {
      setTab('admin');
      setTimeout(() => $('#auth').scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
    }
  } catch (e) { /* ignore */ }

  /* ------------------------------------------------- Password visibility --- */
  $$('.toggle-pass').forEach((btn) => {
    btn.addEventListener('click', () => {
      const input = document.getElementById(btn.dataset.toggle);
      input.type = input.type === 'password' ? 'text' : 'password';
      btn.classList.toggle('on');
    });
  });

  /* ------------------------------------------------- Forgot password ------- */
  const forgotLink = $('#forgotPasswordLink');
  if (forgotLink) {
    forgotLink.addEventListener('click', async (e) => {
      e.preventDefault();
      setTab('login');
      const email = ($('#loginEmail') && $('#loginEmail').value.trim()) || '';
      if (!emailRe.test(email)) {
        setError('loginEmail', true, 'Enter your account email above, then click Forgot password.');
        showToast('Enter your email first, then try Forgot password.');
        $('#loginEmail') && $('#loginEmail').focus();
        return;
      }
      try {
        await window.Lighthouse.resetPassword(email);
        showToast('Password reset email sent. Check your inbox.');
      } catch (err) {
        showToast(err.message || 'Could not send reset email.');
      }
    });
  }

  /* ------------------------------------------------------- Validation ------ */
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function setError(id, show, message) {
    const input = document.getElementById(id);
    const err = $(`[data-err="${id}"]`);
    if (input) input.classList.toggle('invalid', show);
    if (err) {
      if (message) err.textContent = message;
      err.classList.toggle('show', show);
    }
  }

  $$('.auth-form input').forEach((input) =>
    input.addEventListener('input', () => setError(input.id, false))
  );

  function ensureConfigured() {
    if (!window.Lighthouse) {
      throw new Error('Auth module failed to load. Please refresh the page.');
    }
    if (!window.Lighthouse.isConfigured) {
      throw new Error(
        'Supabase is not configured yet. Add your Project URL and Anon Key in assets/js/config.js.'
      );
    }
  }

  function setSubmitting(form, submitting, label) {
    const btn = form.querySelector('button[type="submit"]');
    if (!btn) return;
    btn.disabled = submitting;
    if (submitting) {
      btn.dataset.originalLabel = btn.textContent;
      btn.textContent = label || 'Please wait…';
    } else if (btn.dataset.originalLabel) {
      btn.textContent = btn.dataset.originalLabel;
    }
  }

  function goToDashboard() {
    setTimeout(() => {
      window.location.href = 'dashboard.html';
    }, 700);
  }

  async function routeAfterAuth() {
    try {
      const user = await window.Lighthouse.getUser();
      if (!user) {
        goToDashboard();
        return;
      }
      const profile = await window.Lighthouse.ensureProfile(user);
      if (profile && profile.role === 'admin') {
        showToast('Admin account — opening Admin Portal…');
        setTimeout(() => { window.location.href = '/admin/index.html'; }, 700);
        return;
      }
    } catch (e) { /* fall through to user dashboard */ }
    goToDashboard();
  }

  function goToAdminPortal() {
    setTimeout(() => { window.location.href = '/admin/index.html'; }, 700);
  }

  /* ------------------------------------------------------- Login submit ---- */
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = $('#loginEmail').value.trim();
    const pass = $('#loginPassword').value;
    let ok = true;

    if (!emailRe.test(email)) {
      setError('loginEmail', true, 'Please enter a valid email address.');
      ok = false;
    }
    if (pass.length < 6) {
      setError('loginPassword', true, 'Password must be at least 6 characters.');
      ok = false;
    }
    if (!ok) return;

    try {
      ensureConfigured();
      setSubmitting(loginForm, true, 'Signing in…');
      await window.Lighthouse.signIn({ email, password: pass });
      showToast('Welcome back! Redirecting…');
      routeAfterAuth();
    } catch (err) {
      const msg = (err && err.message) || 'Login failed. Please try again.';
      showToast(msg);
      setError('loginPassword', true, msg);
    } finally {
      setSubmitting(loginForm, false);
    }
  });

  /* ------------------------------------------------------- Signup submit --- */
  signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = $('#signupName').value.trim();
    const email = $('#signupEmail').value.trim();
    const pass = $('#signupPassword').value;
    const confirm = $('#signupConfirm').value;
    let ok = true;

    if (name.length < 2) {
      setError('signupName', true, 'Please enter your full name.');
      ok = false;
    }
    if (!emailRe.test(email)) {
      setError('signupEmail', true, 'Please enter a valid email address.');
      ok = false;
    }
    if (pass.length < 6) {
      setError('signupPassword', true, 'Password must be at least 6 characters.');
      ok = false;
    }
    if (confirm !== pass || confirm.length === 0) {
      setError('signupConfirm', true, 'Passwords do not match.');
      ok = false;
    }
    if (!ok) return;

    try {
      ensureConfigured();
      setSubmitting(signupForm, true, 'Creating account…');
      const data = await window.Lighthouse.signUp({
        email,
        password: pass,
        fullName: name,
      });

      // If email confirmation is enabled in Supabase, session may be null.
      if (data && data.session) {
        showToast('Account created! Setting up…');
        routeAfterAuth();
      } else {
        showToast('Account created! Check your email to confirm, then log in.');
        setTab('login');
        $('#loginEmail').value = email;
      }
    } catch (err) {
      const msg = (err && err.message) || 'Sign up failed. Please try again.';
      showToast(msg);
      setError('signupEmail', true, msg);
    } finally {
      setSubmitting(signupForm, false);
    }
  });

  /* ------------------------------------------------------- Admin submit ---- */
  adminForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = $('#adminEmail').value.trim();
    const pass = $('#adminPassword').value;
    let ok = true;

    if (!emailRe.test(email)) {
      setError('adminEmail', true, 'Please enter a valid email address.');
      ok = false;
    }
    if (pass.length < 6) {
      setError('adminPassword', true, 'Password must be at least 6 characters.');
      ok = false;
    }
    if (!ok) return;

    try {
      ensureConfigured();
      setSubmitting(adminForm, true, 'Signing in…');
      await window.Lighthouse.signIn({ email, password: pass });
      const user = await window.Lighthouse.getUser();
      const profile = await window.Lighthouse.ensureProfile(user);
      if (!profile || profile.role !== 'admin') {
        try { await window.Lighthouse.signOut(); } catch (err) { /* ignore */ }
        throw new Error('This account is not an admin. Use the Login tab for the user app.');
      }
      showToast('Welcome, Admin. Opening portal…');
      goToAdminPortal();
    } catch (err) {
      const msg = (err && err.message) || 'Admin sign-in failed.';
      showToast(msg);
      setError('adminPassword', true, msg);
    } finally {
      setSubmitting(adminForm, false);
    }
  });
})();
