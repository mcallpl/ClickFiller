/**
 * Error Handler Module - Centralized error handling
 * Replaces alert() calls with user-friendly notifications
 */

import { eventBus } from '../event-bus.js';
import { showErrorNotification } from './ui-utils.js';

/**
 * Initialize error handling
 */
export function initErrorHandling() {
  // Listen for error events from other modules
  eventBus.on('error:occurred', (data) => {
    handleError(data);
  });

  // Catch unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled rejection:', event.reason);
    eventBus.emit('error:occurred', {
      message: event.reason?.message || 'An unexpected error occurred',
      userFacing: true,
    });
  });

  // Catch global errors
  window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
    // Only show user-facing message for certain errors
    if (event.error?.message && !event.error.message.includes('ResizeObserver')) {
      eventBus.emit('error:occurred', {
        message: event.error.message,
        userFacing: true,
      });
    }
  });
}

/**
 * Handle error event
 * @param {Object} data - error data
 * @param {string} data.message - error message
 * @param {string} data.title - optional error title
 * @param {boolean} data.userFacing - whether to show to user
 * @param {Object} data.action - optional { label: string, callback: function }
 */
function handleError(data) {
  const { message, title = 'Error', userFacing = false, action = null } = data;

  // Log to console always
  console.error('Application error:', message);

  // Show to user if marked as user-facing. Forward the optional action so the
  // modal's guiding button (e.g. "Go to Profile") actually renders.
  if (userFacing && message) {
    showErrorNotification(message, title, action);
  }
}
