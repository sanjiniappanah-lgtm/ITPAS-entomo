const db = require('../config/db');

function addDays(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function getTaskPairs() {
  const tasks = db.prepare('SELECT taskOrder FROM task ORDER BY taskOrder').all();
  const pairs = [];
  for (let i = 0; i < tasks.length; i += 2) {
    if (tasks[i + 1]) {
      pairs.push([tasks[i].taskOrder, tasks[i + 1].taskOrder]);
    } else {
      pairs.push([tasks[i].taskOrder, null]);
    }
  }
  return pairs;
}

function createAssignment(internID, taskID, taskOrder) {
  const task = db.prepare('SELECT due FROM task WHERE taskID = ?').get(taskID);
  const dueDays = task?.due || 7;
  const assignedAt = new Date().toISOString();
  const dueDate = addDays(assignedAt, dueDays);

  const result = db.prepare(
    'INSERT INTO taskAssign (internID, taskID, assignedAt, dueDate, status) VALUES (?, ?, ?, ?, ?)'
  ).run(internID, taskID, assignedAt, dueDate, 'In Progress');

  return result.lastInsertRowid;
}

function createNotification(userID, message, type = 'info', link = '') {
  db.prepare(
    'INSERT INTO notification (userID, message, type, link) VALUES (?, ?, ?, ?)'
  ).run(userID, message, type, link);
}

function unlockPair(internID, numA, numB) {
  const intern = db.prepare('SELECT userID FROM intern WHERE internID = ?').get(internID);
  if (!intern) return;

  const taskA = db.prepare('SELECT taskID, taskOrder FROM task WHERE taskOrder = ?').get(numA);
  const taskB = numB ? db.prepare('SELECT taskID, taskOrder FROM task WHERE taskOrder = ?').get(numB) : null;

  if (taskA) createAssignment(internID, taskA.taskID, numA);
  if (taskB) createAssignment(internID, taskB.taskID, numB);

  const pairLabel = numB ? `Task ${numA} and Task ${numB}` : `Task ${numA}`;
  createNotification(
    intern.userID,
    `🎉 ${pairLabel} ${numB ? 'have' : 'has'} been unlocked! Keep up the great work.`,
    'success',
    '/intern/tasks.html'
  );

  const managers = db.prepare('SELECT userID FROM user WHERE role = ?').all('manager');
  const user = db.prepare('SELECT name FROM user WHERE userID = ?').get(intern.userID);
  managers.forEach((m) => {
    createNotification(
      m.userID,
      `${user?.name || 'An intern'} has progressed to ${pairLabel}.`,
      'info',
      '/manager/progress.html'
    );
  });
}

function assignInitialTasks(internID) {
  const task1 = db.prepare('SELECT taskID, taskOrder FROM task WHERE taskOrder = 1').get();
  const task2 = db.prepare('SELECT taskID, taskOrder FROM task WHERE taskOrder = 2').get();
  if (task1) createAssignment(internID, task1.taskID, 1);
  if (task2) createAssignment(internID, task2.taskID, 2);
}

function checkAndUnlockNextPair(internID) {
  const assignments = db.prepare(
    'SELECT ta.*, t.taskOrder FROM taskAssign ta JOIN task t ON ta.taskID = t.taskID WHERE ta.internID = ?'
  ).all(internID);

  const pairs = getTaskPairs();
  const submittedStatuses = ['Pending Review', 'Completed'];

  for (let i = 0; i < pairs.length; i++) {
    const [numA, numB] = pairs[i];
    const assignA = assignments.find((a) => a.taskOrder === numA);
    const assignB = numB ? assignments.find((a) => a.taskOrder === numB) : null;

    if (!assignA) continue;
    if (numB && !assignB) continue;

    const aSubmitted = submittedStatuses.includes(assignA.status);
    const bSubmitted = !numB || (assignB && submittedStatuses.includes(assignB.status));

    if (!aSubmitted || !bSubmitted) continue;

    const nextPair = pairs[i + 1];
    if (!nextPair) continue;

    const [numC, numD] = nextPair;
    const alreadyUnlocked =
      assignments.find((a) => a.taskOrder === numC) ||
      (numD && assignments.find((a) => a.taskOrder === numD));

    if (alreadyUnlocked) continue;

    unlockPair(internID, numC, numD);
  }
}

module.exports = {
  getTaskPairs,
  createAssignment,
  createNotification,
  assignInitialTasks,
  checkAndUnlockNextPair,
  unlockPair,
};
