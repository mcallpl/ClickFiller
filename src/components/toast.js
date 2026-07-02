/**
 * Toast Notification System
 * Provides non-intrusive, auto-dismissing notifications
 */

const TOAST_DEFAULTS = {
  duration: 4000,
  position: 'bottom-right',
};

// Track active toasts for stacking
const activeToasts = [];

/**
 * Show a toast notification
 * @param {string} message - Message text
 * @param {string} type - 'info' | 'success' | 'error' | 'warning' (default: 'info')
 * @param {number} duration - Auto-dismiss time in ms (default: 4000)
 * @returns {HTMLElement} toast element
 */
export function showToast(message, type = 'info', duration = TOAST_DEFAULTS.duration) {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');
  toast.setAttribute('aria-atomic', 'true');

  // Icon based on type
  const icons = {
    info: '💡',
    success: '✓',
    error: '✕',
    warning: '⚠',
  };

  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || ''}</span>
    <span class="toast-message">${escapeHtml(message)}</span>
    <button class="toast-close" aria-label="Close notification">×</button>
  `;

  document.body.appendChild(toast);
  activeToasts.push(toast);

  // Position toast accounting for others
  updateToastPositions();

  // Close button
  toast.querySelector('.toast-close').addEventListener('click', () => {
    dismissToast(toast);
  });

  // Auto-dismiss
  const timeoutId = setTimeout(() => {
    dismissToast(toast);
  }, duration);

  // Store timeout ID so we can clear it
  toast.timeoutId = timeoutId;

  return toast;
}

/**
 * Dismiss a specific toast
 */
function dismissToast(toast) {
  if (!toast || !toast.parentNode) {
    return;
  }

  clearTimeout(toast.timeoutId);
  toast.classList.add('toast-dismissing');

  setTimeout(() => {
    if (toast.parentNode) {
      toast.parentNode.removeChild(toast);
    }
    const index = activeToasts.indexOf(toast);
    if (index > -1) {
      activeToasts.splice(index, 1);
    }
    updateToastPositions();
  }, 200);
}

/**
 * Update positions of all active toasts to stack vertically
 */
function updateToastPositions() {
  activeToasts.forEach((toast, index) => {
    const baseBottom = 24;
    const toastHeight = 56;
    const gap = 8;
    const bottom = baseBottom + (index * (toastHeight + gap));
    toast.style.bottom = bottom + 'px';
  });
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Clear all toasts
 */
export function clearAllToasts() {
  activeToasts.forEach(toast => dismissToast(toast));
}
