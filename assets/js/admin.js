(function () {
  'use strict';
  const page = document.body.dataset.adminPage || 'dashboard';
  const { $, $$, showToast, bootUserPage } = window.LighthouseShell;

  async function initAdmin() {
    // Fix logout to use relative root
    const session = await bootUserPage({ adminOnly: true });
    if (!session) return null;
    const logout = $('#logoutBtn');
    if (logout) {
      logout.onclick = async () => {
        try { await window.Lighthouse.signOut(); } catch (e) {}
        window.location.href = '../index.html#admin';
      };
    }
    return session;
  }

  async function loadDashboard() {
    const data = await window.Lighthouse.adminGetAnalytics();
    const cards = [
      ['Total Registered Users', data.totalUsers],
      ['Active Users Today', data.activeUsersToday],
      ['Daily Check-ins Submitted', data.checkinsTotal],
      ['Reflection Entries', data.reflectionsTotal],
      ['Scenario Completion Rate', data.scenarioCompletionRate + '%'],
      ['Visual Reflection Completion', data.visualCompletionRate + '%'],
      ['Flagged Users', data.flaggedCount],
    ];
    $('#adminStats').innerHTML = cards.map(([l, v]) => `
      <div class="stat"><div class="s-label">${l}</div><div class="s-val" style="font-size:1.5rem;margin-top:8px">${v}</div></div>`).join('');

    new Chart($('#growthChart').getContext('2d'), {
      type: 'line',
      data: { labels: data.growthLabels, datasets: [{ data: data.growthValues, borderColor: '#3B82F6', tension: 0.35, fill: false, pointRadius: 0 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } },
    });
    new Chart($('#activityChart').getContext('2d'), {
      type: 'bar',
      data: {
        labels: data.activityLabels,
        datasets: [
          { label: 'Check-ins', data: data.activityCheckins, backgroundColor: '#14B8A6' },
          { label: 'Reflections', data: data.activityReflections, backgroundColor: '#3B82F6' },
        ],
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } },
    });

    const flagged = data.flagged.filter((f) => f.risk !== 'Low' || f.monitoring).slice(0, 20);
    $('#flaggedBody').innerHTML = flagged.length ? flagged.map((f) => `
      <tr>
        <td>${window.Lighthouse.escapeHtml(f.name)}${f.monitoring ? ' <span class="watch-pill">Watch</span>' : ''}</td>
        <td>${window.Lighthouse.escapeHtml(f.lastActivity)}</td>
        <td><span class="risk-pill ${f.risk.toLowerCase()}">${f.risk}</span></td>
        <td>${window.Lighthouse.escapeHtml(f.status)}</td>
        <td>${f.checkinCount}</td>
        <td>${f.reflectionCount}</td>
      </tr>`).join('') : `<tr><td colspan="6">No flagged users right now.</td></tr>`;
  }

  async function loadUsers() {
    const data = await window.Lighthouse.adminGetAnalytics();
    const profiles = data.profiles || [];
    const flaggedMap = {};
    data.flagged.forEach((f) => { flaggedMap[f.id] = f; });
    let activeUserId = null;

    function render(list) {
      $('#usersBody').innerHTML = list.map((p) => {
        const f = flaggedMap[p.id] || {};
        const watching = f.monitoring || (p.monitoring_until && new Date(p.monitoring_until) > new Date());
        return `<tr>
          <td>${window.Lighthouse.escapeHtml(p.display_name || 'User')}${watching ? ' <span class="watch-pill">Watchlist</span>' : ''}</td>
          <td><code style="font-size:0.75rem">${p.id.slice(0, 8)}…</code></td>
          <td>${window.Lighthouse.formatDate(p.created_at)}</td>
          <td>${p.last_login_at ? window.Lighthouse.formatDate(p.last_login_at) : '—'}</td>
          <td>${window.Lighthouse.escapeHtml(p.account_status)}</td>
          <td><span class="risk-pill ${(f.risk || 'Low').toLowerCase()}">${f.risk || 'Low'}</span></td>
          <td><button class="btn btn-ghost" data-view="${p.id}" style="padding:6px 10px;font-size:0.8rem">Care</button></td>
        </tr>`;
      }).join('') || `<tr><td colspan="7">No users found.</td></tr>`;
    }

    async function renderCarePanel(userId) {
      activeUserId = userId;
      const summary = await window.Lighthouse.adminGetUserSummary(userId);
      const p = summary.profile || {};
      const flag = summary.flag || { reasons: [], risk: 'Low' };
      const reasons = (flag.reasons && flag.reasons.length)
        ? flag.reasons.map((r) => `<li>${window.Lighthouse.escapeHtml(r)}</li>`).join('')
        : '<li>No attention signals right now.</li>';
      const notes = (summary.notes || []).map((n) => `
        <div class="care-note">
          <div class="care-note-meta">${window.Lighthouse.formatDate(n.created_at)} · ${window.Lighthouse.formatTime(n.created_at)}</div>
          <p>${window.Lighthouse.escapeHtml(n.note)}</p>
        </div>`).join('') || '<p class="care-empty">No internal notes yet.</p>';
      const openNudge = (summary.nudges || []).find((n) => !n.dismissed_at);
      const untilLabel = flag.monitoringUntil
        ? window.Lighthouse.formatDate(flag.monitoringUntil)
        : '';

      $('#userSummary').innerHTML = `
        <div class="care-panel">
          <div class="care-head">
            <div>
              <h3>${window.Lighthouse.escapeHtml(p.display_name || 'User')}</h3>
              <p class="care-sub">Status: ${window.Lighthouse.escapeHtml(p.account_status || 'active')} · Risk: <span class="risk-pill ${(flag.risk || 'Low').toLowerCase()}">${flag.risk || 'Low'}</span>${flag.monitoring ? ' · <span class="watch-pill">On watchlist</span>' : ''}</p>
            </div>
          </div>

          <div class="compare-grid" style="margin-bottom:18px">
            <div class="compare-card"><div class="cc-label">Check-ins</div><div class="cc-val">${summary.checkinCount}</div></div>
            <div class="compare-card"><div class="cc-label">Reflections</div><div class="cc-val">${summary.reflectionCount}</div><div class="cc-sub">Text hidden</div></div>
            <div class="compare-card"><div class="cc-label">Scenarios</div><div class="cc-val">${summary.scenarioCount}</div></div>
            <div class="compare-card"><div class="cc-label">Visuals</div><div class="cc-val">${summary.visualCount}</div></div>
          </div>

          <div class="care-grid">
            <section class="care-block">
              <h4>Why flagged</h4>
              <p class="care-hint">Attention indicators only — private journal text stays hidden.</p>
              <ul class="care-reasons">${reasons}</ul>
              ${flag.showcase ? '<p class="care-hint" style="margin-top:8px">Showcase sample — turn off <code>SHOWCASE_FLAGGED</code> in config.js for live risk only.</p>' : ''}
            </section>

            <section class="care-block">
              <h4>Watchlist</h4>
              <p class="care-hint">${flag.monitoring
                ? `Monitoring until ${untilLabel}. Clears automatically if signals improve or the window ends.`
                : 'Add to a 7-day watchlist for Moderate follow-up.'}</p>
              <div class="care-actions">
                ${flag.monitoring
                  ? `<button type="button" class="btn btn-outline" id="clearWatchBtn">Remove from watchlist</button>`
                  : `<button type="button" class="btn btn-teal" id="addWatchBtn">Add to watchlist (7 days)</button>`}
              </div>
            </section>

            <section class="care-block">
              <h4>Soft nudge</h4>
              <p class="care-hint">Gentle in-app reminder on their dashboard. No blame language.</p>
              <textarea id="nudgeMessage" rows="3" class="care-textarea">${window.Lighthouse.escapeHtml(summary.defaultNudge || window.Lighthouse.DEFAULT_NUDGE || '')}</textarea>
              <div class="care-actions">
                <button type="button" class="btn btn-primary" id="sendNudgeBtn">Send nudge</button>
              </div>
              ${openNudge ? `<p class="care-hint" style="margin-top:10px">Open nudge waiting for user · sent ${window.Lighthouse.formatRelativeDate(openNudge.created_at)}</p>` : ''}
            </section>

            <section class="care-block">
              <h4>Internal notes</h4>
              <p class="care-hint">Visible only to admins — never shown to the user.</p>
              <textarea id="adminNote" rows="3" class="care-textarea" placeholder="Short note for handoff…"></textarea>
              <div class="care-actions">
                <button type="button" class="btn btn-outline" id="addNoteBtn">Add note</button>
              </div>
              <div class="care-notes" id="careNotes">${notes}</div>
            </section>
          </div>
        </div>`;
      $('#userSummaryCard').hidden = false;
      $('#userSummaryCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    render(profiles);
    $('#userSearch').addEventListener('input', () => {
      const q = $('#userSearch').value.trim().toLowerCase();
      render(profiles.filter((p) => (p.display_name || '').toLowerCase().includes(q) || p.id.includes(q)));
    });
    $('#riskFilter').addEventListener('change', () => {
      const risk = $('#riskFilter').value;
      if (risk === 'all') return render(profiles);
      if (risk === 'Watchlist') {
        return render(profiles.filter((p) => p.monitoring_until && new Date(p.monitoring_until) > new Date()));
      }
      const ids = new Set(data.flagged.filter((f) => f.risk === risk).map((f) => f.id));
      render(profiles.filter((p) => ids.has(p.id)));
    });

    $('#usersBody').addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-view]');
      if (!btn) return;
      try {
        await renderCarePanel(btn.dataset.view);
      } catch (err) {
        showToast(err.message || 'Could not load care panel. Run schema_care.sql if tables are missing.');
      }
    });

    $('#userSummaryCard').addEventListener('click', async (e) => {
      if (!activeUserId) return;
      try {
        if (e.target.closest('#addWatchBtn')) {
          await window.Lighthouse.adminSetWatchlist(activeUserId, 7);
          showToast('Added to 7-day watchlist.');
          const refreshed = await window.Lighthouse.adminGetAnalytics();
          Object.assign(data, refreshed);
          data.flagged.forEach((f) => { flaggedMap[f.id] = f; });
          profiles.splice(0, profiles.length, ...(refreshed.profiles || []));
          render(profiles);
          await renderCarePanel(activeUserId);
        }
        if (e.target.closest('#clearWatchBtn')) {
          await window.Lighthouse.adminClearWatchlist(activeUserId);
          showToast('Removed from watchlist.');
          const refreshed = await window.Lighthouse.adminGetAnalytics();
          Object.assign(data, refreshed);
          data.flagged.forEach((f) => { flaggedMap[f.id] = f; });
          profiles.splice(0, profiles.length, ...(refreshed.profiles || []));
          render(profiles);
          await renderCarePanel(activeUserId);
        }
        if (e.target.closest('#sendNudgeBtn')) {
          const msg = ($('#nudgeMessage') && $('#nudgeMessage').value) || '';
          await window.Lighthouse.adminSendNudge(activeUserId, msg);
          showToast('Nudge sent to user dashboard.');
          await renderCarePanel(activeUserId);
        }
        if (e.target.closest('#addNoteBtn')) {
          const note = ($('#adminNote') && $('#adminNote').value) || '';
          await window.Lighthouse.adminAddNote(activeUserId, note);
          showToast('Note saved.');
          await renderCarePanel(activeUserId);
        }
      } catch (err) {
        showToast(err.message || 'Action failed');
      }
    });
  }

  async function loadScenarios() {
    const list = await window.Lighthouse.listScenarios({ includeInactive: true });
    const body = $('#scenariosBody');

    function render(rows) {
      body.innerHTML = rows.map((s) => `
        <tr>
          <td>${window.Lighthouse.escapeHtml(s.title)}</td>
          <td>${window.Lighthouse.escapeHtml(s.category)}</td>
          <td>${s.is_active === false ? 'Disabled' : 'Enabled'}</td>
          <td>
            <button class="btn btn-ghost" data-edit='${s.id}' style="padding:6px 10px;font-size:0.8rem">Edit</button>
            <button class="btn btn-outline" data-toggle='${s.id}' style="padding:6px 10px;font-size:0.8rem">${s.is_active === false ? 'Enable' : 'Disable'}</button>
            <button class="btn btn-outline" data-del='${s.id}' style="padding:6px 10px;font-size:0.8rem;color:var(--danger)">Delete</button>
          </td>
        </tr>`).join('');
    }
    render(list);
    window.__scenarios = list;

    $('#scenarioForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        title: $('#scTitle').value,
        category: $('#scCategory').value,
        story: $('#scStory').value,
        question: $('#scQuestion').value,
        option_a: $('#scA').value,
        option_b: $('#scB').value,
        option_c: $('#scC').value,
        option_d: $('#scD').value,
        is_active: $('#scActive').checked,
      };
      try {
        const id = $('#scId').value;
        if (id) await window.Lighthouse.adminUpdateScenario(id, payload);
        else await window.Lighthouse.adminCreateScenario(payload);
        showToast('Scenario saved.');
        location.reload();
      } catch (err) { showToast(err.message || 'Save failed'); }
    });

    body.addEventListener('click', async (e) => {
      const edit = e.target.closest('[data-edit]');
      const del = e.target.closest('[data-del]');
      const tog = e.target.closest('[data-toggle]');
      if (edit) {
        const s = window.__scenarios.find((x) => x.id === edit.dataset.edit);
        if (!s) return;
        $('#scId').value = s.id;
        $('#scTitle').value = s.title;
        $('#scCategory').value = s.category;
        $('#scStory').value = s.story;
        $('#scQuestion').value = s.question;
        $('#scA').value = s.option_a;
        $('#scB').value = s.option_b;
        $('#scC').value = s.option_c;
        $('#scD').value = s.option_d;
        $('#scActive').checked = s.is_active !== false;
        $('#scFormTitle').textContent = 'Edit Scenario';
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
      if (tog) {
        const s = window.__scenarios.find((x) => x.id === tog.dataset.toggle);
        if (!s) return;
        try {
          await window.Lighthouse.adminUpdateScenario(s.id, { ...s, is_active: s.is_active === false });
          location.reload();
        } catch (err) { showToast(err.message || 'Update failed'); }
      }
      if (del) {
        if (!confirm('Delete this scenario?')) return;
        try {
          await window.Lighthouse.adminDeleteScenario(del.dataset.del);
          location.reload();
        } catch (err) { showToast(err.message || 'Delete failed'); }
      }
    });
  }

  function getJsPdf() {
    return window.jspdf && window.jspdf.jsPDF;
  }

  function adminPdfShell(title, subtitle) {
    const jsPDF = getJsPdf();
    if (!jsPDF) throw new Error('PDF library failed to load. Check your connection and try again.');
    const adminName = ($('#userName') && $('#userName').textContent) || 'Admin';
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const margin = 48;
    let y = 56;
    const today = window.Lighthouse.localDateString
      ? window.Lighthouse.localDateString()
      : new Date().toISOString().slice(0, 10);

    doc.setFillColor(30, 58, 138);
    doc.rect(0, 0, pageW, 72, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('Lighthouse Admin', margin, 32);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.text(title, margin, 52);

    y = 100;
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(subtitle || title, margin, y);
    y += 18;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);
    doc.text(`Prepared by: ${adminName}`, margin, y);
    y += 14;
    doc.text(`Generated: ${new Date().toLocaleString()}`, margin, y);
    y += 24;
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, y, pageW - margin, y);
    y += 22;

    return {
      doc,
      pageW,
      margin,
      y,
      today,
      ensure(space) {
        if (this.y + space > 760) {
          this.doc.addPage();
          this.y = 56;
        }
      },
      heading(text) {
        this.ensure(28);
        this.doc.setFont('helvetica', 'bold');
        this.doc.setFontSize(12);
        this.doc.setTextColor(15, 23, 42);
        this.doc.text(text, this.margin, this.y);
        this.y += 18;
      },
      kv(label, value) {
        this.ensure(18);
        this.doc.setFont('helvetica', 'normal');
        this.doc.setFontSize(10);
        this.doc.setTextColor(71, 85, 105);
        this.doc.text(String(label), this.margin, this.y);
        this.doc.setFont('helvetica', 'bold');
        this.doc.setTextColor(15, 23, 42);
        this.doc.text(String(value), this.pageW - this.margin, this.y, { align: 'right' });
        this.y += 16;
      },
      para(text) {
        this.ensure(36);
        this.doc.setFont('helvetica', 'normal');
        this.doc.setFontSize(10);
        this.doc.setTextColor(15, 23, 42);
        const lines = this.doc.splitTextToSize(String(text), this.pageW - this.margin * 2);
        this.doc.text(lines, this.margin, this.y);
        this.y += lines.length * 13 + 8;
      },
      rule() {
        this.ensure(20);
        this.doc.setDrawColor(226, 232, 240);
        this.doc.line(this.margin, this.y, this.pageW - this.margin, this.y);
        this.y += 18;
      },
      footerNote() {
        this.ensure(40);
        this.y += 8;
        this.doc.setFont('helvetica', 'normal');
        this.doc.setFontSize(9);
        this.doc.setTextColor(100, 116, 139);
        const note = this.doc.splitTextToSize(
          'Admin monitoring report. Private journal text is intentionally excluded. Not medical advice.',
          this.pageW - this.margin * 2
        );
        this.doc.text(note, this.margin, this.y);
      },
      save(filename) {
        this.footerNote();
        this.doc.save(filename);
      },
    };
  }

  function exportPlatformSnapshot(data) {
    const pdf = adminPdfShell('Platform Snapshot', 'High-level platform engagement snapshot');
    pdf.heading('Platform Metrics');
    [
      ['Registered Users', data.totalUsers || 0],
      ['Active Users Today', data.activeUsersToday || 0],
      ['Daily Check-ins (total)', data.checkinsTotal || 0],
      ['Reflection Entries (total)', data.reflectionsTotal || 0],
      ['Scenario Completion Rate', `${data.scenarioCompletionRate || 0}%`],
      ['Visual Reflection Completion', `${data.visualCompletionRate || 0}%`],
      ['Flagged Users', data.flaggedCount || 0],
      ['Watchlist', data.watchlistCount || 0],
    ].forEach(([l, v]) => pdf.kv(l, v));
    pdf.save(`lighthouse-admin-platform-snapshot-${pdf.today}.pdf`);
    showToast('Platform Snapshot PDF downloaded.');
  }

  function exportEngagementPack(data, period) {
    const isMonthly = period === 'monthly';
    const days = isMonthly ? 14 : 7;
    const label = isMonthly ? 'Monthly (last 14 days)' : 'Weekly (last 7 days)';
    const pdf = adminPdfShell('Engagement Pack', `${label} engagement summary`);

    const labels = (data.activityLabels || []).slice(-days);
    const checkins = (data.activityCheckins || []).slice(-days);
    const reflections = (data.activityReflections || []).slice(-days);
    const growthLabels = (data.growthLabels || []).slice(-days);
    const growthValues = (data.growthValues || []).slice(-days);

    const checkinSum = checkins.reduce((a, b) => a + (Number(b) || 0), 0);
    const reflectionSum = reflections.reduce((a, b) => a + (Number(b) || 0), 0);
    const activeDays = checkins.filter((n) => Number(n) > 0).length;
    const startUsers = growthValues.length ? growthValues[0] : 0;
    const endUsers = growthValues.length ? growthValues[growthValues.length - 1] : 0;

    pdf.heading('Period Totals');
    [
      ['Period', label],
      ['Check-ins in period', checkinSum],
      ['Reflections in period', reflectionSum],
      ['Days with check-in activity', activeDays],
      ['Registered users (start → end)', `${startUsers} → ${endUsers}`],
      ['User growth in period', Math.max(0, endUsers - startUsers)],
      ['Scenario completion (platform)', `${data.scenarioCompletionRate || 0}%`],
      ['Visual completion (platform)', `${data.visualCompletionRate || 0}%`],
      ['Active users today', data.activeUsersToday || 0],
    ].forEach(([l, v]) => pdf.kv(l, v));

    pdf.rule();
    pdf.heading('Daily Activity');
    labels.forEach((day, i) => {
      pdf.para(`${day}:  Check-ins ${checkins[i] || 0}  ·  Reflections ${reflections[i] || 0}  ·  Users ${growthValues[i] != null ? growthValues[i] : '—'}`);
    });

    if (growthLabels.length) {
      pdf.rule();
      pdf.heading('User Growth Series');
      growthLabels.forEach((day, i) => pdf.kv(day, growthValues[i] != null ? growthValues[i] : '—'));
    }

    pdf.save(`lighthouse-admin-engagement-${isMonthly ? 'monthly' : 'weekly'}-${pdf.today}.pdf`);
    showToast(`${isMonthly ? 'Monthly' : 'Weekly'} Engagement PDF downloaded.`);
  }

  function exportFlaggedCareSummary(data) {
    const pdf = adminPdfShell('Flagged Care Summary', 'Attention indicators for follow-up (no journal text)');
    const flagged = (data.flagged || [])
      .filter((f) => f.risk !== 'Low' || f.monitoring)
      .sort((a, b) => (b.score || 0) - (a.score || 0));

    pdf.heading('Overview');
    [
      ['Flagged (Moderate/High)', data.flaggedCount || 0],
      ['On watchlist', data.watchlistCount || 0],
      ['Listed in this report', flagged.length],
    ].forEach(([l, v]) => pdf.kv(l, v));

    pdf.rule();
    if (!flagged.length) {
      pdf.para('No flagged users right now.');
    } else {
      flagged.forEach((f, idx) => {
        pdf.heading(`${idx + 1}. ${f.name || 'User'} — ${f.risk || 'Low'}`);
        pdf.kv('Status', f.status || 'active');
        pdf.kv('Last activity', f.lastActivity || '—');
        pdf.kv('Watchlist', f.monitoring ? `Yes${f.monitoringUntil ? ` until ${window.Lighthouse.formatDate(f.monitoringUntil)}` : ''}` : 'No');
        pdf.kv('Check-ins / Reflections / Scenarios', `${f.checkinCount || 0} / ${f.reflectionCount || 0} / ${f.scenarioCount || 0}`);
        const reasons = (f.reasons && f.reasons.length) ? f.reasons : ['No detailed triggers listed'];
        pdf.para(`Triggers: ${reasons.join('; ')}`);
      });
    }

    pdf.save(`lighthouse-admin-flagged-care-${pdf.today}.pdf`);
    showToast('Flagged Care Summary PDF downloaded.');
  }

  function exportUserCohortSummary(data) {
    const pdf = adminPdfShell('User Cohort Summary', 'Risk bands, account status, and signup cohort');
    const profiles = data.profiles || [];
    const flaggedMap = {};
    (data.flagged || []).forEach((f) => { flaggedMap[f.id] = f; });

    const risk = { Low: 0, Moderate: 0, High: 0 };
    const status = { active: 0, inactive: 0, suspended: 0, other: 0 };
    const roles = { user: 0, admin: 0, other: 0 };
    let watchlist = 0;
    let new7 = 0;
    let new30 = 0;
    const now = Date.now();

    profiles.forEach((p) => {
      const f = flaggedMap[p.id];
      const r = (f && f.risk) || 'Low';
      if (risk[r] != null) risk[r] += 1;
      else risk.Low += 1;

      const st = p.account_status || 'active';
      if (status[st] != null) status[st] += 1;
      else status.other += 1;

      const role = p.role || 'user';
      if (roles[role] != null) roles[role] += 1;
      else roles.other += 1;

      if (f && f.monitoring) watchlist += 1;
      else if (p.monitoring_until && new Date(p.monitoring_until) > new Date()) watchlist += 1;

      const created = p.created_at ? new Date(p.created_at).getTime() : 0;
      if (created && (now - created) <= 7 * 86400000) new7 += 1;
      if (created && (now - created) <= 30 * 86400000) new30 += 1;
    });

    pdf.heading('Cohort Size');
    [
      ['Total registered users', profiles.length],
      ['New signups (7 days)', new7],
      ['New signups (30 days)', new30],
      ['On watchlist', watchlist],
    ].forEach(([l, v]) => pdf.kv(l, v));

    pdf.rule();
    pdf.heading('By Risk Band');
    Object.keys(risk).forEach((k) => pdf.kv(k, risk[k]));

    pdf.rule();
    pdf.heading('By Account Status');
    Object.keys(status).filter((k) => status[k] > 0 || k !== 'other').forEach((k) => pdf.kv(k, status[k]));

    pdf.rule();
    pdf.heading('By Role');
    Object.keys(roles).filter((k) => roles[k] > 0 || k !== 'other').forEach((k) => pdf.kv(k, roles[k]));

    pdf.save(`lighthouse-admin-user-cohort-${pdf.today}.pdf`);
    showToast('User Cohort Summary PDF downloaded.');
  }

  function runAdminPdfExport(type, data, engagementPeriod) {
    if (!data) throw new Error('Load report data first.');
    if (type === 'snapshot') return exportPlatformSnapshot(data);
    if (type === 'engagement') return exportEngagementPack(data, engagementPeriod);
    if (type === 'flagged') return exportFlaggedCareSummary(data);
    if (type === 'cohort') return exportUserCohortSummary(data);
    throw new Error('Unknown export type.');
  }

  (async function boot() {
    if (!(await initAdmin())) return;
    try {
      if (page === 'dashboard') await loadDashboard();
      else if (page === 'users') await loadUsers();
      else if (page === 'scenarios') await loadScenarios();
      else if (page === 'analytics') await loadDashboard();
      else if (page === 'reports') {
        const data = await window.Lighthouse.adminGetAnalytics();
        window.__adminReportData = data;
        let engagementPeriod = 'weekly';

        $('#adminReport').innerHTML = `
          <div class="compare-grid">
            <div class="compare-card"><div class="cc-label">Users</div><div class="cc-val">${data.totalUsers}</div></div>
            <div class="compare-card"><div class="cc-label">Check-ins</div><div class="cc-val">${data.checkinsTotal}</div></div>
            <div class="compare-card"><div class="cc-label">Reflections</div><div class="cc-val">${data.reflectionsTotal}</div></div>
            <div class="compare-card"><div class="cc-label">Flagged</div><div class="cc-val">${data.flaggedCount}</div></div>
          </div>
          <div class="compare-grid" style="margin-top:16px">
            <div class="compare-card"><div class="cc-label">Active Today</div><div class="cc-val">${data.activeUsersToday}</div></div>
            <div class="compare-card"><div class="cc-label">Scenario Completion</div><div class="cc-val">${data.scenarioCompletionRate}%</div></div>
            <div class="compare-card"><div class="cc-label">Visual Completion</div><div class="cc-val">${data.visualCompletionRate}%</div></div>
            <div class="compare-card"><div class="cc-label">Watchlist</div><div class="cc-val">${data.watchlistCount || 0}</div></div>
          </div>`;

        const printBtn = $('#adminPrintBtn');
        if (printBtn) printBtn.addEventListener('click', () => window.print());

        const periodToggle = $('#engagementPeriod');
        if (periodToggle) {
          periodToggle.addEventListener('click', (e) => {
            const btn = e.target.closest('button[data-period]');
            if (!btn) return;
            engagementPeriod = btn.dataset.period;
            $$('#engagementPeriod button').forEach((b) => b.classList.toggle('active', b === btn));
          });
        }

        const exportGrid = $('#adminExportGrid');
        if (exportGrid) {
          exportGrid.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-export]');
            if (!btn) return;
            try {
              runAdminPdfExport(btn.dataset.export, window.__adminReportData, engagementPeriod);
            } catch (err) {
              showToast(err.message || 'PDF export failed.');
            }
          });
        }
      } else if (page === 'settings') {
        // admin settings: theme only locally
      }
    } catch (err) {
      showToast(err.message || 'Admin data unavailable. Run schema_platform.sql and promote your user to admin.');
    }
  })();
})();
