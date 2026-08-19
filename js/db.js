/**
 * ITPAS — API-backed Database Layer
 * Maintains an in-memory cache synced with the backend API.
 */

const _cache = {
  users: [],
  interns: [],
  tasks: [],
  assignments: [],
  submissions: [],
  feedback: [],
  dailyReports: [],
  notifications: [],
  loaded: false,
};

function _applyBootstrap(data) {
  _cache.users = data.users || [];
  _cache.interns = data.interns || [];
  _cache.tasks = data.tasks || [];
  _cache.assignments = data.assignments || [];
  _cache.submissions = data.submissions || [];
  _cache.feedback = data.feedback || [];
  _cache.dailyReports = data.dailyReports || [];
  _cache.notifications = data.notifications || [];
  _cache.loaded = true;
}

// ─── Users ────────────────────────────────────────────────────────────────────

const Users = {
  all() { return _cache.users; },
  find(id) { return this.all().find((u) => u.id === id) || null; },
  findByEmail(email) {
    return this.all().find((u) => u.email.toLowerCase() === email.toLowerCase()) || null;
  },
  findByUsername(username) {
    return this.findByEmail(username);
  },

  async update(id, data) {
    const updated = await API.updateUser(id, {
      name: data.name,
      email: data.email,
      phone: data.phone,
      photo: data.photo,
      password: data.password,
    });
    _cache.users = _cache.users.map((u) => (u.id === id ? updated : u));
    return updated;
  },
};

// ─── Interns ──────────────────────────────────────────────────────────────────

const Interns = {
  all() { return _cache.interns; },
  find(id) { return this.all().find((i) => i.id === id) || null; },
  findByUserId(userId) { return this.all().find((i) => i.userId === userId) || null; },

  async create(data) {
    const result = await API.createIntern({
      name: data.name,
      email: data.email,
      password: data.password,
      phone: data.phone,
      photo: data.photo,
      university: data.university,
      course: data.course,
      startDate: data.startDate,
      endDate: data.endDate,
    });
    await DB.reload();
    return result.intern;
  },

  async update(id, data) {
    const updated = await API.updateIntern(id, data);
    _cache.interns = _cache.interns.map((i) => (i.id === id ? updated : i));
    return updated;
  },

  allWithUsers() {
    return this.all().map((intern) => {
      const user = Users.find(intern.userId);
      return { ...intern, user };
    }).filter((i) => i.user);
  },
};

// ─── Tasks ────────────────────────────────────────────────────────────────────

const Tasks = {
  all() { return [..._cache.tasks].sort((a, b) => a.order - b.order); },
  find(id) { return _cache.tasks.find((t) => t.id === id) || null; },
  findByNumber(num) { return _cache.tasks.find((t) => t.taskNumber === num) || null; },

  async create(data) {
    const task = await API.createTask({
      taskNumber: data.taskNumber,
      title: data.title,
      description: data.description,
      due: data.due || data.dueDays || 7,
    });
    _cache.tasks.push(task);
    return task;
  },

  async update(id, data) {
    const task = await API.updateTask(id, {
      taskNumber: data.taskNumber ?? data.order,
      title: data.title,
      description: data.description,
      due: data.due ?? data.dueDays ?? 7,
    });
    _cache.tasks = _cache.tasks.map((t) => (t.id === id ? task : t));
    return task;
  },

  async delete(id) {
    await API.deleteTask(id);
    _cache.tasks = _cache.tasks.filter((t) => t.id !== id);
  },

  async reorder(orderedIds) {
    const tasks = await API.reorderTasks(orderedIds);
    _cache.tasks = tasks;
  },
};

// ─── Assignments ──────────────────────────────────────────────────────────────

const Assignments = {
  all() { return _cache.assignments; },
  find(id) { return this.all().find((a) => a.id === id) || null; },
  forIntern(internId) { return this.all().filter((a) => a.internId === internId); },
  findByInternAndTask(internId, taskId) {
    return this.all().find((a) => a.internId === internId && a.taskId === taskId) || null;
  },

  update(id, data) {
    const assignment = this.find(id);
    if (assignment) Object.assign(assignment, data);
    return assignment;
  },
};

// ─── Submissions ──────────────────────────────────────────────────────────────

const Submissions = {
  all() { return _cache.submissions; },
  find(id) { return this.all().find((s) => s.id === id) || null; },
  forIntern(internId) { return this.all().filter((s) => s.internId === internId); },
  forAssignment(assignmentId) { return this.all().filter((s) => s.assignmentId === assignmentId); },
  latestForAssignment(assignmentId) {
    const subs = this.forAssignment(assignmentId);
    return subs.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt))[0] || null;
  },
  pending() { return this.all().filter((s) => s.status === 'Pending Review'); },

  async create(data) {
    const formData = new FormData();
    formData.append('assignmentId', data.assignmentId);
    formData.append('internId', data.internId);
    formData.append('freeText', data.freeText || '');

    if (data.fileBlob) {
      formData.append('file', data.fileBlob, data.fileName);
    }

    const submission = await API.createSubmission(formData);
    _cache.submissions.unshift(submission);

    const assignment = Assignments.find(data.assignmentId);
    if (assignment) assignment.status = 'Pending Review';

    await DB.reloadAssignmentsAndSubmissions();
    return submission;
  },

  update(id, data) {
    const sub = this.find(id);
    if (sub) Object.assign(sub, data);
    return sub;
  },
};

// ─── Feedback (Reviews) ─────────────────────────────────────────────────────

const Feedback = {
  all() { return _cache.feedback; },
  find(id) { return this.all().find((f) => f.id === id) || null; },
  forSubmission(submissionId) { return this.all().filter((f) => f.submissionId === submissionId); },
  latestForSubmission(submissionId) {
    const fb = this.forSubmission(submissionId);
    return fb.sort((a, b) => new Date(b.reviewedAt) - new Date(a.reviewedAt))[0] || null;
  },

  async create(data) {
    const review = await API.createReview({
      submissionId: data.submissionId,
      internId: data.internId,
      status: data.status,
      comments: data.comments,
    });
    _cache.feedback.unshift(review);
    await DB.reloadAssignmentsAndSubmissions();
    return review;
  },
};

// ─── Daily Reports ────────────────────────────────────────────────────────────

const DailyReports = {
  all() { return _cache.dailyReports; },
  find(id) { return this.all().find((r) => r.id === id) || null; },
  forIntern(internId) { return this.all().filter((r) => r.internId === internId); },

  async create(data) {
    const report = await API.createDailyReport({
      internId: data.internId,
      date: data.date,
      tasksAssigned: data.tasksAssigned,
      activities: data.activities,
      responsibilities: data.responsibilities,
      gained: data.gained,
      improvement: data.improvement,
      problemsFaced: data.problemsFaced,
      additionalQuestions: data.additionalQuestions,
    });
    _cache.dailyReports.unshift(report);
    return report;
  },
};

// ─── Notifications ────────────────────────────────────────────────────────────

const Notifications = {
  all() { return _cache.notifications; },
  forUser(userId) {
    return this.all()
      .filter((n) => n.userId === userId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },
  unreadCount(userId) { return this.forUser(userId).filter((n) => !n.read).length; },

  async markRead(id) {
    await API.markNotificationRead(id);
    _cache.notifications = _cache.notifications.map((n) =>
      n.id === id ? { ...n, read: true } : n
    );
  },

  async markAllRead(userId) {
    await API.markAllNotificationsRead();
    _cache.notifications = _cache.notifications.map((n) =>
      n.userId === userId ? { ...n, read: true } : n
    );
  },
};

// ─── Init / Reload ────────────────────────────────────────────────────────────

async function init() {
  if (!API.getToken()) return;
  const data = await API.bootstrap();
  _applyBootstrap(data);
}

async function reload() {
  const data = await API.bootstrap();
  _applyBootstrap(data);
}

async function reloadAssignmentsAndSubmissions() {
  const data = await API.bootstrap();
  _cache.assignments = data.assignments || [];
  _cache.submissions = data.submissions || [];
  _cache.feedback = data.feedback || [];
  _cache.notifications = data.notifications || [];
}

window.DB = {
  Users,
  Interns,
  Tasks,
  Assignments,
  Submissions,
  Feedback,
  DailyReports,
  Notifications,
  init,
  reload,
  reloadAssignmentsAndSubmissions,
  isLoaded: () => _cache.loaded,
};
