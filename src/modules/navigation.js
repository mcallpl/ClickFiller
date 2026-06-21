/**
 * Navigation Module - Handles view switching and nav button state
 */

import { config } from '../config.js';
import { eventBus } from '../event-bus.js';
import { stateManager } from '../state.js';
import { hasSavedResult } from '../canvas-fill.js';

let views = {};
let navBtns = [];

/**
 * Initialize navigation
 */
export function initNavigation() {
  // Cache DOM elements
  views = {
    capture: document.getElementById('capture-view'),
    result: document.getElementById('result-view'),
    profile: document.getElementById('profile-view'),
  };

  navBtns = document.querySelectorAll(`.${config.CLASS_NAMES.navBtn}`);

  // Set up nav button listeners
  navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const viewName = btn.dataset.view;
      showViewInternal(viewName);
    });
  });
}

/**
 * Show a specific view and handle state
 * @param {string} name - view name (capture, result, or profile)
 */
function showViewInternal(name) {
  // Hide all views
  Object.values(views).forEach(v => {
    v.classList.remove(config.CLASS_NAMES.active);
  });

  // Show the requested view
  if (views[name]) {
    views[name].classList.add(config.CLASS_NAMES.active);
  }

  // Update nav button states
  navBtns.forEach(btn => {
    btn.classList.toggle(config.CLASS_NAMES.active, btn.dataset.view === name);
  });

  // Update state
  stateManager.setState('currentView', name);

  // Emit event for other modules
  eventBus.emit('view:changed', { view: name });

  // Handle capture view cleanup
  if (name === config.VIEWS.capture) {
    // Reset capture view to clean state
    eventBus.emit('capture:reset', {});

    // Show resume button if there's saved work
    const resumeBtn = document.getElementById('resume-btn');
    if (resumeBtn) {
      resumeBtn.style.display = hasSavedResult() ? '' : 'none';
    }
  }
}

/**
 * Show a specific view (exported)
 * @param {string} name - view name (capture, result, or profile)
 */
export function showView(name) {
  showViewInternal(name);
}

/**
 * Get current view name
 * @returns {string} current view
 */
export function getCurrentView() {
  return stateManager.getState('currentView');
}
