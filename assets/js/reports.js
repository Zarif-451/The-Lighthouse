(function () {
  'use strict';
  const { $, $$, showToast, bootUserPage } = window.LighthouseShell;
  const params = new URLSearchParams(window.location.search || '');
  let period = params.get('period') === 'monthly' ? 'monthly' : 'weekly';
  let currentReport = null;

  function render(report) {
    currentReport = report;
    $('#reportTitle').textContent = `${report.period} Report`;
    $('#reportRange').textContent = `${report.start} → ${report.end}`;
    const cards = [
      ['Reflection Count', report.reflectionCount],
      ['Daily Check-ins', report.checkinCount],
      ['Avg Sleep', report.sleepAvg != null ? report.sleepAvg + 'h' : '—'],
      ['Avg Mood', report.moodAvg != null ? report.moodAvg + '/5' : '—'],
      ['Avg Productivity', report.prodAvg != null ? report.prodAvg + '/5' : '—'],
      ['Scenario Completion', report.scenarioCount],
      ['Visual Reflections', report.visualCount],
      ['Overall Engagement', report.enough ? report.engagement + '%' : '—'],
    ];
    $('#reportCards').innerHTML = cards.map(([l, v]) => `
      <div class="compare-card"><div class="cc-label">${l}</div><div class="cc-val">${v}</div>
      <div class="cc-sub">${report.enough ? 'From your activity' : report.insufficientMessage}</div></div>`).join('');

    const act = report.activityDist || {};
    const bars = [
      ['Physical Activity — None', act.None || 0],
      ['Physical Activity — Light', act.Light || 0],
      ['Physical Activity — Moderate', act.Moderate || 0],
      ['Physical Activity — High', act.High || 0],
      ['Engagement Score', report.enough ? report.engagement : 0],
    ];
    const max = Math.max(1, ...bars.map((b) => b[1]));
    $('#reportBars').innerHTML = bars.map(([title, val]) => `
      <div class="behavior"><div class="b-title">${title}</div>
      <div class="b-val">${val}</div>
      <div class="progress"><i style="width:${Math.round((val / max) * 100)}%"></i></div>
      <div class="b-foot">${report.enough ? 'Summary' : report.unlockMessage}</div></div>`).join('');
  }

  function syncPeriodToggle() {
    $$('#periodToggle button').forEach((b) => {
      b.classList.toggle('active', b.dataset.period === period);
    });
  }

  async function load() {
    const report = await window.Lighthouse.getReport(period);
    render(report);
  }

  function exportPdf() {
    if (!currentReport) {
      showToast('Load a report first.');
      return;
    }
    const jsPDF = window.jspdf && window.jspdf.jsPDF;
    if (!jsPDF) {
      showToast('PDF library failed to load. Check your connection and try again.');
      return;
    }

    const report = currentReport;
    const userName = ($('#userName') && $('#userName').textContent) || 'Lighthouse User';
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const margin = 48;
    let y = 56;

    doc.setFillColor(30, 58, 138);
    doc.rect(0, 0, pageW, 72, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.text('Lighthouse', margin, 34);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.text(`${report.period} Wellbeing Report`, margin, 54);

    y = 100;
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(`${report.period} Report`, margin, y);
    y += 18;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);
    doc.text(`Prepared for: ${userName}`, margin, y);
    y += 14;
    doc.text(`Period: ${report.start} → ${report.end}`, margin, y);
    y += 14;
    doc.text(`Generated: ${new Date().toLocaleString()}`, margin, y);
    y += 28;

    doc.setDrawColor(226, 232, 240);
    doc.line(margin, y, pageW - margin, y);
    y += 24;

    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('Summary Metrics', margin, y);
    y += 18;

    const rows = [
      ['Reflection Count', String(report.reflectionCount)],
      ['Daily Check-ins', String(report.checkinCount)],
      ['Avg Sleep', report.sleepAvg != null ? `${report.sleepAvg}h` : '—'],
      ['Avg Mood', report.moodAvg != null ? `${report.moodAvg}/5` : '—'],
      ['Avg Productivity', report.prodAvg != null ? `${report.prodAvg}/5` : '—'],
      ['Scenario Completion', String(report.scenarioCount)],
      ['Visual Reflections', String(report.visualCount)],
      ['Overall Engagement', report.enough ? `${report.engagement}%` : 'Not enough data yet'],
    ];

    doc.setFontSize(10);
    rows.forEach(([label, value]) => {
      if (y > 740) {
        doc.addPage();
        y = 56;
      }
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      doc.text(label, margin, y);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(String(value), pageW - margin, y, { align: 'right' });
      y += 18;
    });

    y += 10;
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, y, pageW - margin, y);
    y += 24;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text('Physical Activity Breakdown', margin, y);
    y += 18;

    const act = report.activityDist || {};
    const activityRows = [
      ['None', act.None || 0],
      ['Light', act.Light || 0],
      ['Moderate', act.Moderate || 0],
      ['High', act.High || 0],
    ];
    doc.setFontSize(10);
    activityRows.forEach(([label, value]) => {
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      doc.text(label, margin, y);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(String(value), pageW - margin, y, { align: 'right' });
      y += 18;
    });

    y += 28;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    const note = report.enough
      ? 'This report is generated from your private Lighthouse activity. It is for personal reflection only and is not medical advice.'
      : 'Not enough historical data yet for a full engagement summary. Keep checking in to unlock richer reports.';
    const wrapped = doc.splitTextToSize(note, pageW - margin * 2);
    doc.text(wrapped, margin, y);

    const filename = `lighthouse-${report.period.toLowerCase()}-report-${report.end}.pdf`;
    doc.save(filename);
    showToast('PDF downloaded.');
  }

  (async function init() {
    if (!(await bootUserPage())) return;
    syncPeriodToggle();
    $('#periodToggle').addEventListener('click', async (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      period = btn.dataset.period;
      syncPeriodToggle();
      const url = new URL(window.location.href);
      url.searchParams.set('period', period);
      history.replaceState(null, '', url.pathname + url.search + url.hash);
      try { await load(); } catch (err) { showToast(err.message || 'Failed to load report'); }
    });
    $('#printBtn').addEventListener('click', () => window.print());
    $('#exportBtn').addEventListener('click', () => {
      try {
        exportPdf();
      } catch (err) {
        showToast(err.message || 'PDF export failed.');
      }
    });
    try {
      await load();
      if (window.location.hash === '#engagement') {
        const bars = $('#reportBars');
        if (bars) bars.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    } catch (err) { showToast(err.message || 'Failed to load report'); }
  })();
})();
