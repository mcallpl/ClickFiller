/**
 * Event Bus - Decouples modules through event-based communication
 */

class EventBus {
  constructor() {
    this.listeners = {};
  }

  /**
   * Register a listener for an event
   * @param {string} event - event name
   * @param {Function} callback - listener function
   * @returns {Function} unsubscribe function
   */
  on(event, callback) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);

    // Return unsubscribe function
    return () => {
      this.off(event, callback);
    };
  }

  /**
   * Unregister a listener
   * @param {string} event - event name
   * @param {Function} callback - listener function
   */
  off(event, callback) {
    if (!this.listeners[event]) {
      return;
    }

    const index = this.listeners[event].indexOf(callback);
    if (index > -1) {
      this.listeners[event].splice(index, 1);
    }

    // Clean up empty arrays
    if (this.listeners[event].length === 0) {
      delete this.listeners[event];
    }
  }

  /**
   * Emit an event
   * @param {string} event - event name
   * @param {any} data - event data
   */
  emit(event, data = null) {
    if (!this.listeners[event]) {
      return;
    }

    this.listeners[event].forEach(callback => {
      try {
        callback(data);
      } catch (err) {
        console.error(`EventBus: Error in listener for '${event}':`, err);
      }
    });
  }

  /**
   * Register a one-time listener
   * @param {string} event - event name
   * @param {Function} callback - listener function
   */
  once(event, callback) {
    const wrapper = (data) => {
      callback(data);
      this.off(event, wrapper);
    };
    this.on(event, wrapper);
  }
}

// Export singleton instance
export const eventBus = new EventBus();

export default eventBus;
