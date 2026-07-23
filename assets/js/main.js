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
    // Longer signup form: anchor to the top of the auth section (page scroll, not card scroll)
    if (which === 'signup') {
      const auth = $('#auth');
      if (auth) {
        requestAnimationFrame(() => {
          auth.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      }
    }
  }

  $$('[data-tab]').forEach((btn) =>
    btn.addEventListener('click', () => setTab(btn.dataset.tab))
  );

  $$('.terms-link').forEach((link) => {
    link.addEventListener('click', (e) => e.stopPropagation());
  });

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

  $$('.auth-form input, .auth-form select, .auth-form textarea').forEach((input) =>
    input.addEventListener('input', () => {
      if (input.id) setError(input.id, false);
      if (input.name === 'interest') setError('signupInterests', false);
      if (input.name === 'signupGender') setError('signupGender', false);
    })
  );
  $$('.auth-form select').forEach((sel) =>
    sel.addEventListener('change', () => { if (sel.id) setError(sel.id, false); })
  );

  /* ------------------------------------------- Signup extended fields UX -- */
  const occupationSelect = $('#signupOccupation');
  const customOccWrap = $('#signupCustomOccupationWrap');
  const customOccInput = $('#signupCustomOccupation');
  const bioInput = $('#signupBio');
  const bioCount = $('#signupBioCount');
  const avatarInput = $('#signupAvatar');
  const avatarPreview = $('#signupAvatarPreview');
  let signupAvatarDataUrl = null;

  const phoneRe = /^[+]?[\d\s().-]{7,20}$/;
  const ALLOWED_AVATAR = ['image/jpeg', 'image/png', 'image/webp'];

  function maskDobInput(value) {
    const digits = String(value || '').replace(/\D/g, '').slice(0, 6);
    if (digits.length <= 2) return digits;
    if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
    return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
  }

  function formatDobDisplay(iso) {
    const s = String(iso || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return '';
    const [y, m, d] = s.split('-');
    return `${d}/${m}/${y.slice(-2)}`;
  }

  function parseDobInput(raw) {
    const s = String(raw || '').trim();
    if (!s) return { ok: true, iso: null };
    const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
    if (!m) return { ok: false, error: 'Enter a valid date as dd/mm/yy.' };
    const day = parseInt(m[1], 10);
    const month = parseInt(m[2], 10);
    const two = parseInt(m[3], 10);
    const now = new Date();
    const pivot = now.getFullYear() % 100;
    const year = two <= pivot ? 2000 + two : 1900 + two;
    const dt = new Date(year, month - 1, day);
    if (dt.getFullYear() !== year || dt.getMonth() !== month - 1 || dt.getDate() !== day) {
      return { ok: false, error: 'Enter a valid calendar date as dd/mm/yy.' };
    }
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (dt > today) {
      return { ok: false, error: 'Date of birth cannot be in the future.' };
    }
    return {
      ok: true,
      iso: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    };
  }

  const dobInput = $('#signupDob');
  if (dobInput) {
    dobInput.addEventListener('input', () => {
      const next = maskDobInput(dobInput.value);
      if (dobInput.value !== next) dobInput.value = next;
      setError('signupDob', false);
    });
  }

  function syncCustomOccupation() {
    const isOther = occupationSelect && occupationSelect.value === 'Other';
    if (customOccWrap) customOccWrap.hidden = !isOther;
    if (!isOther && customOccInput) {
      customOccInput.value = '';
      setError('signupCustomOccupation', false);
    }
  }
  if (occupationSelect) {
    occupationSelect.addEventListener('change', syncCustomOccupation);
    syncCustomOccupation();
  }

  if (bioInput && bioCount) {
    const syncBio = () => { bioCount.textContent = String(bioInput.value.length); };
    bioInput.addEventListener('input', syncBio);
    syncBio();
  }

  function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      if (!file) return resolve(null);
      if (!ALLOWED_AVATAR.includes(file.type)) {
        return reject(new Error('Please choose a JPG, PNG, or WEBP image.'));
      }
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Could not read image.'));
      reader.readAsDataURL(file);
    });
  }

  if (avatarInput) {
    avatarInput.addEventListener('change', async () => {
      const file = avatarInput.files && avatarInput.files[0];
      setError('signupAvatar', false);
      if (!file) {
        signupAvatarDataUrl = null;
        if (avatarPreview) {
          avatarPreview.style.backgroundImage = '';
          avatarPreview.textContent = '?';
        }
        return;
      }
      try {
        signupAvatarDataUrl = await fileToDataUrl(file);
        if (avatarPreview) {
          avatarPreview.style.backgroundImage = `url(${signupAvatarDataUrl})`;
          avatarPreview.textContent = '';
        }
      } catch (err) {
        signupAvatarDataUrl = null;
        avatarInput.value = '';
        if (avatarPreview) {
          avatarPreview.style.backgroundImage = '';
          avatarPreview.textContent = '?';
        }
        setError('signupAvatar', true, err.message || 'Invalid image.');
      }
    });
  }

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
    const occupation = occupationSelect ? occupationSelect.value : '';
    const customOccupation = customOccInput ? customOccInput.value.trim() : '';
    const interests = $$('#signupInterests input[name="interest"]:checked').map((el) => el.value);
    const phone = ($('#signupPhone') && $('#signupPhone').value.trim()) || '';
    const dobRaw = (dobInput && dobInput.value.trim()) || '';
    const dobParsed = parseDobInput(dobRaw);
    const genderEl = $('input[name="signupGender"]:checked');
    const gender = genderEl ? genderEl.value : '';
    const heardAbout = ($('#signupHeardAbout') && $('#signupHeardAbout').value) || '';
    const bio = (bioInput && bioInput.value.trim()) || '';
    const termsOk = $('#signupTerms') && $('#signupTerms').checked;
    let ok = true;

    setError('signupName', false);
    setError('signupEmail', false);
    setError('signupPassword', false);
    setError('signupConfirm', false);
    setError('signupOccupation', false);
    setError('signupCustomOccupation', false);
    setError('signupInterests', false);
    setError('signupPhone', false);
    setError('signupDob', false);
    setError('signupAvatar', false);
    setError('signupBio', false);
    setError('signupTerms', false);

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
    if (!occupation) {
      setError('signupOccupation', true, 'Please select your occupation.');
      ok = false;
    }
    if (occupation === 'Other' && customOccupation.length < 2) {
      setError('signupCustomOccupation', true, 'Please specify your occupation.');
      ok = false;
    }
    if (interests.length < 1) {
      setError('signupInterests', true, 'Please select at least one interest.');
      ok = false;
    }
    if (phone && !phoneRe.test(phone)) {
      setError('signupPhone', true, 'Please enter a valid phone number.');
      ok = false;
    }
    if (!dobParsed.ok) {
      setError('signupDob', true, dobParsed.error);
      ok = false;
    }
    if (bio.length > 250) {
      setError('signupBio', true, 'Bio must be 250 characters or fewer.');
      ok = false;
    }
    if (!termsOk) {
      setError('signupTerms', true, 'Please accept the Terms & Conditions.');
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
        profile: {
          phoneNumber: phone || null,
          dateOfBirth: dobParsed.iso || null,
          gender: gender || null,
          occupation,
          customOccupation: occupation === 'Other' ? customOccupation : null,
          interests,
          avatarUrl: signupAvatarDataUrl || null,
          heardAbout: heardAbout || null,
          shortBio: bio || null,
        },
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
