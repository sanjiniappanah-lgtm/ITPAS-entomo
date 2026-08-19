const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'itpas_dev_secret';

function signToken(user) {
  return jwt.sign(
    { userId: user.userID, role: user.role, name: user.name, email: user.email },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  try {
    req.user = jwt.verify(header.slice(7), JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function requireManager(req, res, next) {
  if (req.user.role !== 'manager') {
    return res.status(403).json({ error: 'Manager access required' });
  }
  next();
}

module.exports = { signToken, authMiddleware, requireManager, JWT_SECRET };
