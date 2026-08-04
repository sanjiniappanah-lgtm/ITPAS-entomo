/**
 * ITPAS — Authentication & Session Management
 * Uses sessionStorage for session (clears on tab close).
 */

const SESSION_KEY = 'itpas_session';

const Auth = {
  // ── Login ────────────────────────────────────────────────────────────────
  login(identifier, password) {
    const user = DB.Users.authenticate(identifier, password);
    if (!user) return { success: false, message: 'Invalid credentials. Please try again.' };

    const session = {
      userId: user.id,
      role: user.role,
      name: user.name,
      email: user.email,
      loggedInAt: new Date().toISOString(),
    };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return { success: true, session };
  },

  // ── Logout ───────────────────────────────────────────────────────────────
  logout() {
    sessionStorage.removeItem(SESSION_KEY);
    window.location.href = rootPath() + 'index.html';
  },

  // ── Get current session ──────────────────────────────────────────────────
  getSession() {
    try {
      return JSON.parse(sessionStorage.getItem(SESSION_KEY)) || null;
    } catch { return null; }
  },

  // ── Check if logged in ───────────────────────────────────────────────────
  isLoggedIn() {
    return !!this.getSession();
  },

  // ── Get current user object ──────────────────────────────────────────────
  currentUser() {
    const session = this.getSession();
    if (!session) return null;
    return DB.Users.find(session.userId);
  },

  // ── Require login (redirect if not) ─────────────────────────────────────
  requireAuth() {
    if (!this.isLoggedIn()) {
      window.location.href = rootPath() + 'index.html';
      return false;
    }
    return true;
  },

  // ── Require specific role ────────────────────────────────────────────────
  requireRole(role) {
    if (!this.requireAuth()) return false;
    const session = this.getSession();
    if (session.role !== role) {
      // Redirect to correct dashboard
      if (session.role === 'manager') {
        window.location.href = rootPath() + 'manager/dashboard.html';
      } else {
        window.location.href = rootPath() + 'intern/dashboard.html';
      }
      return false;
    }
    return true;
  },

  // ── Redirect if already logged in (for login page) ──────────────────────
  redirectIfLoggedIn() {
    if (!this.isLoggedIn()) return;
    const session = this.getSession();
    if (session.role === 'manager') {
      window.location.href = 'manager/dashboard.html';
    } else {
      window.location.href = 'intern/dashboard.html';
    }
  },
};

// ── Utility: compute relative root path based on current page depth
function rootPath() {
  const depth = window.location.pathname.split('/').filter(Boolean).length;
  // If we're at root level (e.g. index.html) depth differs
  const pathParts = window.location.pathname.split('/');
  // Count how many directories deep we are from the project root
  // Project root contains index.html, manager/, intern/, js/, css/
  if (pathParts.some(p => p === 'manager' || p === 'intern')) {
    return '../';
  }
  return '';
}

window.Auth = Auth;
window.rootPath = rootPath;
