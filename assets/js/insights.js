(function () {
  'use strict';
  const { $, showToast, bootUserPage } = window.LighthouseShell;
  let charts = [];

  function lineChart(canvas, labels, values, color) {
    const filled = values.filter((v) => v != null);
    const wrap = canvas.parentElement;
    let empty = wrap.querySelector('.insight-empty');
    if (filled.length < 2) {
      canvas.style.display = 'none';
      if (!empty) { empty = document.createElement('div'); empty.className = 'insight-empty'; wrap.appendChild(empty); }
      empty.hidden = false;
      empty.textContent = 'Not enough data yet. Continue using Lighthouse to unlock personalized insights.';
      return null;
    }
    canvas.style.display = '';
    if (empty) empty.hidden = true;
    const ctx = canvas.getContext('2d');
    const c = new Chart(ctx, {
      type: 'line',
      data: { labels, datasets: [{ data: values, borderColor: color, backgroundColor: color + '33', fill: true, tension: 0.35, pointRadius: 0, spanGaps: true }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { ticks: { maxTicksLimit: 6, color: '#94a3b8' }, grid: { display: false } }, y: { grid: { color: 'rgba(148,163,184,.15)' }, ticks: { color: '#94a3b8' } } } },
    });
    charts.push(c);
    return c;
  }

  (async function init() {
    const session = await bootUserPage();
    if (!session) return;
    try {
      const data = await window.Lighthouse.getInsightsData();
      const w = data.weekly;
      $('#compareGrid').innerHTML = [
        ['Check-ins this week', w.checkinsThis, `Last week: ${w.checkinsLast}`],
        ['Reflections this week', w.reflectionsThis, `Last week: ${w.reflectionsLast}`],
        ['Avg sleep this week', w.sleepAvgThis != null ? w.sleepAvgThis + 'h' : '—', w.sleepAvgLast != null ? `Last week: ${w.sleepAvgLast}h` : 'Not enough data yet.'],
        ['Top visual theme', data.topVisual || '—', data.topVisual ? 'Most frequent selection' : 'Not enough data yet.'],
      ].map(([l, v, s]) => `<div class="compare-card"><div class="cc-label">${l}</div><div class="cc-val">${v}</div><div class="cc-sub">${s}</div></div>`).join('');

      $('#summaryChips').innerHTML = data.summaries.map((s) => `<div class="summary-chip">${window.Lighthouse.escapeHtml(s)}</div>`).join('');

      lineChart($('#sleepChart'), data.sleepSeries.map((x) => x.label), data.sleepSeries.map((x) => x.value), '#14B8A6');
      lineChart($('#moodChart'), data.moodSeries.map((x) => x.label), data.moodSeries.map((x) => x.value), '#3B82F6');
      lineChart($('#prodChart'), data.prodSeries.map((x) => x.label), data.prodSeries.map((x) => x.value), '#F59E0B');

      const fCanvas = $('#faceChart');
      const demoBtn = $('#demoFaceBtn');
      if (demoBtn) {
        demoBtn.addEventListener('click', async () => {
          demoBtn.disabled = true;
          try {
            await window.Lighthouse.generateDemoFaceData();
            window.location.reload();
          } catch (e) {
            demoBtn.disabled = false;
            showToast('Error generating demo data: ' + e.message);
          }
        });
      }

      const faceRows = (data.activityStats && data.activityStats.byType && data.activityStats.byType['face_check']) || [];
      const faceCounts = {};
      faceRows.forEach(r => {
        if (r.meta && r.meta.dominant) {
          faceCounts[r.meta.dominant] = (faceCounts[r.meta.dominant] || 0) + 1;
        }
      });
      const faceLabels = Object.keys(faceCounts);
      const faceValues = faceLabels.map(k => faceCounts[k]);
      
      if (!faceLabels.length) {
        if (fCanvas) {
          fCanvas.style.display = 'none';
          const wrap = fCanvas.parentElement;
          const empty = document.createElement('div');
          empty.className = 'insight-empty';
          empty.textContent = 'Not enough data yet. Complete daily face checks to unlock this insight.';
          wrap.appendChild(empty);
        }
      } else {
        if (demoBtn) demoBtn.style.display = 'none';
        if (fCanvas) {
          const prettyFaces = faceLabels.map(l => l.charAt(0).toUpperCase() + l.slice(1));
          const colors = ['#8b5cf6', '#3B82F6', '#14B8A6', '#F59E0B', '#fb7185', '#22d3ee', '#64748b', '#475569'];
          charts.push(new Chart(fCanvas.getContext('2d'), {
            type: 'doughnut',
            data: { labels: prettyFaces, datasets: [{ data: faceValues, backgroundColor: colors, borderWidth: 0 }] },
            options: { responsive: true, maintainAspectRatio: false, cutout: '68%', plugins: { legend: { display: false } } },
          }));
          $('#faceLegend').innerHTML = prettyFaces.map((p, i) => `<span class="lg"><i style="background:${colors[i % colors.length]}"></i>${p}</span>`).join('');
        }
      }

      const labels = Object.keys(data.visualCounts);
      const values = labels.map((k) => data.visualCounts[k]);
      const vCanvas = $('#visualChart');
      if (!labels.length) {
        vCanvas.style.display = 'none';
        const wrap = vCanvas.parentElement;
        const empty = document.createElement('div');
        empty.className = 'insight-empty';
        empty.textContent = 'Not enough data yet. Continue using Lighthouse to unlock personalized insights.';
        wrap.appendChild(empty);
      } else {
        const meta = window.Lighthouse.VISUAL_OPTIONS;
        const pretty = labels.map((id) => (meta.find((m) => m.id === id) || { title: id }).title);
        charts.push(new Chart(vCanvas.getContext('2d'), {
          type: 'doughnut',
          data: { labels: pretty, datasets: [{ data: values, backgroundColor: ['#14B8A6', '#3B82F6', '#F59E0B', '#8b5cf6', '#fb7185', '#22d3ee', '#64748b', '#475569'], borderWidth: 0 }] },
          options: { responsive: true, maintainAspectRatio: false, cutout: '68%', plugins: { legend: { display: false } } },
        }));
        $('#visualLegend').innerHTML = pretty.map((p, i) => `<span class="lg"><i style="background:${['#14B8A6', '#3B82F6', '#F59E0B', '#8b5cf6', '#fb7185', '#22d3ee', '#64748b', '#475569'][i]}"></i>${p}</span>`).join('');
      }

      const freqs = [
        ['Reflection Frequency', data.reflectionCount, Math.min(100, data.reflectionCount * 8)],
        ['Scenario Completion', data.scenarioCount, Math.min(100, data.scenarioCount * 4)],
        ['Check-in Activity', data.checkinCount, Math.min(100, data.checkinCount * 5)],
        ['Visual Reflections', data.visualCount, Math.min(100, data.visualCount * 8)],
        ['Behavioral Activities', (data.activityStats && data.activityStats.totalCompleted) || 0, Math.min(100, ((data.activityStats && data.activityStats.totalCompleted) || 0) * 10)],
        ['Physical Activity Trend', data.activitySeries.filter((x) => x.value).length, Math.min(100, data.activitySeries.filter((x) => x.value).length * 5)],
      ];
      $('#freqGrid').innerHTML = freqs.map(([title, val, pct]) => `
        <div class="behavior"><div class="b-top"><span class="b-title">${title}</span></div>
        <div class="b-val">${val}<small> total</small></div>
        <div class="progress"><i style="width:${pct}%"></i></div>
        <div class="b-foot">${val ? 'Based on your history' : 'Complete more activities to unlock this insight.'}</div></div>`).join('');

      const act = data.activityStats || {};
      const compareExtra = [
        ['Behavioral activities', act.totalCompleted || 0, act.enough ? `Streak: ${act.streak || 0} day(s)` : 'Complete more activities to unlock this insight.'],
        ['Memory accuracy', act.memoryAvgAccuracy != null ? `${act.memoryAvgAccuracy}%` : '—', act.memoryAvgAccuracy != null ? 'Average recall accuracy' : 'Complete more activities to unlock this insight.'],
        ['Reaction speed', act.reactionAvgMs != null ? `${act.reactionAvgMs} ms` : '—', act.reactionAvgMs != null ? 'Average best times' : 'Complete more activities to unlock this insight.'],
        ['Click Accuracy', act.clickAccuracyAvg != null ? `${act.clickAccuracyAvg}%` : '—', act.clickAccuracyAvg != null ? 'Average precision' : 'Complete more activities to unlock this insight.'],
      ];
      $('#compareGrid').innerHTML += compareExtra.map(([l, v, s]) => `<div class="compare-card"><div class="cc-label">${l}</div><div class="cc-val">${v}</div><div class="cc-sub">${s}</div></div>`).join('');
    } catch (err) {
      showToast((err && err.message) || 'Could not load insights. Run schema_platform.sql if needed.');
    }
  })();
})();
