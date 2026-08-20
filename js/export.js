/**
 * ITPAS — Export Utilities
 * PDF: jsPDF (loaded from CDN)
 * Excel: SheetJS / xlsx (loaded from CDN)
 */

const Exporter = {
  // ── PDF Export ────────────────────────────────────────────────────────────

  exportProgressPDF(internId) {
    const intern = DB.Interns.find(internId);
    if (!intern) return;
    const user = DB.Users.find(intern.userId);
    if (!user) return;

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    const summary = Automation.getSummary(internId);
    const assignments = DB.Assignments.forIntern(internId);

    // Header
    doc.setFillColor(99, 102, 241);
    doc.rect(0, 0, 210, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('InternSpect — Internship Progress Report', 15, 18);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text(`Generated: ${Utils.formatDateTime(new Date().toISOString())}`, 15, 30);

    // Intern Info
    doc.setTextColor(30, 30, 60);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Intern Information', 15, 55);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    const info = [
      ['Name', user.name],
      ['Email', user.email],
      ['University', intern.university],
      ['Course', intern.course],
      ['Internship Period', `${Utils.formatDate(intern.startDate)} — ${Utils.formatDate(intern.endDate)}`],
    ];
    info.forEach(([label, value], i) => {
      doc.setFont('helvetica', 'bold');
      doc.text(`${label}:`, 15, 65 + i * 8);
      doc.setFont('helvetica', 'normal');
      doc.text(value || '—', 60, 65 + i * 8);
    });

    // Summary Stats
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('Progress Summary', 15, 115);
    doc.setFontSize(11);
    const stats = [
      ['Completed Tasks', `${summary.completed} / 20`],
      ['Pending Review', `${summary.pending}`],
      ['In Progress', `${summary.inProgress}`],
      ['Revision Requested', `${summary.revision}`],
      ['Remaining Tasks', `${summary.remaining}`],
      ['Completion', `${Automation.getCompletionPercentage(internId)}%`],
    ];
    stats.forEach(([label, value], i) => {
      doc.setFont('helvetica', 'bold');
      doc.text(`${label}:`, 15, 125 + i * 8);
      doc.setFont('helvetica', 'normal');
      doc.text(value, 75, 125 + i * 8);
    });

    // Task List
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('Task Details', 15, 185);

    let y = 195;
    doc.setFontSize(9);
    // Table header
    doc.setFillColor(240, 240, 255);
    doc.rect(15, y - 5, 180, 8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.text('Task #', 17, y);
    doc.text('Title', 40, y);
    doc.text('Status', 155, y);
    y += 6;

    assignments.sort((a, b) => a.taskNumber - b.taskNumber).forEach(a => {
      if (y > 275) { doc.addPage(); y = 20; }
      const task = DB.Tasks.findByNumber(a.taskNumber);
      doc.setFont('helvetica', 'normal');
      doc.text(`Task ${a.taskNumber}`, 17, y);
      doc.text(task ? task.title.substring(0, 35) : '—', 40, y);
      doc.text(a.status, 155, y);
      y += 7;
      // Thin line
      doc.setDrawColor(220, 220, 240);
      doc.line(15, y - 3, 195, y - 3);
    });

    // Footer
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text('InternSpect — Intern Task Progression Automation System', 15, 290);

    doc.save(`InternSpect_Progress_${user.name.replace(/\s+/g, '_')}.pdf`);
    Utils.toast('Progress report downloaded as PDF!', 'success');
  },

  // ── Excel Export ──────────────────────────────────────────────────────────

  exportAllInternsExcel() {
    if (typeof XLSX === 'undefined') {
      Utils.toast('Excel export library not loaded.', 'error');
      return;
    }

    const interns = DB.Interns.allWithUsers();
    const rows = [['Name', 'Email', 'University', 'Course', 'Start Date', 'End Date', 'Completed', 'Pending Review', 'In Progress', 'Remaining', 'Completion %']];

    interns.forEach(intern => {
      const summary = Automation.getSummary(intern.id);
      rows.push([
        intern.user.name,
        intern.user.email,
        intern.university,
        intern.course,
        intern.startDate,
        intern.endDate,
        summary.completed,
        summary.pending,
        summary.inProgress,
        summary.remaining,
        `${Automation.getCompletionPercentage(intern.id)}%`,
      ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = rows[0].map(() => ({ wch: 22 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Intern Progress');
    XLSX.writeFile(wb, `InternSpect_AllInterns_${Utils.today()}.xlsx`);
    Utils.toast('Excel report downloaded!', 'success');
  },

  exportInternTasksExcel(internId) {
    if (typeof XLSX === 'undefined') {
      Utils.toast('Excel export library not loaded.', 'error');
      return;
    }

    const intern = DB.Interns.find(internId);
    if (!intern) return;
    const user = DB.Users.find(intern.userId);
    const assignments = DB.Assignments.forIntern(internId);

    const rows = [['Task #', 'Title', 'Status', 'Unlocked At']];
    assignments.sort((a, b) => a.taskNumber - b.taskNumber).forEach(a => {
      const task = DB.Tasks.findByNumber(a.taskNumber);
      rows.push([
        `Task ${a.taskNumber}`,
        task ? task.title : '—',
        a.status,
        Utils.formatDateTime(a.unlockedAt),
      ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 10 }, { wch: 40 }, { wch: 20 }, { wch: 22 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Tasks');
    XLSX.writeFile(wb, `InternSpect_${(user?.name || 'Intern').replace(/\s+/g,'_')}_Tasks.xlsx`);
    Utils.toast('Task report downloaded!', 'success');
  },
};

window.Exporter = Exporter;
