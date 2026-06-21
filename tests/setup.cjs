/**
 * Test environment setup (CommonJS)
 * Runs before all tests
 */

// Make jest global in ESM context
if (!global.jest) {
  // jest is already global when using Jest, but just in case
  global.jest = require('jest');
}

// Mock localStorage for tests
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};

Object.defineProperty(global, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

// Reset mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
  localStorageMock.getItem.mockReturnValue(null);
});

// Setup fetch mock globally
Object.defineProperty(global, 'fetch', {
  value: jest.fn(),
  writable: true,
});
