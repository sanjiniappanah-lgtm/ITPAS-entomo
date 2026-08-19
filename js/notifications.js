/**
 * ITPAS — Notification Event Helpers
 * Notifications are created server-side; these are no-op stubs for compatibility.
 */

const NotifyEvent = {
  taskUnlocked() {},
  revisionRequested() {},
  feedbackAvailable() {},
  taskCompleted() {},
  newSubmission() {},
  dailyReportSubmitted() {},
  internRegistered() {},
};

window.NotifyEvent = NotifyEvent;
