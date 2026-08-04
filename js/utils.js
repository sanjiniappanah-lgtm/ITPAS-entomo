/**
 * ITPAS — Utility Functions
 */

const Utils = {
  // ── Date Formatting ───────────────────────────────────────────────────────
  formatDate(isoString) {
    if (!isoString) return '—';
    const d = new Date(isoString);
    return d.toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' });
  },

  formatDateTime(isoString) {
    if (!isoString) return '—';
    const d = new Date(isoString);
    return d.toLocaleString('en-MY', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  },

  timeAgo(isoString) {
    if (!isoString) return '';
    const diff = Date.now() - new Date(isoString).getTime();
    const mins = Math.floor(diff / 60000);
    const hrs = Math.floor(mins / 60);
    const days = Math.floor(hrs / 24);
    if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
    if (hrs > 0) return `${hrs} hour${hrs > 1 ? 's' : ''} ago`;
    if (mins > 0) return `${mins} minute${mins > 1 ? 's' : ''} ago`;
    return 'Just now';
  },

  today() {
    return new Date().toISOString().split('T')[0];
  },

  // ── Status Badge HTML ─────────────────────────────────────────────────────
  statusBadge(status) {
    const map = {
      'Not Available':    'badge-not-available',
      'In Progress':      'badge-in-progress',
      'Pending Review':   'badge-pending',
      'Completed':        'badge-completed',
      'Request Revision': 'badge-revision',
    };
    const cls = map[status] || 'badge-secondary';
    return `<span class="status-badge ${cls}">${status}</span>`;
  },

  // ── Toast Notifications ───────────────────────────────────────────────────
  toast(message, type = 'success', duration = 3500) {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = `toast toast-${type} show`;
    const icon = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' }[type] || 'ℹ';
    toast.innerHTML = `<span class="toast-icon">${icon}</span><span class="toast-msg">${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => { toast.classList.add('hiding'); setTimeout(() => toast.remove(), 400); }, duration);
  },

  // ── File Validation ───────────────────────────────────────────────────────
  ALLOWED_FILE_TYPES: ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/jpeg', 'image/png', 'image/gif'],
  MAX_FILE_SIZE_MB: 10,

  validateFile(file) {
    if (!this.ALLOWED_FILE_TYPES.includes(file.type)) {
      return { valid: false, message: 'Invalid file type. Allowed: PDF, DOCX, JPG, PNG, GIF.' };
    }
    if (file.size > this.MAX_FILE_SIZE_MB * 1024 * 1024) {
      return { valid: false, message: `File too large. Maximum size: ${this.MAX_FILE_SIZE_MB}MB.` };
    }
    return { valid: true };
  },

  fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => resolve(e.target.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  },

  getFileIcon(fileType) {
    if (!fileType) return '📄';
    if (fileType.includes('pdf')) return '📕';
    if (fileType.includes('word') || fileType.includes('docx')) return '📘';
    if (fileType.includes('image')) return '🖼️';
    return '📄';
  },

  // ── Dark Mode ─────────────────────────────────────────────────────────────
  initDarkMode() {
    const saved = localStorage.getItem('itpas_dark_mode');
    if (saved === '1') document.body.classList.add('dark-mode');
  },

  toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    localStorage.setItem('itpas_dark_mode', isDark ? '1' : '0');
    const btn = document.getElementById('dark-mode-toggle');
    if (btn) btn.innerHTML = isDark ? '☀️' : '🌙';
  },

  // ── Notification Bell ─────────────────────────────────────────────────────
  updateNotificationBadge() {
    const session = Auth.getSession();
    if (!session) return;
    const count = DB.Notifications.unreadCount(session.userId);
    const badge = document.getElementById('notif-badge');
    if (badge) {
      badge.textContent = count;
      badge.style.display = count > 0 ? 'flex' : 'none';
    }
  },

  renderNotificationDropdown(containerId) {
    const session = Auth.getSession();
    if (!session) return;
    const container = document.getElementById(containerId);
    if (!container) return;
    const notifications = DB.Notifications.forUser(session.userId).slice(0, 10);
    if (!notifications.length) {
      container.innerHTML = '<p class="notif-empty">No notifications yet.</p>';
      return;
    }
    container.innerHTML = notifications.map(n => `
      <div class="notif-item ${n.read ? 'read' : 'unread'}" onclick="Utils.markNotifRead('${n.id}', this)">
        <span class="notif-dot" style="background:var(--${n.type === 'success' ? 'success' : n.type === 'warning' ? 'warning' : n.type === 'danger' ? 'danger' : 'primary'})"></span>
        <div class="notif-content">
          <p>${n.message}</p>
          <small>${Utils.timeAgo(n.createdAt)}</small>
        </div>
      </div>
    `).join('');
  },

  markNotifRead(id, el) {
    DB.Notifications.markRead(id);
    if (el) el.classList.add('read');
    this.updateNotificationBadge();
  },

  // ── Pagination ────────────────────────────────────────────────────────────
  paginate(items, page, perPage = 10) {
    const total = items.length;
    const totalPages = Math.ceil(total / perPage);
    const start = (page - 1) * perPage;
    const end = start + perPage;
    return {
      items: items.slice(start, end),
      total,
      totalPages,
      page,
      perPage,
    };
  },

  renderPagination(containerId, currentPage, totalPages, onPage) {
    const container = document.getElementById(containerId);
    if (!container || totalPages <= 1) { if (container) container.innerHTML = ''; return; }
    let html = '<div class="pagination">';
    html += `<button onclick="(${onPage})(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>‹</button>`;
    for (let i = 1; i <= totalPages; i++) {
      html += `<button class="${i === currentPage ? 'active' : ''}" onclick="(${onPage})(${i})">${i}</button>`;
    }
    html += `<button onclick="(${onPage})(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}>›</button>`;
    html += '</div>';
    container.innerHTML = html;
  },

  // ── Search & Filter Helpers ───────────────────────────────────────────────
  searchInterns(query) {
    const interns = DB.Interns.allWithUsers();
    if (!query) return interns;
    const q = query.toLowerCase();
    return interns.filter(i =>
      i.user.name.toLowerCase().includes(q) ||
      i.user.email.toLowerCase().includes(q) ||
      i.university.toLowerCase().includes(q) ||
      i.course.toLowerCase().includes(q)
    );
  },

  // ── Avatar / Photo ────────────────────────────────────────────────────────
  avatarHtml(user, size = 40) {
    if (user && user.photo) {
      return `<img src="${user.photo}" alt="${user.name}" class="avatar" style="width:${size}px;height:${size}px;object-fit:cover;border-radius:50%;">`;
    }
    const initials = user ? user.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) : '?';
    const colors = ['#6366f1','#8b5cf6','#ec4899','#f59e0b','#10b981','#0ea5e9'];
    const color = colors[user ? user.name.charCodeAt(0) % colors.length : 0];
    return `<div class="avatar avatar-initials" style="width:${size}px;height:${size}px;background:${color};font-size:${Math.round(size*0.38)}px;">${initials}</div>`;
  },

  // ── Escape HTML ───────────────────────────────────────────────────────────
  escHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  },

  // ── Copy to Clipboard ─────────────────────────────────────────────────────
  copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => this.toast('Copied to clipboard!', 'success'));
  },
};

window.Utils = Utils;

// Initialize dark mode on every page load
document.addEventListener('DOMContentLoaded', () => Utils.initDarkMode());
