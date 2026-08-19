/**
 * ITPAS — API Client
 * Communicates with the Express backend.
 */

const API = {
  BASE: '', // same origin when served by Express

  getToken() {
    try {
      const session = JSON.parse(sessionStorage.getItem('itpas_session'));
      return session?.token || null;
    } catch {
      return null;
    }
  },

  setToken(token) {
    const session = JSON.parse(sessionStorage.getItem('itpas_session') || '{}');
    session.token = token;
    sessionStorage.setItem('itpas_session', JSON.stringify(session));
  },

  async request(path, options = {}) {
    const headers = { ...(options.headers || {}) };
    const token = this.getToken();
    if (token) headers.Authorization = `Bearer ${token}`;

    if (options.body && !(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(options.body);
    }

    const res = await fetch(this.BASE + path, { ...options, headers });

    if (res.status === 401 && path !== '/api/auth/login') {
      sessionStorage.removeItem('itpas_session');
      if (!window.location.pathname.endsWith('index.html') && window.location.pathname !== '/') {
        window.location.href = rootPath() + 'index.html';
      }
      throw new Error('Session expired');
    }

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || data.message || `Request failed (${res.status})`);
    }
    return data;
  },

  login(identifier, password) {
    return this.request('/api/auth/login', {
      method: 'POST',
      body: { identifier, password },
    });
  },

  getMe() {
    return this.request('/api/auth/me');
  },

  bootstrap() {
    return this.request('/api/bootstrap');
  },

  updateUser(id, data) {
    return this.request(`/api/users/${id}`, { method: 'PUT', body: data });
  },

  createIntern(data) {
    return this.request('/api/interns', { method: 'POST', body: data });
  },

  updateIntern(id, data) {
    return this.request(`/api/interns/${id}`, { method: 'PUT', body: data });
  },

  deleteIntern(id) {
    return this.request(`/api/interns/${id}`, { method: 'DELETE' });
  },

  resetInternPassword(id, newPassword) {
    return this.request(`/api/interns/${id}/reset-password`, { method: 'POST', body: { newPassword } });
  },

  updateInternStatus(id, status) {
    return this.request(`/api/interns/${id}/status`, { method: 'PUT', body: { status } });
  },

  overrideUnlockTask(internId, taskId) {
    return this.request(`/api/interns/${internId}/unlock-task`, { method: 'POST', body: { taskId } });
  },

  createTask(data) {
    return this.request('/api/tasks', { method: 'POST', body: data });
  },

  updateTask(id, data) {
    return this.request(`/api/tasks/${id}`, { method: 'PUT', body: data });
  },

  deleteTask(id) {
    return this.request(`/api/tasks/${id}`, { method: 'DELETE' });
  },

  reorderTasks(orderedIds) {
    return this.request('/api/tasks/reorder', { method: 'POST', body: { orderedIds } });
  },

  createSubmission(formData) {
    return this.request('/api/submissions', { method: 'POST', body: formData });
  },

  createReview(data) {
    return this.request('/api/reviews', { method: 'POST', body: data });
  },

  createDailyReport(data) {
    return this.request('/api/daily-reports', { method: 'POST', body: data });
  },

  markNotificationRead(id) {
    return this.request(`/api/notifications/${id}/read`, { method: 'PUT' });
  },

  markAllNotificationsRead() {
    return this.request('/api/notifications/read-all', { method: 'PUT' });
  },
};

window.API = API;
