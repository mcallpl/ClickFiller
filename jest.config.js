export default {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/tests/setup.cjs'],
  testMatch: ['**/tests/**/*.test.js'],
  collectCoverageFrom: [
    'src/**/*.js',
    'server/**/*.js',
    '!src/app.js',
    '!server/index.js',
  ],
  coverageThreshold: {
    global: {
      branches: 60,
      functions: 60,
      lines: 60,
      statements: 60,
    },
    './src/validation.js': {
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100,
    },
    './src/storage-manager.js': {
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100,
    },
    './src/config.js': {
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100,
    },
  },
  moduleFileExtensions: ['js'],
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
  coverageReporters: ['text', 'text-summary', 'html', 'json'],
  coverageDirectory: 'coverage',
  // Transform ESM source/tests to CJS via babel-jest (see babel.config.cjs).
  // The previous `transform: {}` disabled all transformation, which made every
  // ESM `import` throw "Cannot use import statement outside a module" and
  // prevented 7 of 9 test suites from loading at all.
  transform: {
    '^.+\\.js$': 'babel-jest',
  },
};
