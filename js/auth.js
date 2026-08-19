/**
 * ITPAS — Authentication & Session Management
 */

const SESSION_KEY = 'itpas_session';

const Auth = {
  async login(identifier, password) {
    try {
      const res = await API.login(identifier, password);
      if (!res.success) return { success: false, message: res.message };

      const session = {
        userId: res.session.userId,
        role: res.session.role,
        name: res.session.name,
        email: res.session.email,
        token: res.token,
        loggedInAt: res.session.loggedInAt,
      };
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
      await DB.init();
      return { success: true, session };
    } catch (err) {
      return { success: false, message: err.message || 'Login failed' };
    }
  },

  logout() {
    sessionStorage.removeItem(SESSION_KEY);
    window.location.href = rootPath() + 'index.html';
  },

  getSession() {
    try {
      return JSON.parse(sessionStorage.getItem(SESSION_KEY)) || null;
    } catch {
      return null;
    }
  },

  isLoggedIn() {
    return !!this.getSession()?.token;
  },

  currentUser() {
    const session = this.getSession();
    if (!session) return null;
    return DB.Users.find(session.userId);
  },

  requireAuth() {
    if (!this.isLoggedIn()) {
      window.location.href = rootPath() + 'index.html';
      return false;
    }
    return true;
  },

  async requireRole(role) {
    if (!this.requireAuth()) return false;
    await DB.init();
    const session = this.getSession();
    if (session.role !== role) {
      if (session.role === 'manager') {
        window.location.href = rootPath() + 'manager/dashboard.html';
      } else {
        window.location.href = rootPath() + 'intern/dashboard.html';
      }
      return false;
    }
    return true;
  },

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

function rootPath() {
  const pathParts = window.location.pathname.split('/');
  if (pathParts.some((p) => p === 'manager' || p === 'intern')) {
    return '../';
  }
  return '';
}

window.Auth = Auth;
window.rootPath = rootPath;
