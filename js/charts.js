/**
 * ITPAS — Chart.js Dashboard Charts
 */

const Charts = {
  _instances: {},

  _destroy(id) {
    if (this._instances[id]) {
      this._instances[id].destroy();
      delete this._instances[id];
    }
  },

  // ── Doughnut: Overall Task Status Distribution ────────────────────────────
  renderStatusDoughnut(canvasId) {
    this._destroy(canvasId);
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const allAssignments = DB.Assignments.all();
    const counts = {
      Completed: allAssignments.filter(a => a.status === 'Completed').length,
      'Pending Review': allAssignments.filter(a => a.status === 'Pending Review').length,
      'In Progress': allAssignments.filter(a => a.status === 'In Progress').length,
      'Request Revision': allAssignments.filter(a => a.status === 'Request Revision').length,
    };

    this._instances[canvasId] = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: Object.keys(counts),
        datasets: [{
          data: Object.values(counts),
          backgroundColor: ['#10b981', '#6366f1', '#f59e0b', '#f43f5e'],
          borderWidth: 0,
          hoverOffset: 6,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: getComputedStyle(document.body).getPropertyValue('--text-primary').trim() || '#1e1b4b', font: { family: 'Inter', size: 12 }, padding: 16 },
          },
          tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${ctx.raw} tasks` } },
        },
        cutout: '65%',
      },
    });
  },

  // ── Bar: Intern Progress Comparison ──────────────────────────────────────
  renderInternProgressBar(canvasId) {
    this._destroy(canvasId);
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const interns = DB.Interns.allWithUsers().slice(0, 10);
    const labels = interns.map(i => i.user.name.split(' ')[0]);
    const completed = interns.map(i => Automation.getSummary(i.id).completed);
    const pending = interns.map(i => Automation.getSummary(i.id).pending);
    const inProgress = interns.map(i => Automation.getSummary(i.id).inProgress);

    this._instances[canvasId] = new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label: 'Completed', data: completed, backgroundColor: '#10b981', borderRadius: 6 },
          { label: 'Pending Review', data: pending, backgroundColor: '#6366f1', borderRadius: 6 },
          { label: 'In Progress', data: inProgress, backgroundColor: '#f59e0b', borderRadius: 6 },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { stacked: true, grid: { display: false }, ticks: { color: '#64748b', font: { family: 'Inter' } } },
          y: { stacked: true, max: 20, grid: { color: 'rgba(100,116,139,0.1)' }, ticks: { color: '#64748b', font: { family: 'Inter' } } },
        },
        plugins: {
          legend: { position: 'bottom', labels: { color: '#64748b', font: { family: 'Inter', size: 12 }, padding: 16 } },
        },
      },
    });
  },

  // ── Line: Submissions Over Time ────────────────────────────────────────
  renderSubmissionsLine(canvasId) {
    this._destroy(canvasId);
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const submissions = DB.Submissions.all();
    // Group by date (last 14 days)
    const days = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push(d.toISOString().split('T')[0]);
    }
    const counts = days.map(day =>
      submissions.filter(s => s.submittedAt && s.submittedAt.startsWith(day)).length
    );

    this._instances[canvasId] = new Chart(canvas, {
      type: 'line',
      data: {
        labels: days.map(d => Utils.formatDate(d)),
        datasets: [{
          label: 'Submissions',
          data: counts,
          borderColor: '#6366f1',
          backgroundColor: 'rgba(99,102,241,0.1)',
          borderWidth: 2,
          pointBackgroundColor: '#6366f1',
          pointRadius: 4,
          fill: true,
          tension: 0.4,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { grid: { display: false }, ticks: { color: '#64748b', font: { family: 'Inter', size: 10 }, maxRotation: 45 } },
          y: { beginAtZero: true, grid: { color: 'rgba(100,116,139,0.1)' }, ticks: { color: '#64748b', font: { family: 'Inter' }, stepSize: 1 } },
        },
        plugins: { legend: { display: false } },
      },
    });
  },

  // ── Radial: Single Intern Completion ──────────────────────────────────────
  renderCompletionGauge(canvasId, percentage) {
    this._destroy(canvasId);
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    this._instances[canvasId] = new Chart(canvas, {
      type: 'doughnut',
      data: {
        datasets: [{
          data: [percentage, 100 - percentage],
          backgroundColor: ['#6366f1', 'rgba(99,102,241,0.1)'],
          borderWidth: 0,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '80%',
        plugins: {
          legend: { display: false },
          tooltip: { enabled: false },
        },
      },
      plugins: [{
        id: 'centerText',
        beforeDraw(chart) {
          const { ctx, chartArea: { left, top, right, bottom } } = chart;
          const cx = (left + right) / 2, cy = (top + bottom) / 2;
          ctx.save();
          ctx.font = 'bold 24px Inter';
          ctx.fillStyle = '#6366f1';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(`${percentage}%`, cx, cy);
          ctx.restore();
        },
      }],
    });
  },
};

window.Charts = Charts;
