/**
 * UI Utilities - Shared UI helper functions
 */

import { config } from '../config.js';
import { showToast as showToastComponent, clearAllToasts } from '../components/toast.js';
import { showError as showErrorComponent } from '../components/error-modal.js';

/**
 * Show a success/info toast message
 * @param {string} message - message to display
 * @param {string} type - 'success' | 'info' | 'warning' (default: 'success')
 * @param {number} duration - how long to show (ms)
 */
export function showToast(message, type = 'success', duration = config.TIMEOUTS.toast) {
  return showToastComponent(message, type, duration);
}

/**
 * Show an error notification
 * @param {string} message - error message
 * @param {string} title - optional error title
 */
export function showErrorNotification(message, title = 'Error') {
  return showErrorComponent(title, message);
}

/**
 * Show a warning notification
 * @param {string} message - warning message
 */
export function showWarningNotification(message, duration = config.TIMEOUTS.profileWarning) {
  return showToastComponent(message, 'warning', duration);
}

/**
 * Show a loading overlay with spinner and message
 * @param {string} message - main message
 * @param {string} step - optional step description (e.g., "Step 1/3: Detecting fields...")
 * @returns {HTMLElement} loading overlay element (store to dismiss later)
 */
export function showLoadingOverlay(message, step = null) {
  const overlay = document.createElement('div');
  overlay.className = 'loading-overlay';
  overlay.setAttribute('role', 'status');
  overlay.setAttribute('aria-live', 'polite');

  const spinner = document.createElement('div');
  spinner.className = 'loading-spinner';

  const spinnerDiv = document.createElement('div');
  spinnerDiv.className = 'spinner';

  const messageEl = document.createElement('div');
  messageEl.className = 'loading-spinner-text';
  messageEl.textContent = message;

  spinner.appendChild(spinnerDiv);
  spinner.appendChild(messageEl);

  if (step) {
    const stepEl = document.createElement('div');
    stepEl.className = 'loading-spinner-step';
    stepEl.textContent = step;
    spinner.appendChild(stepEl);
  }

  overlay.appendChild(spinner);
  document.body.appendChild(overlay);

  return overlay;
}

/**
 * Update loading overlay message
 * @param {HTMLElement} overlay - loading overlay element from showLoadingOverlay
 * @param {string} message - new main message
 * @param {string} step - new step description
 */
export function updateLoadingOverlay(overlay, message, step = null) {
  if (!overlay || !overlay.parentNode) return;

  const messageEl = overlay.querySelector('.loading-spinner-text');
  if (messageEl) messageEl.textContent = message;

  const stepEl = overlay.querySelector('.loading-spinner-step');
  if (step) {
    if (stepEl) {
      stepEl.textContent = step;
    } else {
      const newStepEl = document.createElement('div');
      newStepEl.className = 'loading-spinner-step';
      newStepEl.textContent = step;
      overlay.querySelector('.loading-spinner').appendChild(newStepEl);
    }
  } else if (stepEl) {
    stepEl.remove();
  }
}

/**
 * Dismiss a loading overlay
 * @param {HTMLElement} overlay - loading overlay element
 */
export function dismissLoadingOverlay(overlay) {
  if (!overlay || !overlay.parentNode) return;

  overlay.classList.add('loading-overlay-dismissing');
  setTimeout(() => {
    if (overlay.parentNode) {
      overlay.parentNode.removeChild(overlay);
    }
  }, 200);
}

/**
 * Clear all notifications
 */
export function clearAllNotifications() {
  clearAllToasts();
}
