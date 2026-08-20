require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('./config/db');

const SEED_TASKS = [
  { taskOrder: 1, title: 'Orientation & Onboarding', description: 'Complete the company orientation, review the internship handbook, and set up your workspace accounts.', due: 7 },
  { taskOrder: 2, title: 'Environment Setup', description: 'Install required software tools, configure your development environment, and verify all tools are working.', due: 7 },
  { taskOrder: 3, title: 'HTML & CSS Fundamentals', description: 'Study HTML5 semantic elements and CSS3 styling. Build a simple static webpage.', due: 7 },
  { taskOrder: 4, title: 'JavaScript Basics', description: 'Learn JavaScript fundamentals: variables, loops, functions, DOM manipulation.', due: 7 },
  { taskOrder: 5, title: 'Version Control with Git', description: 'Learn Git commands: init, add, commit, push, pull, branch. Push your work to a remote repository.', due: 7 },
  { taskOrder: 6, title: 'Responsive Web Design', description: 'Study media queries and responsive layouts. Make your webpage mobile-friendly.', due: 7 },
  { taskOrder: 7, title: 'Introduction to Databases', description: 'Understand relational databases, SQL basics, and design a simple schema for a given problem.', due: 7 },
  { taskOrder: 8, title: 'Backend Fundamentals', description: 'Learn server-side concepts. Set up a basic REST API using your assigned backend technology.', due: 7 },
  { taskOrder: 9, title: 'API Integration', description: 'Connect your frontend to the backend API. Fetch data and display it dynamically.', due: 7 },
  { taskOrder: 10, title: 'User Authentication', description: 'Implement login and registration with session/token-based authentication.', due: 7 },
  { taskOrder: 11, title: 'CRUD Operations', description: 'Build full Create, Read, Update, Delete functionality for a data entity.', due: 7 },
  { taskOrder: 12, title: 'Form Validation', description: 'Add client-side and server-side form validation to your application.', due: 7 },
  { taskOrder: 13, title: 'File Upload Feature', description: 'Implement a file upload system with validation (type, size) and storage.', due: 7 },
  { taskOrder: 14, title: 'UI/UX Improvement', description: 'Apply UI/UX best practices. Improve accessibility, color contrast, and user feedback.', due: 7 },
  { taskOrder: 15, title: 'Testing & Debugging', description: 'Write basic unit tests and debug identified issues in your project.', due: 7 },
  { taskOrder: 16, title: 'Security Best Practices', description: 'Review and apply security practices: input sanitization, password hashing, HTTPS.', due: 7 },
  { taskOrder: 17, title: 'Performance Optimization', description: 'Profile and optimize page load time, database queries, and asset delivery.', due: 7 },
  { taskOrder: 18, title: 'Documentation', description: 'Write clear README, API docs, and inline code comments for your project.', due: 7 },
  { taskOrder: 19, title: 'Deployment', description: 'Deploy your application to a hosting platform. Configure environment variables.', due: 7 },
  { taskOrder: 20, title: 'Final Presentation & Report', description: 'Prepare a final internship report and present your project to the team.', due: 14 },
];

function seed() {
  const taskCount = db.prepare('SELECT COUNT(*) as c FROM task').get().c;
  if (taskCount > 0) {
    console.log('[ITPAS Seed] Database already seeded, skipping.');
    return;
  }

  const managerHash = bcrypt.hashSync('manager123', 10);
  const mgr = db.prepare(
    'INSERT INTO user (email, name, password, role, phoneNum) VALUES (?, ?, ?, ?, ?)'
  ).run('nantha.k@entomo.co', 'Nantha Kumar Valayatham', managerHash, 'manager', '+60 12-345 6789');

  const internHash = bcrypt.hashSync('intern123', 10);
  const internUser = db.prepare(
    'INSERT INTO user (email, name, password, role, phoneNum) VALUES (?, ?, ?, ?, ?)'
  ).run('intern@itpas.com', 'Ali Hassan', internHash, 'intern', '+60 11-234 5678');

  const intern = db.prepare(
    'INSERT INTO intern (userID, university, course, startDate, endDate) VALUES (?, ?, ?, ?, ?)'
  ).run(
    internUser.lastInsertRowid,
    'Universiti Teknologi Malaysia',
    'Bachelor of Computer Science',
    '2026-06-01',
    '2026-08-31'
  );

  const insertTask = db.prepare('INSERT INTO task (taskOrder, title, description, due) VALUES (?, ?, ?, ?)');
  SEED_TASKS.forEach((t) => insertTask.run(t.taskOrder, t.title, t.description, t.due));

  const { assignInitialTasks } = require('./services/automation');
  assignInitialTasks(intern.lastInsertRowid);

  const { createNotification } = require('./services/automation');
  createNotification(internUser.lastInsertRowid, 'Welcome to InternSpect! Task 1 and Task 2 have been assigned to you.', 'success', '/intern/tasks.html');
  createNotification(mgr.lastInsertRowid, 'Welcome to InternSpect Manager Portal. The system is ready.', 'info', '/manager/dashboard.html');

  console.log('[ITPAS Seed] Database seeded successfully.');
  console.log('  Manager: nantha.k@entomo.co / manager123');
  console.log('  Intern:  intern@itpas.com / intern123');
}

module.exports = { seed };
