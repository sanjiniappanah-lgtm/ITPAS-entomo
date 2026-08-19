/**
 * ITPAS — Task Automation Engine (client-side read helpers)
 * Unlock logic runs on the server; this module provides UI helpers.
 */

const Automation = {
  getTaskPairs() {
    const tasks = DB.Tasks.all().sort((a, b) => a.taskNumber - b.taskNumber);
    const pairs = [];
    for (let i = 0; i < tasks.length; i += 2) {
      if (tasks[i + 1]) {
        pairs.push([tasks[i].taskNumber, tasks[i + 1].taskNumber]);
      } else {
        pairs.push([tasks[i].taskNumber, null]);
      }
    }
    return pairs;
  },

  async checkAndUnlockNextPair(internId) {
    await DB.reloadAssignmentsAndSubmissions();
  },

  getCurrentPairIndex(internId) {
    const assignments = DB.Assignments.forIntern(internId);
    const assignedNumbers = assignments.map((a) => a.taskNumber);
    const TASK_PAIRS = this.getTaskPairs();

    for (let i = TASK_PAIRS.length - 1; i >= 0; i--) {
      const [a, b] = TASK_PAIRS[i];
      if (assignedNumbers.includes(a) || (b !== null && assignedNumbers.includes(b))) {
        return i;
      }
    }
    return -1;
  },

  getCompletionPercentage(internId) {
    const assignments = DB.Assignments.forIntern(internId);
    if (!assignments.length) return 0;
    const total = DB.Tasks.all().length || 20;
    const completed = assignments.filter((a) => a.status === 'Completed').length;
    return Math.round((completed / total) * 100);
  },

  getSummary(internId) {
    const assignments = DB.Assignments.forIntern(internId);
    const total = DB.Tasks.all().length || 20;
    const assigned = assignments.length;
    const completed = assignments.filter((a) => a.status === 'Completed').length;
    const pending = assignments.filter((a) => a.status === 'Pending Review').length;
    const inProgress = assignments.filter((a) => a.status === 'In Progress').length;
    const revision = assignments.filter((a) => a.status === 'Request Revision').length;
    const remaining = total - completed;

    return { total, assigned, completed, pending, inProgress, revision, remaining };
  },
};

window.Automation = Automation;
