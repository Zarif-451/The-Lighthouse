/* ==========================================================================
   Lighthouse — Personal dashboard
   Layout/charts preserved. Metrics use real data when enough history exists.
   ========================================================================== */
(function () {
  'use strict';

  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  const toast = $('#toast');
  const toastMsg = $('#toastMsg');
  let toastTimer;
  function showToast(msg) {
    toastMsg.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2600);
  }

  const now = new Date();
  let trendChart;
  let distChart;
  let rawMetrics = null;
  let metrics = null;
  let analyticsMode = localStorage.getItem('lh_analytics_mode') === 'realtime' ? 'realtime' : 'demo';
  let trendRange = 30;

  function resolveViewMetrics() {
    const base = rawMetrics;
    if (!base) return null;
    const isDemo = analyticsMode === 'demo';
    const pack = isDemo ? base.demoAnalytics : base.realAnalytics;
    const needs = base.needs || {};

    return {
      ...base,
      mode: analyticsMode,
      isDemo,
      sleepAvg: pack.sleepAvg,
      moodAvg: pack.moodAvg,
      energyAvg: pack.energyAvg,
      prodAvg: pack.prodAvg,
      wellnessScore: pack.wellnessScore,
      trendLabels: pack.trendLabels,
      trendValues: pack.trendValues,
      dist: pack.dist,
      enoughForTrends: isDemo ? true : !!pack.enoughForTrends,
      demoSleepSeries: (base.demoAnalytics && base.demoAnalytics.sleepSeries) || [],
      demoEnergySeries: (base.demoAnalytics && base.demoAnalytics.energySeries) || [],
      // Per-widget: show demo badge only in demo mode
      demo: isDemo
        ? {
            wellnessScore: true,
            trend: true,
            dist: true,
            sleep: true,
            mood: true,
            productivity: true,
            behavior: true,
          }
        : {
            wellnessScore: false,
            trend: false,
            dist: false,
            sleep: false,
            mood: false,
            productivity: false,
            behavior: false,
          },
      // Real-time insufficient flags
      insufficient: isDemo
        ? {}
        : {
            wellnessScore: !!needs.wellnessScore,
            trend: !!needs.trend,
            dist: !!needs.dist,
            sleep: !!needs.sleep,
            mood: !!needs.mood,
            productivity: !!needs.productivity,
            behavior: !!needs.behavior,
          },
    };
  }

  function syncModeToggle() {
    const root = $('#analyticsMode');
    if (!root) return;
    $$('#analyticsMode button').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.mode === analyticsMode);
    });
  }

  function refreshAnalyticsView() {
    metrics = resolveViewMetrics();
    if (!metrics) return;
    syncModeToggle();
    renderStats(metrics);
    renderBehaviors(metrics);
    renderSummary(metrics);
    if (window.Chart) {
      Chart.defaults.font.family = "'Inter', sans-serif";
      Chart.defaults.color = '#475569';
      buildTrend(trendRange);
      buildDist();
    }
  }

  function sparkSvg(data, color) {
    const vals = (data || []).filter((v) => v != null && !Number.isNaN(v));
    if (vals.length < 2) {
      return `<svg viewBox="0 0 100 34" width="100%" height="100%"><text x="0" y="22" fill="#94a3b8" font-size="10">Not enough data yet</text></svg>`;
    }
    const w = 100, h = 34, max = Math.max(...vals), min = Math.min(...vals);
    const range = max - min || 1;
    const pts = vals.map((v, i) => {
      const x = (i / (vals.length - 1)) * w;
      const y = h - 4 - ((v - min) / range) * (h - 8);
      return [x, y];
    });
    const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
    const area = `${line} L${w} ${h} L0 ${h} Z`;
    const id = 'g' + Math.random().toString(36).slice(2, 7);
    return `<svg viewBox="0 0 ${w} ${h}" width="100%" height="100%" preserveAspectRatio="none">
      <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${color}" stop-opacity="0.28"/>
        <stop offset="1" stop-color="${color}" stop-opacity="0"/>
      </linearGradient></defs>
      <path d="${area}" fill="url(#${id})"/>
      <path d="${line}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
  }

  function renderProgress(progress) {
    $('#progressDone').textContent = String(progress.completed);
    $('#progressTotal').textContent = String(progress.total);
    const pct = Math.round((progress.completed / progress.total) * 100);
    requestAnimationFrame(() => { $('#progressBarFill').style.width = pct + '%'; });

    const order = ['checkin', 'scenario', 'visual', 'journal'];
    const hrefs = {
      checkin: 'checkins.html?flow=1',
      scenario: 'scenario.html?flow=1',
      visual: 'visual.html?flow=1',
      journal: 'journal.html?flow=1',
    };
    $('#journeySteps').innerHTML = order.map((key) => {
      const done = progress.steps[key];
      const isNext = progress.next === key;
      const cls = `journey-step${done ? ' done' : ''}${isNext ? ' next' : ''}`;
      const sub = done ? 'Done' : isNext ? 'Up next' : 'Pending';
      return `<a class="${cls}" href="${hrefs[key]}">
        <span class="js-check">${done ? '✓' : ''}</span>
        <span class="js-label">${progress.labels[key]}</span>
        <span class="js-sub">${sub}</span>
      </a>`;
    }).join('');

    const btn = $('#continueJourneyBtn');
    if (progress.completed === progress.total) {
      btn.textContent = 'Today’s journey complete';
      btn.href = 'dashboard.html';
      btn.classList.remove('btn-primary');
      btn.classList.add('btn-teal');
    } else {
      btn.textContent = `Continue — ${progress.labels[progress.next]}`;
      btn.href = progress.nextHref || 'checkins.html?flow=1';
      btn.classList.add('btn-primary');
      btn.classList.remove('btn-teal');
    }
  }

  function demoBadge(show) {
    return show
      ? `<span class="demo-badge" title="Sample visualization until sufficient historical data is available.">Demo Analytics</span>`
      : '';
  }

  function setDemoBadge(el, show) {
    if (!el) return;
    const host = el.querySelector('h3') || el;
    let badge = host.querySelector(':scope > .demo-badge') || el.querySelector('.demo-badge');
    if (!show) {
      if (badge) badge.remove();
      // also clear any leftover on parent
      const extra = el.querySelectorAll('.demo-badge');
      extra.forEach((b) => b.remove());
      return;
    }
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'demo-badge';
      badge.title = 'Sample visualization until sufficient historical data is available.';
      badge.textContent = 'Demo Analytics';
      host.appendChild(badge);
    }
  }

  function renderStats(m) {
    const demo = m.demo || {};
    const insuf = m.insufficient || {};
    const moodLabel = (!insuf.mood && m.moodAvg != null)
      ? (['', 'Very Low', 'Low', 'Neutral', 'Good', 'Excellent'][Math.round(m.moodAvg)] || String(m.moodAvg))
      : '—';

    const wellnessVal = insuf.wellnessScore ? '—' : (m.wellnessScore != null ? String(m.wellnessScore) : '—');
    const sleepVal = insuf.sleep ? '—' : (m.sleepAvg != null ? String(m.sleepAvg) : '—');
    const checkinsVal = String(m.checkinCount);
    const journalVal = String(m.journalCount);
    const activeVal = String(m.activeDays);
    const activityTrend = insuf.productivity
      ? '—'
      : (m.energyAvg != null ? String(Math.round(((m.energyAvg - 1) / 4) * 100)) : '—');

    const sparkWellness = (!insuf.trend && (m.trendValues || []).filter((v) => v != null).length)
      ? (m.trendValues || []).filter((v) => v != null).slice(-7)
      : (demo.trend ? (m.trendValues || []).filter((v) => v != null).slice(-7) : []);
    const sparkSleep = demo.sleep
      ? (m.demoSleepSeries || [])
      : (insuf.sleep ? [] : (m.recentCheckins || []).slice().reverse().map((c) => Number(c.sleep_hours)));
    const sparkEnergy = demo.productivity
      ? (m.demoEnergySeries || [])
      : (insuf.productivity ? [] : (m.recentCheckins || []).slice().reverse().map((c) => Number(c.energy_level)));

    const cards = [
      { key: 'wellness', label: 'My Wellness Score', value: wellnessVal, unit: wellnessVal !== '—' ? '/100' : '', trend: demo.wellnessScore ? 'Demo' : (insuf.wellnessScore ? 'Need data' : 'Live'), dir: wellnessVal !== '—' ? 'up' : 'flat', ic: 'ic-teal', spark: sparkWellness, color: '#14B8A6', demo: demo.wellnessScore,
        svg: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/>' },
      { key: 'checkins', label: 'My Check-ins Completed', value: checkinsVal, unit: '', trend: 'Live', dir: 'flat', ic: 'ic-blue', spark: sparkEnergy, color: '#1E3A8A', demo: false,
        svg: '<rect x="3" y="4" width="18" height="18" rx="3"/><path d="M16 2v4M8 2v4M3 10h18M9 16l2 2 4-4"/>' },
      { key: 'journal', label: 'My Journal Entries', value: journalVal, unit: '', trend: 'Live', dir: 'flat', ic: 'ic-amber', spark: [m.journalCount], color: '#F59E0B', demo: false,
        svg: '<path d="M4 4h13a3 3 0 0 1 3 3v13H7a3 3 0 0 1-3-3z"/><path d="M8 8h8M8 12h8M8 16h5"/>' },
      { key: 'active', label: 'My Active Days', value: activeVal, unit: '', trend: 'Live', dir: 'flat', ic: 'ic-violet', spark: sparkEnergy, color: '#8b5cf6', demo: false,
        svg: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>' },
      { key: 'sleep', label: 'My Sleep Trend', value: sleepVal, unit: sleepVal !== '—' ? 'hrs' : '', trend: demo.sleep ? 'Demo' : (insuf.sleep ? 'Need data' : 'Avg'), dir: sleepVal !== '—' ? 'up' : 'flat', ic: 'ic-cyan', spark: sparkSleep, color: '#22d3ee', demo: demo.sleep,
        svg: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>' },
      { key: 'activity', label: 'My Activity Trend', value: activityTrend, unit: activityTrend !== '—' ? '%' : '', trend: demo.productivity ? 'Demo' : (insuf.productivity ? 'Need data' : (moodLabel !== '—' ? moodLabel : 'Live')), dir: activityTrend !== '—' ? 'up' : 'flat', ic: 'ic-rose', spark: sparkEnergy, color: '#fb7185', demo: demo.productivity,
        svg: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>' },
    ];

    $('#statsGrid').innerHTML = cards.map((s, i) => `
      <div class="stat rise" style="animation-delay:${i * 60}ms" data-stat="${s.key}">
        <div class="s-top">
          <span class="s-ic ${s.ic}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${s.svg}</svg></span>
          <span class="trend ${s.dir}">${s.trend}</span>
        </div>
        <div>
          <div class="s-val">${s.value}<small>${s.unit}</small></div>
          <div class="s-label">${s.label}${s.demo ? ' ' + demoBadge(true) : ''}</div>
        </div>
        <div class="s-spark">${sparkSvg(s.spark, s.color)}</div>
      </div>
    `).join('');
  }

  function renderBehaviors(m) {
    const demo = m.demo || {};
    const insuf = m.insufficient || {};

    function metricCard(opts) {
      return opts;
    }

    const items = [
      metricCard({
        title: 'Sleep Patterns',
        ic: 'ic-cyan',
        val: (demo.sleep || !insuf.sleep) && m.sleepAvg != null ? String(m.sleepAvg) : '—',
        unit: (demo.sleep || !insuf.sleep) && m.sleepAvg != null ? 'hrs avg' : '',
        pct: (demo.sleep || !insuf.sleep) && m.sleepAvg != null ? Math.min(100, Math.round((m.sleepAvg / 8) * 100)) : 0,
        trend: demo.sleep ? 'Demo analytics' : (insuf.sleep ? 'Not enough data yet.' : 'From your check-ins'),
        dir: (demo.sleep || !insuf.sleep) && m.sleepAvg != null ? 'up' : 'flat',
        demo: demo.sleep,
        svg: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
      }),
      metricCard({
        title: 'Mood Trend',
        ic: 'ic-amber',
        val: (demo.mood || !insuf.mood) && m.moodAvg != null ? String(m.moodAvg) : '—',
        unit: (demo.mood || !insuf.mood) && m.moodAvg != null ? '/5 avg' : '',
        pct: (demo.mood || !insuf.mood) && m.moodAvg != null ? Math.min(100, Math.round(((m.moodAvg - 1) / 4) * 100)) : 0,
        trend: demo.mood ? 'Demo analytics' : (insuf.mood ? 'Not enough data yet.' : 'From your check-ins'),
        dir: (demo.mood || !insuf.mood) && m.moodAvg != null ? 'up' : 'flat',
        demo: demo.mood,
        svg: '<circle cx="12" cy="12" r="9"/><path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01"/>',
      }),
      metricCard({
        title: 'Productivity Trend',
        ic: 'ic-rose',
        val: (demo.productivity || !insuf.productivity) && m.prodAvg != null ? String(m.prodAvg) : '—',
        unit: (demo.productivity || !insuf.productivity) && m.prodAvg != null ? '/5 avg' : '',
        pct: (demo.productivity || !insuf.productivity) && m.prodAvg != null ? Math.min(100, Math.round(((m.prodAvg - 1) / 4) * 100)) : 0,
        trend: demo.productivity ? 'Demo analytics' : (insuf.productivity ? 'Not enough data yet.' : 'From your check-ins'),
        dir: (demo.productivity || !insuf.productivity) && m.prodAvg != null ? 'up' : 'flat',
        demo: demo.productivity,
        svg: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
      }),
      {
        title: 'Scenario Completion',
        ic: 'ic-amber',
        val: String(m.scenarioCount),
        unit: 'responses',
        pct: Math.min(100, m.scenarioCount * 5),
        trend: m.progress.steps.scenario ? 'Completed today' : 'Pending today',
        dir: m.scenarioCount ? 'up' : 'flat',
        demo: false,
        svg: '<path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z"/>',
      },
      {
        title: 'Visual Reflection',
        ic: 'ic-blue',
        val: String(m.visualCount),
        unit: 'entries',
        pct: Math.min(100, m.visualCount * 5),
        trend: m.progress.steps.visual ? 'Completed today' : 'Pending today',
        dir: m.visualCount ? 'up' : 'flat',
        demo: false,
        svg: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="11" r="1.5"/><path d="m21 15-4.5-4.5L9 18"/>',
      },
      {
        title: 'Reflection Activity',
        ic: 'ic-violet',
        val: String(m.journalCount),
        unit: 'entries',
        pct: Math.min(100, m.journalCount * 5),
        trend: m.progress.steps.journal ? 'Journaled today' : 'Pending today',
        dir: m.journalCount ? 'up' : 'flat',
        demo: false,
        svg: '<path d="M4 4h13a3 3 0 0 1 3 3v13H7a3 3 0 0 1-3-3z"/><path d="M8 8h8M8 12h8"/>',
      },
    ];

    $$('.block-head').forEach((head) => {
      const h3 = head.querySelector('h3');
      if (h3 && h3.textContent.includes('Behavioral')) {
        setDemoBadge(head.querySelector('div') || head, !!demo.behavior);
      }
    });

    $('#behaviorGrid').innerHTML = items.map((b, i) => `
      <div class="behavior rise" style="animation-delay:${i * 60}ms">
        <div class="b-top">
          <span class="b-ic ${b.ic}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${b.svg}</svg></span>
          <span class="b-title">${b.title}${b.demo ? ' ' + demoBadge(true) : ''}</span>
        </div>
        <div class="b-val">${b.val}<small> ${b.unit}</small></div>
        <div class="progress"><i data-pct="${b.pct}"></i></div>
        <div class="b-foot ${b.dir === 'up' ? 'up' : ''}">${b.trend}</div>
      </div>
    `).join('');

    requestAnimationFrame(() => {
      setTimeout(() => {
        $$('.progress i').forEach((el) => { el.style.width = el.dataset.pct + '%'; });
      }, 200);
    });
  }

  function renderSummary(m) {
    const demo = m.demo || {};
    const insuf = m.insufficient || {};
    const rows = [
      {
        title: 'Current Wellness Status',
        text: demo.wellnessScore
          ? `Sample wellness score ${m.wellnessScore}/100 for demonstration.`
          : (insuf.wellnessScore
            ? 'Not enough data yet. Keep checking in to unlock your live wellness score.'
            : `Your calculated wellness score is ${m.wellnessScore}/100 based on sleep, mood, productivity, activity, reflections, and journey completion.`),
        ic: 'ic-teal',
        demo: demo.wellnessScore,
        svg: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/>',
      },
      {
        title: 'Today’s Journey',
        text: `${m.progress.completed} of ${m.progress.total} steps complete` +
          (m.progress.next ? ` — next up: ${m.progress.labels[m.progress.next]}.` : ' — well done today.'),
        ic: 'ic-blue',
        demo: false,
        svg: '<rect x="3" y="4" width="18" height="18" rx="3"/><path d="M16 2v4M8 2v4M3 10h18M9 16l2 2 4-4"/>',
      },
      {
        title: 'Sleep Average',
        text: demo.sleep
          ? `Sample sleep average ${m.sleepAvg} hours.`
          : (insuf.sleep
            ? 'Not enough data yet.'
            : `Average sleep across recent check-ins: ${m.sleepAvg} hours.`),
        ic: 'ic-cyan',
        demo: demo.sleep,
        svg: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
      },
      {
        title: 'Mood Average',
        text: demo.mood
          ? `Sample mood average ${m.moodAvg}/5.`
          : (insuf.mood
            ? 'Not enough data yet.'
            : `Average mood score: ${m.moodAvg}/5 from your check-in history.`),
        ic: 'ic-amber',
        demo: demo.mood,
        svg: '<path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>',
      },
      {
        title: 'Suggested Focus',
        text: m.progress.next
          ? `Continue with ${m.progress.labels[m.progress.next]} to keep today’s journey moving.`
          : 'All four daily steps are complete. Rest well and return tomorrow.',
        ic: 'ic-violet',
        demo: false,
        svg: '<circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>',
      },
    ];

    $('#summaryList').innerHTML = rows.map((s) => `
      <div class="summary-item">
        <span class="si-ic ${s.ic}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${s.svg}</svg></span>
        <div><h4>${s.title}${s.demo ? ' ' + demoBadge(true) : ''}</h4><p>${s.text}</p></div>
      </div>
    `).join('');
  }

  function renderReflections(rows) {
    const LH = window.Lighthouse;
    const list = $('#reflectionList');
    if (!rows || !rows.length) {
      list.innerHTML = `
        <div class="reflect-card">
          <div class="rc-head">
            <span class="rc-mood"><span class="rc-emoji" style="background:rgba(30,58,138,.12)">📝</span>No entries yet</span>
          </div>
          <p>Your latest reflections will appear here after you write in the Reflection Journal.</p>
          <div class="rc-tags"><a class="tag" href="journal.html">Open journal</a></div>
        </div>`;
      return;
    }
    list.innerHTML = rows.map((r) => {
      const text = String(r.reflection_text || '');
      const preview = text.length > 160 ? text.slice(0, 160) + '…' : text;
      return `
        <div class="reflect-card">
          <div class="rc-head">
            <span class="rc-mood"><span class="rc-emoji" style="background:rgba(20,184,166,.14)">✍️</span>Reflection</span>
            <span class="rc-date">${LH.escapeHtml(LH.formatRelativeDate(r.created_at))} · ${LH.escapeHtml(LH.formatTime(r.created_at))}</span>
          </div>
          <p>${LH.escapeHtml(preview)}</p>
        </div>`;
    }).join('');
  }

  function buildTrend(range) {
    const teal = '#14B8A6';
    const demo = (metrics.demo || {}).trend;
    const insuf = (metrics.insufficient || {}).trend;
    const labels = (metrics.trendLabels || []).slice(-range);
    const data = (metrics.trendValues || []).slice(-range);
    const filled = data.filter((v) => v != null);

    const chartBox = $('#trendChart').closest('.chart-box');
    const headTitle = chartBox && chartBox.querySelector('.block-head > div');
    setDemoBadge(headTitle, demo);
    const caption = chartBox && chartBox.querySelector('.block-head p');
    if (caption) {
      caption.textContent = demo
        ? metrics.demoCaption
        : 'Your wellness score over the last 30 days';
    }

    const wrap = $('#trendChart').parentElement;
    let empty = wrap.querySelector('.insight-empty');
    if (insuf || filled.length < 2) {
      if (trendChart) { trendChart.destroy(); trendChart = null; }
      $('#trendChart').style.display = 'none';
      if (!empty) {
        empty = document.createElement('div');
        empty.className = 'insight-empty';
        wrap.appendChild(empty);
      }
      empty.hidden = false;
      empty.textContent = metrics.insufficientMessage || 'Not enough data yet.';
      return;
    }
    $('#trendChart').style.display = '';
    if (empty) empty.hidden = true;

    const ctx = $('#trendChart').getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, 300);
    grad.addColorStop(0, 'rgba(20,184,166,0.30)');
    grad.addColorStop(1, 'rgba(20,184,166,0.00)');
    if (trendChart) trendChart.destroy();

    trendChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: demo ? 'Demo Wellness Score' : 'Wellness Score',
          data,
          borderColor: teal,
          backgroundColor: grad,
          borderWidth: 3,
          fill: true,
          tension: 0.4,
          spanGaps: true,
          pointRadius: 0,
          pointHoverRadius: 6,
          pointHoverBackgroundColor: '#fff',
          pointHoverBorderColor: teal,
          pointHoverBorderWidth: 3,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { intersect: false, mode: 'index' },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#0f172a',
            padding: 12, cornerRadius: 10, displayColors: false,
            titleColor: '#94a3b8', bodyColor: '#fff', bodyFont: { weight: '700', size: 14 },
            callbacks: {
              label: (c) => (c.parsed.y == null ? 'No check-in' : `${demo ? 'Demo wellness' : 'Wellness'}: ${c.parsed.y}/100`),
            },
          },
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: '#94a3b8', maxTicksLimit: 8, font: { size: 11 } }, border: { display: false } },
          y: {
            min: 0, max: 100,
            grid: { color: '#eef2f7' },
            ticks: { color: '#94a3b8', stepSize: 20, font: { size: 11 } },
            border: { display: false },
          },
        },
        animation: { duration: 900, easing: 'easeOutQuart' },
      },
    });
  }

  function buildDist() {
    const brandBlue = '#1E3A8A';
    const teal = '#14B8A6';
    const amber = '#F59E0B';
    const demo = (metrics.demo || {}).dist;
    const insuf = (metrics.insufficient || {}).dist;
    const wrap = $('#distChart').parentElement;
    let empty = wrap.querySelector('.insight-empty');
    const dist = metrics.dist || {};
    const values = [dist.Excellent || 0, dist.Good || 0, dist.Moderate || 0, dist['Needs Attention'] || 0];
    const total = values.reduce((a, b) => a + b, 0);

    const chartBox = $('#distChart').closest('.chart-box');
    const headTitle = chartBox && chartBox.querySelector('.block-head > div');
    setDemoBadge(headTitle, demo);
    const caption = chartBox && chartBox.querySelector('.block-head p');
    if (caption) {
      caption.textContent = demo
        ? metrics.demoCaption
        : 'Your recent wellness pattern';
    }

    if (insuf || total < 2) {
      if (distChart) { distChart.destroy(); distChart = null; }
      $('#distChart').style.display = 'none';
      $('.doughnut-center').style.display = 'none';
      if (!empty) {
        empty = document.createElement('div');
        empty.className = 'insight-empty';
        wrap.appendChild(empty);
      }
      empty.hidden = false;
      empty.textContent = metrics.insufficientMessage || 'Not enough data yet.';
      $('#distLegend').innerHTML = '';
      return;
    }

    $('#distChart').style.display = '';
    $('.doughnut-center').style.display = '';
    if (empty) empty.hidden = true;

    const labels = ['Excellent', 'Good', 'Moderate', 'Needs Attention'];
    const colors = [teal, brandBlue, amber, '#ef4444'];
    const ctx = $('#distChart').getContext('2d');
    if (distChart) distChart.destroy();
    distChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{ data: values, backgroundColor: colors, borderColor: '#fff', borderWidth: 3, hoverOffset: 8 }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '72%',
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#0f172a', padding: 12, cornerRadius: 10,
            callbacks: { label: (c) => ` ${c.label}: ${c.parsed} days${demo ? ' (demo)' : ''}` },
          },
        },
      },
    });

    $('#distLegend').innerHTML = labels.map((l, i) => `
      <span class="lg"><i style="background:${colors[i]}"></i>${l} · ${Math.round((values[i] / total) * 100)}%</span>
    `).join('');
    $('#distCenter').textContent = metrics.wellnessScore != null ? metrics.wellnessScore : '—';
  }

  function wireShell() {
    const sidebar = $('#sidebar');
    const overlay = $('#overlay');
    $('#hamburger').addEventListener('click', () => { sidebar.classList.add('open'); overlay.classList.add('show'); });
    overlay.addEventListener('click', () => { sidebar.classList.remove('open'); overlay.classList.remove('show'); });

    $$('.side-nav a').forEach((a) => {
      a.addEventListener('click', (e) => {
        const href = a.getAttribute('href') || '';
        if (href === '#' || !href) {
          e.preventDefault();
          showToast(`${a.dataset.nav} is coming soon.`);
        }
        sidebar.classList.remove('open');
        overlay.classList.remove('show');
      });
    });

    $$('.action-btn').forEach((btn) =>
      btn.addEventListener('click', async () => {
        const href = btn.dataset.href;
        const action = btn.dataset.action;
        if (href) {
          window.location.href = href;
          return;
        }
        if (action === 'export') {
          try {
            showToast('Preparing your data export…');
            const [checkins, reflections, scenarios, visuals, progress] = await Promise.all([
              window.Lighthouse.listCheckins({ limit: 365 }),
              window.Lighthouse.listReflections({ limit: 365 }),
              window.Lighthouse.listScenarioResponses(),
              window.Lighthouse.listVisualReflections({ limit: 365 }),
              window.Lighthouse.getTodaysProgress(),
            ]);
            const payload = {
              exportedAt: new Date().toISOString(),
              app: 'Lighthouse',
              todayProgress: progress,
              checkins,
              reflections,
              scenarioResponses: scenarios,
              visualReflections: visuals,
            };
            const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `lighthouse-export-${window.Lighthouse.localDateString()}.json`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
            showToast('Download started — your personal data copy.');
          } catch (err) {
            showToast(err.message || 'Export failed.');
          }
          return;
        }
        if (action === 'analytics') {
          analyticsMode = 'realtime';
          localStorage.setItem('lh_analytics_mode', 'realtime');
          if (rawMetrics) refreshAnalyticsView();
          const charts = document.querySelector('.charts-row');
          if (charts) charts.scrollIntoView({ behavior: 'smooth', block: 'start' });
          showToast('Switched to Real-time Analytics');
        }
      })
    );
    // Report cards are real links now — no toast intercept
    $$('.link-more').forEach((el) => {
      el.addEventListener('click', (e) => {
        const href = el.getAttribute('href') || '';
        if (href === '#' || !href) {
          e.preventDefault();
          // Behavioral insights "View all" → Insights page
          if ((el.textContent || '').toLowerCase().includes('insight')) {
            window.location.href = 'insights.html';
            return;
          }
          showToast('Opening…');
        }
      });
    });

    // Fix "View all insights" placeholder link
    $$('.link-more').forEach((el) => {
      if ((el.textContent || '').toLowerCase().includes('insight') && (el.getAttribute('href') === '#' || !el.getAttribute('href'))) {
        el.setAttribute('href', 'insights.html');
      }
    });

    $('#userChip').addEventListener('click', () => {
      window.location.href = 'profile.html';
    });

    $('#checkinCta').addEventListener('click', () => {
      window.location.href = 'checkins.html?flow=1';
    });
    $('#notifBtn').addEventListener('click', () => {
      const p = metrics && metrics.progress;
      if (!p) return showToast('Loading your progress…');
      if (p.completed === p.total) showToast('Today’s journey is complete. Nice work.');
      else showToast(`Next step: ${p.labels[p.next]}`);
    });

    const dashSearch = $('#dashSearch');
    if (dashSearch) {
      dashSearch.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        const q = dashSearch.value.trim();
        if (!q) {
          showToast('Type a keyword to search your reflections or check-ins.');
          return;
        }
        const lower = q.toLowerCase();
        if (lower.includes('check') || lower.includes('sleep') || lower.includes('mood')) {
          window.location.href = 'checkins.html';
          return;
        }
        window.location.href = `journal.html?q=${encodeURIComponent(q)}`;
      });
    }

    $('#logoutBtn').addEventListener('click', async () => {
      try { await window.Lighthouse.signOut(); } catch (e) { /* ignore */ }
      showToast('Logged out. See you soon!');
      setTimeout(() => { window.location.href = 'index.html'; }, 800);
    });

    $('#trendToggle').addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn || !metrics) return;
      $$('#trendToggle button').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      trendRange = parseInt(btn.dataset.range, 10);
      buildTrend(trendRange);
    });

    const modeRoot = $('#analyticsMode');
    if (modeRoot) {
      modeRoot.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-mode]');
        if (!btn || !rawMetrics) return;
        analyticsMode = btn.dataset.mode === 'realtime' ? 'realtime' : 'demo';
        localStorage.setItem('lh_analytics_mode', analyticsMode);
        refreshAnalyticsView();
        showToast(analyticsMode === 'demo' ? 'Showing Demo Analytics' : 'Showing Real-time Analytics');
      });
    }

    window.addEventListener('resize', () => {
      if (trendChart) trendChart.resize();
      if (distChart) distChart.resize();
    }, { passive: true });
  }

  (async function init() {
    try {
      if (!window.Lighthouse || !window.Lighthouse.isConfigured) {
        showToast('Configure Supabase in assets/js/config.js first.');
        setTimeout(() => { window.location.href = 'index.html#auth'; }, 1200);
        return;
      }

      const user = await window.Lighthouse.requireAuth('index.html#auth');
      if (!user) return;

      if (window.LighthouseTheme) window.LighthouseTheme.bindToggles();

      try {
        const profile = await window.Lighthouse.ensureProfile(user);
        const prefs = await window.Lighthouse.getPreferences();
        if (prefs && prefs.theme && window.LighthouseTheme) {
          window.LighthouseTheme.apply(prefs.theme, { silent: true });
          window.LighthouseTheme.bindToggles();
        }
        if (profile && profile.role === 'admin') {
          showToast('Redirecting to Admin Portal…');
          setTimeout(() => { window.location.href = '/admin/index.html'; }, 400);
          return;
        }
        window.Lighthouse.touchLastLogin().catch(() => {});
      } catch (e) { /* profiles table may not exist yet */ }

      const name = window.Lighthouse.displayNameFromUser(user);
      const firstName = name.split(' ')[0] || 'there';
      const hour = now.getHours();
      const greet = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
      $('#userName').textContent = name;
      $('#userAva').textContent = window.Lighthouse.initialsFromName(name);
      $('#greetingTitle').textContent = `${greet}, ${firstName}`;
      $('#todayDate').textContent = now.toLocaleDateString(undefined, {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      });

      wireShell();

      try {
        const nudge = await window.Lighthouse.getActiveNudge();
        if (nudge) {
          $('#nudgeText').textContent = nudge.message;
          $('#nudgeBanner').hidden = false;
          $('#dismissNudgeBtn').onclick = async () => {
            try {
              await window.Lighthouse.dismissNudge(nudge.id);
              $('#nudgeBanner').hidden = true;
            } catch (err) {
              showToast(err.message || 'Could not dismiss.');
            }
          };
        }
      } catch (e) { /* care tables may not exist yet */ }

      metrics = null;
      rawMetrics = await window.Lighthouse.getDashboardMetrics();
      renderProgress(rawMetrics.progress);
      refreshAnalyticsView();

      const recent = await window.Lighthouse.listReflections({ limit: 5 });
      renderReflections(recent);

      // Side card text from real streak-ish active days
      const sideP = $('.side-card p');
      if (sideP) {
        sideP.textContent = rawMetrics.progress.completed === 4
          ? 'Today’s journey is complete. Come back tomorrow to keep the light on.'
          : `You’ve completed ${rawMetrics.progress.completed}/4 steps today. Continue when you’re ready.`;
      }

      if (window.Chart) {
        // charts already built in refreshAnalyticsView
      }
    } catch (err) {
      showToast((err && err.message) || 'Unable to load dashboard.');
    }
  })();
})();
