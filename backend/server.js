require('dotenv').config();
const express = require('express');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const jwt = require('jsonwebtoken');
const db = require('./config/db');
const { signToken, authMiddleware, requireManager, JWT_SECRET } = require('./middleware/auth');
const {
  mapUser,
  mapIntern,
  mapTask,
  mapAssignment,
  mapSubmission,
  mapReview,
  mapDailyReport,
  mapNotification,
  STATUS_TO_ACTION,
} = require('./utils/mappers');
const {
  assignInitialTasks,
  checkAndUnlockNextPair,
  createNotification,
  createAssignment,
} = require('./services/automation');

const app = express();
const PORT = process.env.PORT || 3000;
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, 'uploads');

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + '-' + file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_'));
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
});

app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true }));

// CORS for dev (same-origin when served from express static)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// ─── Auth ───────────────────────────────────────────────────────────────────

app.post('/api/auth/login', (req, res) => {
  const { identifier, password } = req.body;
  if (!identifier || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  const user = db.prepare(
    'SELECT * FROM user WHERE email = ? COLLATE NOCASE'
  ).get(identifier.trim());

  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ success: false, message: 'Account not found or invalid credentials.' });
  }

  if (user.status === 'inactive') {
    return res.status(403).json({ success: false, message: 'Your account is inactive. Please contact the system administrator.' });
  }

  const token = signToken(user);
  return res.json({
    success: true,
    token,
    session: {
      userId: String(user.userID),
      role: user.role,
      name: user.name,
      email: user.email,
      loggedInAt: new Date().toISOString(),
    },
  });
});

app.get('/api/auth/me', authMiddleware, (req, res) => {
  const user = db.prepare('SELECT * FROM user WHERE userID = ?').get(req.user.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(mapUser(user));
});

// ─── Bootstrap (load all data for frontend cache) ───────────────────────────

app.get('/api/bootstrap', authMiddleware, (req, res) => {
  const userId = req.user.userId;
  const role = req.user.role;

  const users = role === 'manager'
    ? db.prepare('SELECT * FROM user').all().map(mapUser)
    : [mapUser(db.prepare('SELECT * FROM user WHERE userID = ?').get(userId))];

  let interns;
  let assignments;
  let submissions;
  let dailyReports;

  if (role === 'manager') {
    interns = db.prepare('SELECT * FROM intern').all().map(mapIntern);
    assignments = db.prepare(
      'SELECT ta.*, t.taskOrder FROM taskAssign ta JOIN task t ON ta.taskID = t.taskID'
    ).all().map(mapAssignment);
    submissions = loadAllSubmissions();
    dailyReports = db.prepare('SELECT * FROM dailyReport ORDER BY created_at DESC').all().map(mapDailyReport);
  } else {
    const intern = db.prepare('SELECT * FROM intern WHERE userID = ?').get(userId);
    interns = intern ? [mapIntern(intern)] : [];
    const internID = intern?.internID;

    assignments = internID
      ? db.prepare(
          'SELECT ta.*, t.taskOrder FROM taskAssign ta JOIN task t ON ta.taskID = t.taskID WHERE ta.internID = ?'
        ).all(internID).map(mapAssignment)
      : [];

    submissions = internID ? loadSubmissionsForIntern(internID) : [];
    dailyReports = internID
      ? db.prepare('SELECT * FROM dailyReport WHERE internID = ? ORDER BY created_at DESC').all(internID).map(mapDailyReport)
      : [];
  }

  const tasks = db.prepare('SELECT * FROM task ORDER BY taskOrder').all().map(mapTask);
  const reviews = loadAllReviews();
  const notifications = db.prepare(
    'SELECT * FROM notification WHERE userID = ? ORDER BY created_at DESC'
  ).all(userId).map(mapNotification);

  res.json({
    users,
    interns,
    tasks,
    assignments,
    submissions,
    feedback: reviews,
    dailyReports,
    notifications,
  });
});

function loadAllSubmissions() {
  const rows = db.prepare(`
    SELECT s.*, ta.internID, ta.taskID, t.taskOrder
    FROM submission s
    JOIN taskAssign ta ON s.assignmentID = ta.assignmentID
    JOIN task t ON ta.taskID = t.taskID
    ORDER BY s.created_at DESC
  `).all();
  return rows.map((row) => {
    const file = db.prepare('SELECT * FROM submissionFile WHERE submissionID = ? LIMIT 1').get(row.submissionID);
    return mapSubmission(row, file);
  });
}

function loadSubmissionsForIntern(internID) {
  const rows = db.prepare(`
    SELECT s.*, ta.internID, ta.taskID, t.taskOrder
    FROM submission s
    JOIN taskAssign ta ON s.assignmentID = ta.assignmentID
    JOIN task t ON ta.taskID = t.taskID
    WHERE ta.internID = ?
    ORDER BY s.created_at DESC
  `).all(internID);
  return rows.map((row) => {
    const file = db.prepare('SELECT * FROM submissionFile WHERE submissionID = ? LIMIT 1').get(row.submissionID);
    return mapSubmission(row, file);
  });
}

function loadAllReviews() {
  return db.prepare('SELECT * FROM review ORDER BY created_at DESC').all().map(mapReview);
}

// ─── Users ──────────────────────────────────────────────────────────────────

app.put('/api/users/:id', authMiddleware, (req, res) => {
  const userID = parseInt(req.params.id, 10);
  if (req.user.userId !== userID && req.user.role !== 'manager') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const { name, email, phone, photo, password } = req.body;
  const existing = db.prepare('SELECT * FROM user WHERE userID = ?').get(userID);
  if (!existing) return res.status(404).json({ error: 'User not found' });

  let hashedPassword = existing.password;
  if (password) hashedPassword = bcrypt.hashSync(password, 10);

  db.prepare(
    'UPDATE user SET name = ?, email = ?, phoneNum = ?, image = ?, password = ?, updated_at = CURRENT_TIMESTAMP WHERE userID = ?'
  ).run(
    name ?? existing.name,
    email ?? existing.email,
    phone ?? existing.phoneNum,
    photo ?? existing.image,
    hashedPassword,
    userID
  );

  res.json(mapUser(db.prepare('SELECT * FROM user WHERE userID = ?').get(userID)));
});

// ─── Interns ────────────────────────────────────────────────────────────────

app.post('/api/interns', authMiddleware, requireManager, (req, res) => {
  const { name, email, password, phone, photo, university, course, startDate, endDate } = req.body;

  const existing = db.prepare('SELECT userID FROM user WHERE email = ?').get(email);
  if (existing) return res.status(400).json({ error: 'Email already exists' });

  const hash = bcrypt.hashSync(password, 10);
  const userResult = db.prepare(
    'INSERT INTO user (email, name, password, role, phoneNum, image) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(email, name, hash, 'intern', phone || '', photo || '');

  const internResult = db.prepare(
    'INSERT INTO intern (userID, university, course, startDate, endDate) VALUES (?, ?, ?, ?, ?)'
  ).run(userResult.lastInsertRowid, university, course, startDate, endDate);

  assignInitialTasks(internResult.lastInsertRowid);

  const internUser = db.prepare('SELECT * FROM user WHERE userID = ?').get(userResult.lastInsertRowid);
  createNotification(
    userResult.lastInsertRowid,
    'Welcome to InternSpect! Task 1 and Task 2 have been assigned to you.',
    'success',
    '/intern/tasks.html'
  );

  const managers = db.prepare('SELECT userID FROM user WHERE role = ?').all('manager');
  managers.forEach((m) => {
    createNotification(
      m.userID,
      `👤 New intern ${name} has been registered. Task 1 & 2 have been auto-assigned.`,
      'success',
      '/manager/interns.html'
    );
  });

  res.json({
    user: mapUser(internUser),
    intern: mapIntern(db.prepare('SELECT * FROM intern WHERE internID = ?').get(internResult.lastInsertRowid)),
  });
});

app.put('/api/interns/:id', authMiddleware, (req, res) => {
  const internID = parseInt(req.params.id, 10);
  const { university, course, startDate, endDate } = req.body;
  db.prepare(
    'UPDATE intern SET university = ?, course = ?, startDate = ?, endDate = ? WHERE internID = ?'
  ).run(university, course, startDate, endDate, internID);
  res.json(mapIntern(db.prepare('SELECT * FROM intern WHERE internID = ?').get(internID)));
});

app.delete('/api/interns/:id', authMiddleware, requireManager, (req, res) => {
  const internID = parseInt(req.params.id, 10);
  const intern = db.prepare('SELECT userID FROM intern WHERE internID = ?').get(internID);
  if (!intern) return res.status(404).json({ error: 'Intern not found' });

  db.transaction(() => {
    const assignments = db.prepare('SELECT assignmentID FROM taskAssign WHERE internID = ?').all(internID);
    for (const a of assignments) {
      const subs = db.prepare('SELECT submissionID FROM submission WHERE assignmentID = ?').all(a.assignmentID);
      for (const s of subs) {
        db.prepare('DELETE FROM submissionFile WHERE submissionID = ?').run(s.submissionID);
        db.prepare('DELETE FROM review WHERE submissionID = ?').run(s.submissionID);
      }
      db.prepare('DELETE FROM submission WHERE assignmentID = ?').run(a.assignmentID);
    }
    db.prepare('DELETE FROM taskAssign WHERE internID = ?').run(internID);
    db.prepare('DELETE FROM dailyReport WHERE internID = ?').run(internID);
    db.prepare('DELETE FROM notification WHERE userID = ?').run(intern.userID);
    db.prepare('DELETE FROM intern WHERE internID = ?').run(internID);
    db.prepare('DELETE FROM user WHERE userID = ?').run(intern.userID);
  })();

  res.json({ success: true });
});

app.post('/api/interns/:id/reset-password', authMiddleware, requireManager, (req, res) => {
  const internID = parseInt(req.params.id, 10);
  const intern = db.prepare('SELECT userID FROM intern WHERE internID = ?').get(internID);
  if (!intern) return res.status(404).json({ error: 'Intern not found' });
  
  const { newPassword } = req.body;
  if (!newPassword) return res.status(400).json({ error: 'New password required' });

  const hash = bcrypt.hashSync(newPassword, 10);
  db.prepare('UPDATE user SET password = ? WHERE userID = ?').run(hash, intern.userID);

  res.json({ success: true });
});

app.put('/api/interns/:id/status', authMiddleware, requireManager, (req, res) => {
  const internID = parseInt(req.params.id, 10);
  const intern = db.prepare('SELECT userID FROM intern WHERE internID = ?').get(internID);
  if (!intern) return res.status(404).json({ error: 'Intern not found' });
  
  const { status } = req.body;
  db.prepare('UPDATE user SET status = ? WHERE userID = ?').run(status, intern.userID);
  res.json({ success: true, status });
});

app.post('/api/interns/:id/unlock-task', authMiddleware, requireManager, (req, res) => {
  const internID = parseInt(req.params.id, 10);
  const { taskId } = req.body;
  
  const task = db.prepare('SELECT * FROM task WHERE taskID = ?').get(taskId);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  
  const existing = db.prepare('SELECT * FROM taskAssign WHERE internID = ? AND taskID = ?').get(internID, taskId);
  if (existing) return res.status(400).json({ error: 'Task already assigned' });

  createAssignment(internID, task.taskID, task.taskOrder);
  
  res.json({ success: true });
});

// ─── Tasks ──────────────────────────────────────────────────────────────────

app.post('/api/tasks', authMiddleware, requireManager, (req, res) => {
  const { taskNumber, title, description, due } = req.body;
  const result = db.prepare(
    'INSERT INTO task (taskOrder, title, description, due) VALUES (?, ?, ?, ?)'
  ).run(taskNumber, title, description || '', due || 7);
  res.json(mapTask(db.prepare('SELECT * FROM task WHERE taskID = ?').get(result.lastInsertRowid)));
});

app.put('/api/tasks/:id', authMiddleware, requireManager, (req, res) => {
  const taskID = parseInt(req.params.id, 10);
  const { taskNumber, title, description, due } = req.body;
  db.prepare(
    'UPDATE task SET taskOrder = ?, title = ?, description = ?, due = ?, updated_at = CURRENT_TIMESTAMP WHERE taskID = ?'
  ).run(taskNumber, title, description, due || 7, taskID);
  res.json(mapTask(db.prepare('SELECT * FROM task WHERE taskID = ?').get(taskID)));
});

app.delete('/api/tasks/:id', authMiddleware, requireManager, (req, res) => {
  const taskID = parseInt(req.params.id, 10);
  db.prepare('DELETE FROM task WHERE taskID = ?').run(taskID);
  res.json({ success: true });
});

app.post('/api/tasks/reorder', authMiddleware, requireManager, (req, res) => {
  const { orderedIds } = req.body;
  if (!Array.isArray(orderedIds)) return res.status(400).json({ error: 'orderedIds required' });

  const reorder = db.transaction((ids) => {
    ids.forEach((id, idx) => {
      db.prepare('UPDATE task SET taskOrder = ?, updated_at = CURRENT_TIMESTAMP WHERE taskID = ?').run(idx + 1, parseInt(id, 10));
    });
  });
  reorder(orderedIds);

  const tasks = db.prepare('SELECT * FROM task ORDER BY taskOrder').all().map(mapTask);
  res.json(tasks);
});

// ─── Submissions ────────────────────────────────────────────────────────────

app.post('/api/submissions', authMiddleware, upload.single('file'), (req, res) => {
  const { assignmentId, freeText, internId } = req.body;
  const assignmentID = parseInt(assignmentId, 10);

  const assignment = db.prepare(
    'SELECT ta.*, t.taskOrder FROM taskAssign ta JOIN task t ON ta.taskID = t.taskID WHERE ta.assignmentID = ?'
  ).get(assignmentID);

  if (!assignment) return res.status(404).json({ error: 'Assignment not found' });

  const subResult = db.prepare(
    'INSERT INTO submission (assignmentID, details, status) VALUES (?, ?, ?)'
  ).run(assignmentID, freeText || '', 'Pending Review');

  const submissionID = subResult.lastInsertRowid;

  if (req.file) {
    db.prepare(
      'INSERT INTO submissionFile (submissionID, fileName, filePath, fileType, fileSize) VALUES (?, ?, ?, ?, ?)'
    ).run(submissionID, req.file.originalname, req.file.filename, req.file.mimetype, req.file.size);
  }

  db.prepare('UPDATE taskAssign SET status = ? WHERE assignmentID = ?').run('Pending Review', assignmentID);

  checkAndUnlockNextPair(assignment.internID);

  const intern = db.prepare('SELECT userID FROM intern WHERE internID = ?').get(assignment.internID);
  const user = db.prepare('SELECT name FROM user WHERE userID = ?').get(intern.userID);
  const managers = db.prepare('SELECT userID FROM user WHERE role = ?').all('manager');
  managers.forEach((m) => {
    createNotification(
      m.userID,
      `📥 ${user?.name || 'An intern'} has submitted Task ${assignment.taskOrder} for review.`,
      'info',
      '/manager/review-queue.html'
    );
  });

  const row = db.prepare(`
    SELECT s.*, ta.internID, ta.taskID, t.taskOrder
    FROM submission s
    JOIN taskAssign ta ON s.assignmentID = ta.assignmentID
    JOIN task t ON ta.taskID = t.taskID
    WHERE s.submissionID = ?
  `).get(submissionID);
  const file = db.prepare('SELECT * FROM submissionFile WHERE submissionID = ? LIMIT 1').get(submissionID);

  res.json(mapSubmission(row, file));
});

// ─── Reviews ────────────────────────────────────────────────────────────────

app.post('/api/reviews', authMiddleware, requireManager, (req, res) => {
  const { submissionId, internId, status, comments } = req.body;
  const submissionID = parseInt(submissionId, 10);
  const internID = parseInt(internId, 10);
  const action = STATUS_TO_ACTION[status] || status;

  db.prepare(
    'INSERT INTO review (submissionID, reviewerID, feedback, action) VALUES (?, ?, ?, ?)'
  ).run(submissionID, req.user.userId, comments, action);

  db.prepare('UPDATE submission SET status = ? WHERE submissionID = ?').run(status, submissionID);

  const sub = db.prepare('SELECT assignmentID FROM submission WHERE submissionID = ?').get(submissionID);
  if (sub) {
    db.prepare('UPDATE taskAssign SET status = ? WHERE assignmentID = ?').run(status, sub.assignmentID);
  }

  const intern = db.prepare('SELECT userID FROM intern WHERE internID = ?').get(internID);
  const assignment = db.prepare(
    'SELECT ta.*, t.taskOrder FROM taskAssign ta JOIN task t ON ta.taskID = t.taskID WHERE ta.assignmentID = ?'
  ).get(sub?.assignmentID);

  if (status === 'Completed') {
    createNotification(
      intern.userID,
      `🏆 Task ${assignment?.taskOrder} has been marked as Completed. Great work!`,
      'success',
      '/intern/tasks.html'
    );
    checkAndUnlockNextPair(internID);
  } else if (status === 'Request Revision') {
    createNotification(
      intern.userID,
      `⚠️ Task ${assignment?.taskOrder} requires revision. Manager feedback: "${comments || 'Please review and resubmit.'}"`,
      'warning',
      '/intern/tasks.html'
    );
  }

  const review = db.prepare('SELECT * FROM review WHERE submissionID = ? ORDER BY created_at DESC LIMIT 1').get(submissionID);
  res.json(mapReview(review));
});

// ─── Daily Reports ────────────────────────────────────────────────────────

app.post('/api/daily-reports', authMiddleware, (req, res) => {
  const {
    internId, date, tasksAssigned, activities, responsibilities,
    gained, improvement, problemsFaced, additionalQuestions,
  } = req.body;

  const result = db.prepare(
    'INSERT INTO dailyReport (internID, reportDate, taskAssigned, Activities, Responsibilities, Gained, Target, Problem, Question) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(
    parseInt(internId, 10),
    date,
    tasksAssigned,
    activities,
    responsibilities,
    gained,
    improvement,
    problemsFaced,
    additionalQuestions
  );

  const intern = db.prepare('SELECT userID FROM intern WHERE internID = ?').get(parseInt(internId, 10));
  const user = db.prepare('SELECT name FROM user WHERE userID = ?').get(intern.userID);
  const managers = db.prepare('SELECT userID FROM user WHERE role = ?').all('manager');
  managers.forEach((m) => {
    createNotification(
      m.userID,
      `📋 ${user?.name || 'An intern'} has submitted a daily report.`,
      'info',
      '/manager/reports.html'
    );
  });

  res.json(mapDailyReport(db.prepare('SELECT * FROM dailyReport WHERE reportID = ?').get(result.lastInsertRowid)));
});

// ─── Notifications ────────────────────────────────────────────────────────

app.put('/api/notifications/:id/read', authMiddleware, (req, res) => {
  db.prepare('UPDATE notification SET read = 1 WHERE notificationID = ? AND userID = ?').run(
    parseInt(req.params.id, 10),
    req.user.userId
  );
  res.json({ success: true });
});

app.put('/api/notifications/read-all', authMiddleware, (req, res) => {
  db.prepare('UPDATE notification SET read = 1 WHERE userID = ?').run(req.user.userId);
  res.json({ success: true });
});

// ─── Files ──────────────────────────────────────────────────────────────────

app.get('/api/files/:id', (req, res) => {
  let userId = null;
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    try {
      userId = jwt.verify(header.slice(7), JWT_SECRET).userId;
    } catch { /* fall through */ }
  }
  if (!userId && req.query.token) {
    try {
      userId = jwt.verify(req.query.token, JWT_SECRET).userId;
    } catch { /* fall through */ }
  }
  if (!userId) return res.status(401).json({ error: 'Authentication required' });

  const file = db.prepare('SELECT * FROM submissionFile WHERE fileID = ?').get(parseInt(req.params.id, 10));
  if (!file) return res.status(404).json({ error: 'File not found' });
  const filePath = path.join(UPLOAD_DIR, file.filePath);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found on disk' });
  res.download(filePath, file.fileName);
});

// ─── Static frontend ────────────────────────────────────────────────────────

const staticRoot = path.join(__dirname, '..');
app.use(express.static(staticRoot));

const { seed } = require('./seed');
seed();

app.listen(PORT, () => {
  console.log(`[ITPAS] Server running at http://localhost:${PORT}`);
  console.log(`[ITPAS] Database: ${process.env.DB_PATH || './data/itpas.db'}`);
  console.log('[ITPAS] Press Ctrl+C to stop the server.');
});
