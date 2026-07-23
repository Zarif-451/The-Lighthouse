(function () {
  'use strict';
  const { $, $$, showToast, bootUserPage } = window.LighthouseShell;
  let avatarDataUrl = null;
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

  function setAvatar(url, initials) {
    const el = $('#profileAvatar');
    const chip = $('#userAva');
    if (url) {
      el.style.backgroundImage = `url(${url})`;
      el.textContent = '';
      if (chip) { chip.style.backgroundImage = `url(${url})`; chip.style.backgroundSize = 'cover'; chip.textContent = ''; }
    } else {
      el.style.backgroundImage = '';
      el.textContent = initials;
    }
  }

  function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      if (!file) return resolve(null);
      if (!ALLOWED_AVATAR.includes(file.type)) {
        return reject(new Error('Please choose a JPG, PNG, or WEBP image.'));
      }
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function syncCustomOccupation() {
    const sel = $('#profileOccupation');
    const wrap = $('#profileCustomOccupationWrap');
    if (!sel || !wrap) return;
    wrap.hidden = sel.value !== 'Other';
  }

  function fillAbout(profile) {
    const p = profile || {};
    if ($('#profileOccupation')) $('#profileOccupation').value = p.occupation || '';
    if ($('#profileCustomOccupation')) $('#profileCustomOccupation').value = p.custom_occupation || '';
    syncCustomOccupation();

    const selected = new Set(Array.isArray(p.interests) ? p.interests : []);
    $$('#profileInterests input[name="profileInterest"]').forEach((cb) => {
      cb.checked = selected.has(cb.value);
    });

    if ($('#profilePhone')) $('#profilePhone').value = p.phone_number || '';
    if ($('#profileDob')) $('#profileDob').value = formatDobDisplay(p.date_of_birth);
    $$('input[name="profileGender"]').forEach((r) => {
      r.checked = !!p.gender && r.value === p.gender;
    });
    if ($('#profileHeardAbout')) $('#profileHeardAbout').value = p.heard_about || '';
    if ($('#profileBio')) {
      $('#profileBio').value = p.short_bio || '';
      if ($('#profileBioCount')) $('#profileBioCount').textContent = String(($('#profileBio').value || '').length);
    }
  }

  (async function init() {
    const session = await bootUserPage();
    if (!session) return;
    const { user, profile } = session;
    const name = (profile && profile.display_name) || window.Lighthouse.displayNameFromUser(user);
    const initials = window.Lighthouse.initialsFromName(name);
    $('#displayName').value = name;
    $('#profileEmail').textContent = user.email || '—';
    $('#profileJoined').textContent = window.Lighthouse.formatDate((profile && profile.created_at) || user.created_at);
    setAvatar(profile && profile.avatar_url, initials);
    avatarDataUrl = (profile && profile.avatar_url) || null;
    fillAbout(profile);

    try {
      const stats = await window.Lighthouse.getProfileStats();
      $('#profileStats').innerHTML = [
        ['Total Reflections', stats.totalReflections],
        ['Total Check-ins', stats.totalCheckins],
        ['Scenario Responses', stats.totalScenarios],
        ['Visual Reflections', stats.totalVisuals],
        ['Most Active Day', stats.mostActiveDay],
      ].map(([l, v]) => `<div class="compare-card"><div class="cc-label">${l}</div><div class="cc-val" style="font-size:1.2rem">${v}</div></div>`).join('');
    } catch (e) {
      $('#profileStats').innerHTML = `<div class="insight-empty">Not enough data yet.</div>`;
    }

    if ($('#profileOccupation')) {
      $('#profileOccupation').addEventListener('change', syncCustomOccupation);
    }
    if ($('#profileBio') && $('#profileBioCount')) {
      $('#profileBio').addEventListener('input', () => {
        $('#profileBioCount').textContent = String($('#profileBio').value.length);
      });
    }
    if ($('#profileDob')) {
      $('#profileDob').addEventListener('input', () => {
        const el = $('#profileDob');
        const next = maskDobInput(el.value);
        if (el.value !== next) el.value = next;
      });
    }

    $('#avatarFile').addEventListener('change', async (e) => {
      try {
        avatarDataUrl = await fileToDataUrl(e.target.files[0]);
        setAvatar(avatarDataUrl, initials);
      } catch (err) { showToast(err.message || 'Could not read image'); }
    });

    $('#saveProfileBtn').addEventListener('click', async () => {
      try {
        const updated = await window.Lighthouse.updateProfile({
          displayName: $('#displayName').value,
          avatarUrl: avatarDataUrl,
        });
        $('#userName').textContent = updated.display_name;
        showToast('Profile saved.');
      } catch (err) { showToast(err.message || 'Could not save profile. Run schema_platform.sql.'); }
    });

    const saveAboutBtn = $('#saveAboutBtn');
    if (saveAboutBtn) {
      saveAboutBtn.addEventListener('click', async () => {
        const occupation = ($('#profileOccupation') && $('#profileOccupation').value) || '';
        const customOccupation = ($('#profileCustomOccupation') && $('#profileCustomOccupation').value.trim()) || '';
        const interests = $$('#profileInterests input[name="profileInterest"]:checked').map((el) => el.value);
        const phone = ($('#profilePhone') && $('#profilePhone').value.trim()) || '';
        const dobParsed = parseDobInput(($('#profileDob') && $('#profileDob').value) || '');
        const genderEl = $('input[name="profileGender"]:checked');
        const gender = genderEl ? genderEl.value : '';
        const heardAbout = ($('#profileHeardAbout') && $('#profileHeardAbout').value) || '';
        const bio = ($('#profileBio') && $('#profileBio').value.trim()) || '';

        if (occupation === 'Other' && customOccupation.length < 2) {
          return showToast('Please specify your occupation.');
        }
        if (interests.length < 1) {
          return showToast('Please select at least one interest.');
        }
        if (phone && !phoneRe.test(phone)) {
          return showToast('Please enter a valid phone number.');
        }
        if (!dobParsed.ok) {
          return showToast(dobParsed.error);
        }
        if (bio.length > 250) {
          return showToast('Bio must be 250 characters or fewer.');
        }

        try {
          await window.Lighthouse.updateProfile({
            occupation: occupation || null,
            customOccupation: occupation === 'Other' ? customOccupation : null,
            interests,
            phoneNumber: phone || null,
            dateOfBirth: dobParsed.iso || null,
            gender: gender || null,
            heardAbout: heardAbout || null,
            shortBio: bio || null,
          });
          showToast('About you saved.');
        } catch (err) {
          showToast(err.message || 'Could not save. Run schema_profile_extended.sql.');
        }
      });
    }

    $('#changePassBtn').addEventListener('click', async () => {
      const a = $('#newPass').value;
      const b = $('#confirmPass').value;
      if (a !== b) return showToast('Passwords do not match.');
      try {
        await window.Lighthouse.changePassword(a);
        $('#newPass').value = '';
        $('#confirmPass').value = '';
        showToast('Password updated.');
      } catch (err) { showToast(err.message || 'Could not update password.'); }
    });
  })();
})();
