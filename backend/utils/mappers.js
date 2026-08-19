/**
 * Map database rows to frontend-compatible objects (matches legacy db.js shape).
 */

function mapUser(row) {
  if (!row) return null;
  return {
    id: String(row.userID),
    email: row.email,
    name: row.name,
    phone: row.phoneNum || '',
    photo: row.image || '',
    role: row.role,
    status: row.status,
    createdAt: row.created_at,
  };
}

function mapIntern(row) {
  if (!row) return null;
  return {
    id: String(row.internID),
    userId: String(row.userID),
    university: row.university || '',
    course: row.course || '',
    startDate: row.startDate || '',
    endDate: row.endDate || '',
    createdAt: row.created_at || null,
  };
}

function mapTask(row) {
  if (!row) return null;
  return {
    id: String(row.taskID),
    taskNumber: row.taskOrder,
    title: row.title,
    description: row.description || '',
    due: row.due,
    dueDate: '',
    order: row.taskOrder,
    createdAt: row.created_at,
  };
}

function mapAssignment(row) {
  if (!row) return null;
  return {
    id: String(row.assignmentID),
    internId: String(row.internID),
    taskId: String(row.taskID),
    taskNumber: row.taskOrder,
    status: row.status,
    assignedAt: row.assignedAt,
    dueDate: row.dueDate || '',
    unlockedAt: row.assignedAt,
    createdAt: row.created_at,
  };
}

function mapSubmission(row, file) {
  if (!row) return null;
  return {
    id: String(row.submissionID),
    assignmentId: String(row.assignmentID),
    internId: String(row.internID),
    taskId: String(row.taskID),
    taskNumber: row.taskOrder,
    freeText: row.details || '',
    status: row.status,
    submittedAt: row.created_at,
    fileName: file?.fileName || '',
    fileType: file?.fileType || '',
    fileData: file ? `/api/files/${file.fileID}` : null,
  };
}

const ACTION_TO_STATUS = {
  completed: 'Completed',
  revision: 'Request Revision',
  Completed: 'Completed',
  'Request Revision': 'Request Revision',
};

const STATUS_TO_ACTION = {
  Completed: 'completed',
  'Request Revision': 'revision',
};

function mapReview(row) {
  if (!row) return null;
  return {
    id: String(row.reviewID),
    submissionId: String(row.submissionID),
    managerId: String(row.reviewerID),
    comments: row.feedback || '',
    status: ACTION_TO_STATUS[row.action] || row.action,
    reviewedAt: row.created_at,
  };
}

function mapDailyReport(row) {
  if (!row) return null;
  return {
    id: String(row.reportID),
    internId: String(row.internID),
    date: row.reportDate,
    tasksAssigned: row.taskAssigned || '',
    activities: row.Activities || '',
    responsibilities: row.Responsibilities || '',
    gained: row.Gained || '',
    improvement: row.Target || '',
    problemsFaced: row.Problem || '',
    additionalQuestions: row.Question || '',
    submittedAt: row.created_at,
  };
}

function mapNotification(row) {
  if (!row) return null;
  return {
    id: String(row.notificationID),
    userId: String(row.userID),
    message: row.message,
    type: row.type || 'info',
    link: row.link || '',
    read: Boolean(row.read),
    createdAt: row.created_at,
  };
}

module.exports = {
  mapUser,
  mapIntern,
  mapTask,
  mapAssignment,
  mapSubmission,
  mapReview,
  mapDailyReport,
  mapNotification,
  STATUS_TO_ACTION,
};
