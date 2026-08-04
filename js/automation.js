/**
 * ITPAS — Task Automation Engine
 * Automatically unlocks the next task pair when both tasks in the current pair
 * have been submitted by the intern (status = 'Pending Review' or 'Completed').
 * Works dynamically for any number of tasks — not just 1-20.
 */

const Automation = {
  /**
   * Build task pairs dynamically from all tasks in DB.
   * Tasks are sorted by taskNumber and grouped into consecutive pairs: [1,2], [3,4], [5,6], ...
   */
  getTaskPairs() {
    const tasks = DB.Tasks.all().sort((a, b) => a.taskNumber - b.taskNumber);
    const pairs = [];
    for (let i = 0; i < tasks.length; i += 2) {
      if (tasks[i + 1]) {
        pairs.push([tasks[i].taskNumber, tasks[i + 1].taskNumber]);
      } else {
        // Odd task at the end — treat as a solo pair
        pairs.push([tasks[i].taskNumber, null]);
      }
    }
    return pairs;
  },

  /**
   * Called immediately after an intern submits a task.
   * Checks if both tasks in the current pair have been submitted (Pending Review or Completed),
   * and if so, unlocks the next pair immediately — no manager review required.
   *
   * @param {string} internId
   */
  checkAndUnlockNextPair(internId) {
    const assignments = DB.Assignments.forIntern(internId);
    const TASK_PAIRS = this.getTaskPairs();
    const submittedStatuses = ['Pending Review', 'Completed'];

    for (let i = 0; i < TASK_PAIRS.length; i++) {
      const [numA, numB] = TASK_PAIRS[i];

      const assignA = assignments.find(a => a.taskNumber === numA);
      // If solo task (numB is null), only check A
      const assignB = numB !== null ? assignments.find(a => a.taskNumber === numB) : null;

      // Both must be assigned
      if (!assignA) continue;
      if (numB !== null && !assignB) continue;

      const aSubmitted = submittedStatuses.includes(assignA.status);
      const bSubmitted = numB === null || (assignB && submittedStatuses.includes(assignB.status));

      // Both must be submitted to unlock next pair
      if (!aSubmitted || !bSubmitted) continue;

      // Check if next pair exists and is not yet assigned
      const nextPair = TASK_PAIRS[i + 1];
      if (!nextPair) continue;

      const [numC, numD] = nextPair;
      const alreadyUnlocked =
        assignments.find(a => a.taskNumber === numC) ||
        (numD !== null && assignments.find(a => a.taskNumber === numD));

      if (alreadyUnlocked) continue;

      // Unlock the next pair!
      this._unlockPair(internId, numC, numD);
    }
  },

  /**
   * Unlocks a specific task pair for an intern.
   * Creates assignment records with status 'In Progress'.
   * numB can be null for solo (last odd) task.
   */
  _unlockPair(internId, numA, numB) {
    const taskA = DB.Tasks.findByNumber(numA);
    const taskB = numB !== null ? DB.Tasks.findByNumber(numB) : null;
    const intern = DB.Interns.find(internId);
    if (!intern) return;

    if (taskA) {
      DB.Assignments.create({
        internId,
        taskId: taskA.id,
        taskNumber: numA,
        status: 'In Progress',
      });
    }
    if (taskB) {
      DB.Assignments.create({
        internId,
        taskId: taskB.id,
        taskNumber: numB,
        status: 'In Progress',
      });
    }

    // Notify the intern
    const user = DB.Users.find(intern.userId);
    const pairLabel = numB !== null ? `Task ${numA} and Task ${numB}` : `Task ${numA}`;
    if (user) {
      DB.Notifications.create({
        userId: user.id,
        message: `🎉 ${pairLabel} ${numB !== null ? 'have' : 'has'} been unlocked! Keep up the great work.`,
        type: 'success',
        link: '../intern/tasks.html',
      });
    }

    // Notify all managers
    const managers = DB.Users.all().filter(u => u.role === 'manager');
    managers.forEach(mgr => {
      DB.Notifications.create({
        userId: mgr.id,
        message: `${user ? user.name : 'An intern'} has progressed to ${pairLabel}.`,
        type: 'info',
        link: 'progress.html',
      });
    });

    console.log(`[ITPAS Automation] Unlocked ${pairLabel} for intern ${internId}`);
  },

  /**
   * Get the current active task pair index for an intern (0-indexed).
   */
  getCurrentPairIndex(internId) {
    const assignments = DB.Assignments.forIntern(internId);
    const assignedNumbers = assignments.map(a => a.taskNumber);
    const TASK_PAIRS = this.getTaskPairs();

    for (let i = TASK_PAIRS.length - 1; i >= 0; i--) {
      const [a, b] = TASK_PAIRS[i];
      if (assignedNumbers.includes(a) || (b !== null && assignedNumbers.includes(b))) {
        return i;
      }
    }
    return -1;
  },

  /**
   * Calculate overall completion percentage for an intern.
   * Based on total tasks in DB dynamically.
   */
  getCompletionPercentage(internId) {
    const assignments = DB.Assignments.forIntern(internId);
    if (!assignments.length) return 0;
    const total = DB.Tasks.all().length || 20;
    const completed = assignments.filter(a => a.status === 'Completed').length;
    return Math.round((completed / total) * 100);
  },

  /**
   * Get task status summary for an intern.
   */
  getSummary(internId) {
    const assignments = DB.Assignments.forIntern(internId);
    const total = DB.Tasks.all().length || 20;
    const assigned = assignments.length;
    const completed = assignments.filter(a => a.status === 'Completed').length;
    const pending = assignments.filter(a => a.status === 'Pending Review').length;
    const inProgress = assignments.filter(a => a.status === 'In Progress').length;
    const revision = assignments.filter(a => a.status === 'Request Revision').length;
    const remaining = total - completed;

    return { total, assigned, completed, pending, inProgress, revision, remaining };
  },
};

window.Automation = Automation;
