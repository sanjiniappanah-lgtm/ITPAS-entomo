/**
 * ITPAS — LocalStorage Database Layer
 * Simulates a relational database using browser LocalStorage.
 * All data is stored as JSON under prefixed keys.
 */

const DB_KEYS = {
  USERS: 'itpas_users',
  INTERNS: 'itpas_interns',
  TASKS: 'itpas_tasks',
  ASSIGNMENTS: 'itpas_assignments',
  SUBMISSIONS: 'itpas_submissions',
  FEEDBACK: 'itpas_feedback',
  DAILY_REPORTS: 'itpas_daily_reports',
  NOTIFICATIONS: 'itpas_notifications',
  SEEDED: 'itpas_seeded',
};

// ─── Generic Helpers ──────────────────────────────────────────────────────────

function _get(key) {
  try {
    return JSON.parse(localStorage.getItem(key)) || [];
  } catch { return []; }
}

function _set(key, data) {
  localStorage.setItem(key, JSON.stringify(data));
}

function _genId() {
  return '_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
}

function _hash(str) {
  // Simple deterministic obfuscation for demo (not production-grade)
  return btoa(unescape(encodeURIComponent(str + '__itpas__salt')));
}

// ─── Users ────────────────────────────────────────────────────────────────────

const Users = {
  all() { return _get(DB_KEYS.USERS); },
  find(id) { return this.all().find(u => u.id === id) || null; },
  findByEmail(email) { return this.all().find(u => u.email.toLowerCase() === email.toLowerCase()) || null; },
  findByUsername(username) { return this.all().find(u => u.username && u.username.toLowerCase() === username.toLowerCase()) || null; },

  create(data) {
    const users = this.all();
    const user = {
      id: _genId(),
      role: data.role || 'intern',
      username: data.username || '',
      email: data.email,
      passwordHash: _hash(data.password),
      name: data.name,
      phone: data.phone || '',
      photo: data.photo || '',
      createdAt: new Date().toISOString(),
    };
    users.push(user);
    _set(DB_KEYS.USERS, users);
    return user;
  },

  update(id, data) {
    const users = this.all().map(u => {
      if (u.id !== id) return u;
      const updated = { ...u, ...data };
      if (data.password) updated.passwordHash = _hash(data.password);
      delete updated.password;
      return updated;
    });
    _set(DB_KEYS.USERS, users);
    return this.find(id);
  },

  delete(id) {
    _set(DB_KEYS.USERS, this.all().filter(u => u.id !== id));
  },

  authenticate(identifier, password) {
    const hash = _hash(password);
    return this.all().find(u =>
      (u.email.toLowerCase() === identifier.toLowerCase() ||
       (u.username && u.username.toLowerCase() === identifier.toLowerCase())) &&
      u.passwordHash === hash
    ) || null;
  },
};

// ─── Interns ──────────────────────────────────────────────────────────────────

const Interns = {
  all() { return _get(DB_KEYS.INTERNS); },
  find(id) { return this.all().find(i => i.id === id) || null; },
  findByUserId(userId) { return this.all().find(i => i.userId === userId) || null; },

  create(data) {
    const interns = this.all();
    const intern = {
      id: _genId(),
      userId: data.userId,
      university: data.university || '',
      course: data.course || '',
      startDate: data.startDate || '',
      endDate: data.endDate || '',
      createdAt: new Date().toISOString(),
    };
    interns.push(intern);
    _set(DB_KEYS.INTERNS, interns);
    return intern;
  },

  update(id, data) {
    const interns = this.all().map(i => i.id === id ? { ...i, ...data } : i);
    _set(DB_KEYS.INTERNS, interns);
    return this.find(id);
  },

  delete(id) {
    _set(DB_KEYS.INTERNS, this.all().filter(i => i.id !== id));
  },

  // Returns enriched intern object with user data
  allWithUsers() {
    return this.all().map(intern => {
      const user = Users.find(intern.userId);
      return { ...intern, user };
    }).filter(i => i.user);
  },
};

// ─── Tasks ────────────────────────────────────────────────────────────────────

const Tasks = {
  all() { return _get(DB_KEYS.TASKS).sort((a, b) => a.order - b.order); },
  find(id) { return this.all().find(t => t.id === id) || null; },
  findByNumber(num) { return this.all().find(t => t.taskNumber === num) || null; },

  create(data) {
    const tasks = _get(DB_KEYS.TASKS);
    const task = {
      id: _genId(),
      taskNumber: data.taskNumber,
      title: data.title,
      description: data.description || '',
      dueDate: data.dueDate || '',
      attachment: data.attachment || null,
      order: data.order ?? data.taskNumber,
      createdAt: new Date().toISOString(),
    };
    tasks.push(task);
    _set(DB_KEYS.TASKS, tasks);
    return task;
  },

  update(id, data) {
    const tasks = _get(DB_KEYS.TASKS).map(t => t.id === id ? { ...t, ...data } : t);
    _set(DB_KEYS.TASKS, tasks);
    return this.find(id);
  },

  delete(id) {
    _set(DB_KEYS.TASKS, _get(DB_KEYS.TASKS).filter(t => t.id !== id));
  },

  reorder(orderedIds) {
    const tasks = _get(DB_KEYS.TASKS).map(t => {
      const idx = orderedIds.indexOf(t.id);
      return { ...t, order: idx !== -1 ? idx : t.order };
    });
    _set(DB_KEYS.TASKS, tasks);
  },
};

// ─── Assignments ──────────────────────────────────────────────────────────────

const Assignments = {
  all() { return _get(DB_KEYS.ASSIGNMENTS); },
  find(id) { return this.all().find(a => a.id === id) || null; },
  forIntern(internId) { return this.all().filter(a => a.internId === internId); },
  findByInternAndTask(internId, taskId) {
    return this.all().find(a => a.internId === internId && a.taskId === taskId) || null;
  },

  create(data) {
    const assignments = this.all();
    const assignment = {
      id: _genId(),
      internId: data.internId,
      taskId: data.taskId,
      taskNumber: data.taskNumber,
      status: data.status || 'In Progress',
      unlockedAt: new Date().toISOString(),
    };
    assignments.push(assignment);
    _set(DB_KEYS.ASSIGNMENTS, assignments);
    return assignment;
  },

  update(id, data) {
    const assignments = this.all().map(a => a.id === id ? { ...a, ...data } : a);
    _set(DB_KEYS.ASSIGNMENTS, assignments);
    return this.find(id);
  },

  delete(id) {
    _set(DB_KEYS.ASSIGNMENTS, this.all().filter(a => a.id !== id));
  },
};

// ─── Submissions ──────────────────────────────────────────────────────────────

const Submissions = {
  all() { return _get(DB_KEYS.SUBMISSIONS); },
  find(id) { return this.all().find(s => s.id === id) || null; },
  forIntern(internId) { return this.all().filter(s => s.internId === internId); },
  forAssignment(assignmentId) { return this.all().filter(s => s.assignmentId === assignmentId); },
  latestForAssignment(assignmentId) {
    const subs = this.forAssignment(assignmentId);
    return subs.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt))[0] || null;
  },
  pending() { return this.all().filter(s => s.status === 'Pending Review'); },

  create(data) {
    const submissions = this.all();
    const submission = {
      id: _genId(),
      assignmentId: data.assignmentId,
      internId: data.internId,
      taskId: data.taskId,
      taskNumber: data.taskNumber,
      fileData: data.fileData || null,
      fileName: data.fileName || '',
      fileType: data.fileType || '',
      freeText: data.freeText || '',
      status: 'Pending Review',
      submittedAt: new Date().toISOString(),
    };
    submissions.push(submission);
    _set(DB_KEYS.SUBMISSIONS, submissions);
    return submission;
  },

  update(id, data) {
    const submissions = this.all().map(s => s.id === id ? { ...s, ...data } : s);
    _set(DB_KEYS.SUBMISSIONS, submissions);
    return this.find(id);
  },
};

// ─── Feedback ─────────────────────────────────────────────────────────────────

const Feedback = {
  all() { return _get(DB_KEYS.FEEDBACK); },
  find(id) { return this.all().find(f => f.id === id) || null; },
  forSubmission(submissionId) { return this.all().filter(f => f.submissionId === submissionId); },
  latestForSubmission(submissionId) {
    const fb = this.forSubmission(submissionId);
    return fb.sort((a, b) => new Date(b.reviewedAt) - new Date(a.reviewedAt))[0] || null;
  },

  create(data) {
    const feedbacks = this.all();
    const feedback = {
      id: _genId(),
      submissionId: data.submissionId,
      managerId: data.managerId,
      comments: data.comments || '',
      status: data.status, // 'Completed' | 'Request Revision'
      reviewedAt: new Date().toISOString(),
    };
    feedbacks.push(feedback);
    _set(DB_KEYS.FEEDBACK, feedbacks);
    return feedback;
  },
};

// ─── Daily Reports ────────────────────────────────────────────────────────────

const DailyReports = {
  all() { return _get(DB_KEYS.DAILY_REPORTS); },
  find(id) { return this.all().find(r => r.id === id) || null; },
  forIntern(internId) { return this.all().filter(r => r.internId === internId); },

  create(data) {
    const reports = this.all();
    const report = {
      id: _genId(),
      internId: data.internId,
      date: data.date || new Date().toISOString().split('T')[0],
      tasksAssigned: data.tasksAssigned || '',
      activities: data.activities || '',
      responsibilities: data.responsibilities || '',
      gained: data.gained || '',
      improvement: data.improvement || '',
      problemsFaced: data.problemsFaced || '',
      additionalQuestions: data.additionalQuestions || '',
      submittedAt: new Date().toISOString(),
    };
    reports.push(report);
    _set(DB_KEYS.DAILY_REPORTS, reports);
    return report;
  },

  update(id, data) {
    const reports = this.all().map(r => r.id === id ? { ...r, ...data } : r);
    _set(DB_KEYS.DAILY_REPORTS, reports);
    return this.find(id);
  },
};

// ─── Notifications ────────────────────────────────────────────────────────────

const Notifications = {
  all() { return _get(DB_KEYS.NOTIFICATIONS); },
  forUser(userId) {
    return this.all()
      .filter(n => n.userId === userId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },
  unreadCount(userId) { return this.forUser(userId).filter(n => !n.read).length; },

  create(data) {
    const notifications = this.all();
    const notification = {
      id: _genId(),
      userId: data.userId,
      message: data.message,
      type: data.type || 'info', // 'info' | 'success' | 'warning' | 'danger'
      link: data.link || '',
      read: false,
      createdAt: new Date().toISOString(),
    };
    notifications.push(notification);
    _set(DB_KEYS.NOTIFICATIONS, notifications);
    return notification;
  },

  markRead(id) {
    const notifications = this.all().map(n => n.id === id ? { ...n, read: true } : n);
    _set(DB_KEYS.NOTIFICATIONS, notifications);
  },

  markAllRead(userId) {
    const notifications = this.all().map(n =>
      n.userId === userId ? { ...n, read: true } : n
    );
    _set(DB_KEYS.NOTIFICATIONS, notifications);
  },
};

// ─── Seed Data ────────────────────────────────────────────────────────────────

const SEED_TASKS = [
  { taskNumber: 1,  title: 'Orientation & Onboarding',          description: 'Complete the company orientation, review the internship handbook, and set up your workspace accounts.' },
  { taskNumber: 2,  title: 'Environment Setup',                  description: 'Install required software tools, configure your development environment, and verify all tools are working.' },
  { taskNumber: 3,  title: 'HTML & CSS Fundamentals',            description: 'Study HTML5 semantic elements and CSS3 styling. Build a simple static webpage.' },
  { taskNumber: 4,  title: 'JavaScript Basics',                  description: 'Learn JavaScript fundamentals: variables, loops, functions, DOM manipulation.' },
  { taskNumber: 5,  title: 'Version Control with Git',           description: 'Learn Git commands: init, add, commit, push, pull, branch. Push your work to a remote repository.' },
  { taskNumber: 6,  title: 'Responsive Web Design',              description: 'Study media queries and responsive layouts. Make your webpage mobile-friendly.' },
  { taskNumber: 7,  title: 'Introduction to Databases',          description: 'Understand relational databases, SQL basics, and design a simple schema for a given problem.' },
  { taskNumber: 8,  title: 'Backend Fundamentals',               description: 'Learn server-side concepts. Set up a basic REST API using your assigned backend technology.' },
  { taskNumber: 9,  title: 'API Integration',                    description: 'Connect your frontend to the backend API. Fetch data and display it dynamically.' },
  { taskNumber: 10, title: 'User Authentication',                description: 'Implement login and registration with session/token-based authentication.' },
  { taskNumber: 11, title: 'CRUD Operations',                    description: 'Build full Create, Read, Update, Delete functionality for a data entity.' },
  { taskNumber: 12, title: 'Form Validation',                    description: 'Add client-side and server-side form validation to your application.' },
  { taskNumber: 13, title: 'File Upload Feature',                description: 'Implement a file upload system with validation (type, size) and storage.' },
  { taskNumber: 14, title: 'UI/UX Improvement',                  description: 'Apply UI/UX best practices. Improve accessibility, color contrast, and user feedback.' },
  { taskNumber: 15, title: 'Testing & Debugging',                description: 'Write basic unit tests and debug identified issues in your project.' },
  { taskNumber: 16, title: 'Security Best Practices',            description: 'Review and apply security practices: input sanitization, password hashing, HTTPS.' },
  { taskNumber: 17, title: 'Performance Optimization',           description: 'Profile and optimize page load time, database queries, and asset delivery.' },
  { taskNumber: 18, title: 'Documentation',                      description: 'Write clear README, API docs, and inline code comments for your project.' },
  { taskNumber: 19, title: 'Deployment',                         description: 'Deploy your application to a hosting platform. Configure environment variables.' },
  { taskNumber: 20, title: 'Final Presentation & Report',        description: 'Prepare a final internship report and present your project to the team.' },
];

function seedDatabase() {
  if (localStorage.getItem(DB_KEYS.SEEDED)) {
    // Ensure manager account details are updated if database was already seeded
    const users = Users.all();
    const mgr = users.find(u => u.role === 'manager');
    if (mgr) {
      Users.update(mgr.id, {
        username: 'nantha.k@entomo.co',
        email: 'nantha.k@entomo.co',
        name: 'Nantha Kumar Valayatham'
      });
    }
    return;
  }

  // Manager user
  const manager = Users.create({
    role: 'manager',
    username: 'nantha.k@entomo.co',
    email: 'nantha.k@entomo.co',
    password: 'manager123',
    name: 'Nantha Kumar Valayatham',
    phone: '+60 12-345 6789',
    photo: '',
  });

  // Demo intern user
  const internUser = Users.create({
    role: 'intern',
    username: 'intern1',
    email: 'intern@itpas.com',
    password: 'intern123',
    name: 'Ali Hassan',
    phone: '+60 11-234 5678',
    photo: '',
  });

  // Demo intern profile
  const intern = Interns.create({
    userId: internUser.id,
    university: 'Universiti Teknologi Malaysia',
    course: 'Bachelor of Computer Science',
    startDate: '2026-06-01',
    endDate: '2026-08-31',
  });

  // Seed all 20 tasks
  SEED_TASKS.forEach(t => {
    Tasks.create({
      taskNumber: t.taskNumber,
      title: t.title,
      description: t.description,
      dueDate: '',
      order: t.taskNumber,
    });
  });

  // Auto-assign Task 1 & 2 to demo intern
  const task1 = Tasks.findByNumber(1);
  const task2 = Tasks.findByNumber(2);
  if (task1) Assignments.create({ internId: intern.id, taskId: task1.id, taskNumber: 1, status: 'In Progress' });
  if (task2) Assignments.create({ internId: intern.id, taskId: task2.id, taskNumber: 2, status: 'In Progress' });

  // Notifications
  Notifications.create({ userId: internUser.id, message: 'Welcome to ITPAS! Task 1 and Task 2 have been assigned to you.', type: 'success' });
  Notifications.create({ userId: manager.id, message: 'Welcome to ITPAS Manager Portal. The system is ready.', type: 'info' });

  localStorage.setItem(DB_KEYS.SEEDED, '1');
  console.log('[ITPAS] Database seeded successfully.');
}

// ─── Exports ──────────────────────────────────────────────────────────────────

window.DB = {
  Users,
  Interns,
  Tasks,
  Assignments,
  Submissions,
  Feedback,
  DailyReports,
  Notifications,
  seed: seedDatabase,
  hash: _hash,
  genId: _genId,
};

// Auto-seed on load
seedDatabase();
