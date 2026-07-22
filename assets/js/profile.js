(function () {
  'use strict';
  const { $, showToast, bootUserPage } = window.LighthouseShell;
  let avatarDataUrl = null;

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
      if (file.size > 400000) return reject(new Error('Please choose an image under 400KB.'));
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
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
