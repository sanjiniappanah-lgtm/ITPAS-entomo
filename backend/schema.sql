-- ITPAS Database Schema (SQLite-compatible; also works on MySQL with minor type tweaks)

CREATE TABLE IF NOT EXISTS user (
  userID INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  password TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'intern',
  phoneNum TEXT,
  image TEXT,
  status TEXT DEFAULT 'active',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS intern (
  internID INTEGER PRIMARY KEY AUTOINCREMENT,
  userID INTEGER NOT NULL,
  university TEXT,
  course TEXT,
  startDate TEXT,
  endDate TEXT,
  FOREIGN KEY (userID) REFERENCES user(userID)
);

CREATE TABLE IF NOT EXISTS task (
  taskID INTEGER PRIMARY KEY AUTOINCREMENT,
  taskOrder INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  due INTEGER DEFAULT 7,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS taskAssign (
  assignmentID INTEGER PRIMARY KEY AUTOINCREMENT,
  internID INTEGER NOT NULL,
  taskID INTEGER NOT NULL,
  assignedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  dueDate TEXT,
  status TEXT DEFAULT 'In Progress',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (internID) REFERENCES intern(internID),
  FOREIGN KEY (taskID) REFERENCES task(taskID)
);

CREATE TABLE IF NOT EXISTS submission (
  submissionID INTEGER PRIMARY KEY AUTOINCREMENT,
  assignmentID INTEGER NOT NULL,
  details TEXT,
  status TEXT DEFAULT 'Pending Review',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (assignmentID) REFERENCES taskAssign(assignmentID)
);

CREATE TABLE IF NOT EXISTS submissionFile (
  fileID INTEGER PRIMARY KEY AUTOINCREMENT,
  submissionID INTEGER NOT NULL,
  fileName TEXT,
  filePath TEXT,
  fileType TEXT,
  fileSize INTEGER,
  uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (submissionID) REFERENCES submission(submissionID)
);

CREATE TABLE IF NOT EXISTS review (
  reviewID INTEGER PRIMARY KEY AUTOINCREMENT,
  submissionID INTEGER NOT NULL,
  reviewerID INTEGER NOT NULL,
  feedback TEXT,
  action TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (submissionID) REFERENCES submission(submissionID),
  FOREIGN KEY (reviewerID) REFERENCES user(userID)
);

CREATE TABLE IF NOT EXISTS dailyReport (
  reportID INTEGER PRIMARY KEY AUTOINCREMENT,
  internID INTEGER NOT NULL,
  reportDate TEXT,
  taskAssigned TEXT,
  Activities TEXT,
  Responsibilities TEXT,
  Gained TEXT,
  Target TEXT,
  Problem TEXT,
  Question TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (internID) REFERENCES intern(internID)
);

CREATE TABLE IF NOT EXISTS notification (
  notificationID INTEGER PRIMARY KEY AUTOINCREMENT,
  userID INTEGER NOT NULL,
  message TEXT,
  type TEXT DEFAULT 'info',
  link TEXT,
  read INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (userID) REFERENCES user(userID)
);
