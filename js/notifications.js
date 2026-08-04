/**
 * ITPAS — Notification Event Helpers
 * High-level helpers that create appropriate notification records
 * for common system events.
 */

const NotifyEvent = {
  // ── Intern notifications ──────────────────────────────────────────────────

  taskUnlocked(internUserId, taskNumA, taskNumB) {
    DB.Notifications.create({
      userId: internUserId,
      message: `🎉 Task ${taskNumA} & Task ${taskNumB} have been unlocked! You can now start working on them.`,
      type: 'success',
      link: '../intern/tasks.html',
    });
  },

  revisionRequested(internUserId, taskNum, managerFeedback) {
    DB.Notifications.create({
      userId: internUserId,
      message: `⚠️ Task ${taskNum} requires revision. Manager feedback: "${managerFeedback || 'Please review and resubmit.'}"`,
      type: 'warning',
      link: '../intern/tasks.html',
    });
  },

  feedbackAvailable(internUserId, taskNum) {
    DB.Notifications.create({
      userId: internUserId,
      message: `✅ Feedback is available for Task ${taskNum}. Check your task dashboard.`,
      type: 'info',
      link: '../intern/tasks.html',
    });
  },

  taskCompleted(internUserId, taskNum) {
    DB.Notifications.create({
      userId: internUserId,
      message: `🏆 Task ${taskNum} has been marked as Completed. Great work!`,
      type: 'success',
      link: '../intern/tasks.html',
    });
  },

  // ── Manager notifications ─────────────────────────────────────────────────

  newSubmission(internName, taskNum) {
    const managers = DB.Users.all().filter(u => u.role === 'manager');
    managers.forEach(mgr => {
      DB.Notifications.create({
        userId: mgr.id,
        message: `📥 ${internName} has submitted Task ${taskNum} for review.`,
        type: 'info',
        link: 'review-queue.html',
      });
    });
  },

  dailyReportSubmitted(internName) {
    const managers = DB.Users.all().filter(u => u.role === 'manager');
    managers.forEach(mgr => {
      DB.Notifications.create({
        userId: mgr.id,
        message: `📋 ${internName} has submitted a daily report.`,
        type: 'info',
        link: 'reports.html',
      });
    });
  },

  internRegistered(internName) {
    const managers = DB.Users.all().filter(u => u.role === 'manager');
    managers.forEach(mgr => {
      DB.Notifications.create({
        userId: mgr.id,
        message: `👤 New intern ${internName} has been registered. Task 1 & 2 have been auto-assigned.`,
        type: 'success',
        link: 'interns.html',
      });
    });
  },
};

window.NotifyEvent = NotifyEvent;
