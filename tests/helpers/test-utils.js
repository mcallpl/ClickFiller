/**
 * Test utilities and helpers
 * Common functions for testing
 */

/**
 * Setup localStorage for a test
 * @param {Object} data - Data to pre-populate in storage
 */
export function setupLocalStorage(data = {}) {
  const storageData = { ...data };

  localStorage.getItem.mockImplementation((key) => {
    if (key in storageData) {
      return typeof storageData[key] === 'string'
        ? storageData[key]
        : JSON.stringify(storageData[key]);
    }
    return null;
  });

  localStorage.setItem.mockImplementation((key, value) => {
    storageData[key] = value;
  });

  localStorage.removeItem.mockImplementation((key) => {
    delete storageData[key];
  });

  localStorage.clear.mockImplementation(() => {
    Object.keys(storageData).forEach(key => delete storageData[key]);
  });

  return storageData;
}

/**
 * Mock fetch for API testing
 * @param {Object} options - Configuration for mock
 */
export function mockFetch(options = {}) {
  const {
    status = 200,
    json = {},
    error = null,
  } = options;

  if (error) {
    fetch.mockRejectedValueOnce(error);
  } else {
    fetch.mockResolvedValueOnce({
      ok: status >= 200 && status < 300,
      status,
      json: async () => json,
    });
  }
}

/**
 * Get the last fetch call arguments
 */
export function getLastFetchCall() {
  if (fetch.mock.calls.length === 0) {
    return null;
  }
  return fetch.mock.calls[fetch.mock.calls.length - 1];
}

/**
 * Assert that a value matches validation error
 * @param {string} value - Value to test
 * @param {Function} validator - Validator function
 * @param {boolean} shouldBeValid - Whether value should pass validation
 */
export function assertValidation(value, validator, shouldBeValid = true) {
  const result = validator.validate(value);
  if (shouldBeValid) {
    expect(result).toBe(true);
  } else {
    expect(result).toBe(false);
  }
}

/**
 * Create a test profile with optional overrides
 * @param {Object} overrides - Fields to override
 */
export function createTestProfile(overrides = {}) {
  return {
    firstName: 'Test',
    lastName: 'User',
    email: 'test@example.com',
    phone: '555-123-4567',
    zipCode: '12345',
    ...overrides,
  };
}

/**
 * Delay execution (for async tests)
 * @param {number} ms - Milliseconds to wait
 */
export function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
