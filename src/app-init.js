/**
 * App Initialization - Global app setup
 */

import { eventBus } from './event-bus.js';
import { stateManager } from './state.js';

/**
 * Initialize the app
 */
export function initializeApp() {
  // Subscribe to state changes for debugging (can be removed in production)
  if (process.env.DEBUG) {
    stateManager.subscribe((path, newValue, oldValue) => {
      console.debug(`State change: ${path}`, { newValue, oldValue });
    });
  }

  // Subscribe to events for debugging (can be removed in production)
  if (process.env.DEBUG) {
    const originalEmit = eventBus.emit.bind(eventBus);
    eventBus.emit = function (event, data) {
      console.debug(`Event: ${event}`, data);
      return originalEmit(event, data);
    };
  }
}
