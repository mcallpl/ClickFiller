/**
 * Central State Manager - Replaces global variables
 * Provides a clean interface for state management with observers
 */

class StateManager {
  constructor() {
    this.state = {
      capturedImageData: null,
      cropper: null,
      currentView: 'capture',
      isProcessing: false,
      lastError: null,
    };
    this.observers = [];
  }

  /**
   * Get the entire state or a nested value
   * @param {string} path - dot notation path (e.g., 'capturedImageData' or 'state.nested.value')
   * @returns {any} The state value at the path
   */
  getState(path = null) {
    if (!path) {
      return this.state;
    }

    const keys = path.split('.');
    let value = this.state;
    for (const key of keys) {
      if (value && typeof value === 'object') {
        value = value[key];
      } else {
        return undefined;
      }
    }
    return value;
  }

  /**
   * Set a state value and notify observers
   * @param {string} path - dot notation path
   * @param {any} value - new value
   */
  setState(path, value) {
    const keys = path.split('.');
    const lastKey = keys.pop();

    let target = this.state;
    for (const key of keys) {
      if (!(key in target) || typeof target[key] !== 'object') {
        target[key] = {};
      }
      target = target[key];
    }

    const oldValue = target[lastKey];
    target[lastKey] = value;

    // Notify observers only if value actually changed
    if (oldValue !== value) {
      this.notifyObservers(path, value, oldValue);
    }
  }

  /**
   * Reset all state to initial values
   */
  resetState() {
    this.state = {
      capturedImageData: null,
      cropper: null,
      currentView: 'capture',
      isProcessing: false,
      lastError: null,
    };
    this.notifyObservers('*', null, null);
  }

  /**
   * Subscribe to state changes
   * @param {Function} callback - called with (path, newValue, oldValue)
   * @returns {Function} unsubscribe function
   */
  subscribe(callback) {
    this.observers.push(callback);

    // Return unsubscribe function
    return () => {
      const index = this.observers.indexOf(callback);
      if (index > -1) {
        this.observers.splice(index, 1);
      }
    };
  }

  /**
   * Notify all observers of a state change
   * @private
   */
  notifyObservers(path, newValue, oldValue) {
    this.observers.forEach(callback => {
      try {
        callback(path, newValue, oldValue);
      } catch (err) {
        console.error('Observer callback error:', err);
      }
    });
  }
}

// Export singleton instance
export const stateManager = new StateManager();

export default stateManager;
