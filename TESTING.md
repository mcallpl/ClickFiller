# ClickFiller Testing Guide

## Overview

ClickFiller uses Jest as the test runner with comprehensive coverage across unit, integration, and end-to-end tests. This document explains how to run tests, add new tests, and understand the test structure.

## Running Tests

### Run all tests
```bash
npm test
```

### Run tests in watch mode (auto-rerun on file changes)
```bash
npm test -- --watch
```

### Run tests with coverage report
```bash
npm test -- --coverage
```

This generates an HTML coverage report in `coverage/index.html`.

### Run specific test file
```bash
npm test -- tests/unit/validation.test.js
```

### Run tests matching a pattern
```bash
npm test -- --testNamePattern="validation"
```

### Run with verbose output
```bash
npm test -- --verbose
```

## Test Structure

Tests are organized by type:

```
tests/
├── unit/                          # Unit tests for individual modules
│   ├── validation.test.js         # Tests for validation.js (100% coverage)
│   ├── storage-manager.test.js    # Tests for storage-manager.js (100% coverage)
│   └── config.test.js             # Tests for config.js (100% coverage)
├── integration/                   # Integration tests for features
│   ├── profile-flow.test.js       # Tests profile save/load/clear cycle
│   ├── capture-flow.test.js       # Tests image capture workflow
│   └── api-integration.test.js    # Tests API request/response flow
├── e2e/                           # End-to-end tests
│   └── complete-workflow.test.js  # Tests complete user workflow
├── api/                           # API endpoint tests
│   ├── health.test.js             # Tests GET /health endpoint
│   └── analyze.test.js            # Tests POST /api/analyze endpoint validation
└── helpers/                       # Test utilities
    ├── mock-data.js               # Mock profiles and form data
    └── test-utils.js              # Helper functions for testing
```

## Test Coverage Goals

Coverage thresholds are defined in `jest.config.js`:

- **Global minimum**: 70% (branches, functions, lines, statements)
- **validation.js**: 100% coverage required
- **storage-manager.js**: 100% coverage required
- **config.js**: 100% coverage required

Run coverage report to check current status:
```bash
npm test -- --coverage
```

## Writing New Tests

### Unit Test Template

```javascript
import { functionToTest } from '../../src/module.js';

describe('Module Name', () => {
  describe('functionToTest', () => {
    it('should do something specific', () => {
      const result = functionToTest('input');
      expect(result).toBe('expected output');
    });
  });
});
```

### Test Best Practices

1. **Test behavior, not implementation**
   - Focus on what the function does, not how it does it
   - Avoid testing private variables or internal state

2. **Use descriptive test names**
   - Test name should clearly state what is being tested
   - Good: "should reject email without @ symbol"
   - Bad: "should fail"

3. **Test one thing per test**
   - Each test should verify one specific behavior
   - Easier to debug when tests fail

4. **Arrange, Act, Assert pattern**
   ```javascript
   it('should save and load profile', () => {
     // Arrange: Set up test data
     const profile = { firstName: 'John' };
     
     // Act: Execute the function
     StorageManager.saveProfile(profile);
     const loaded = StorageManager.loadProfile();
     
     // Assert: Verify results
     expect(loaded.firstName).toBe('John');
   });
   ```

5. **Use mock data from helpers**
   - Import mock data from `tests/helpers/mock-data.js`
   - Don't hardcode test data in individual tests

6. **Test happy path AND error cases**
   - Happy path: normal, expected behavior
   - Error cases: invalid inputs, edge cases, error handling

7. **Keep tests fast**
   - Avoid real network calls, use fetch mock
   - Avoid real file I/O, use localStorage mock
   - Tests should complete in milliseconds

## Mock Data

Common test data is provided in `tests/helpers/mock-data.js`:

```javascript
import { VALID_PROFILE, INVALID_PROFILE, MOCK_IMAGE_BASE64 } from '../helpers/mock-data.js';
```

Available mocks:
- `VALID_PROFILE` - Complete valid profile
- `INVALID_PROFILE` - Profile with validation errors
- `PARTIAL_PROFILE` - Profile with only required fields
- `PROFILE_WITH_CUSTOM_FIELDS` - Profile with custom fields
- `MOCK_IMAGE_BASE64` - Sample form image (base64)
- `MOCK_FORM_RESPONSE` - Sample API response
- `OVERSIZED_IMAGE` - Image larger than 20MB limit

## Test Utilities

Helper functions in `tests/helpers/test-utils.js`:

```javascript
import { setupLocalStorage, mockFetch, assertValidation } from '../helpers/test-utils.js';

// Mock localStorage with initial data
setupLocalStorage({ key: 'value' });

// Mock fetch with response
mockFetch({ status: 200, json: { data: 'value' } });

// Get last fetch call arguments
const [url, options] = getLastFetchCall();

// Create test profile with overrides
const profile = createTestProfile({ firstName: 'Custom' });
```

## Testing Modules

### Testing validation.js

```javascript
import { validateProfile, getFieldError } from '../../src/validation.js';

it('should validate email format', () => {
  const result = validateProfile({ email: 'invalid-email' });
  expect(result.valid).toBe(false);
  expect(result.errors.email).toBeDefined();
});
```

### Testing StorageManager

```javascript
import { StorageManager } from '../../src/storage-manager.js';

it('should save and load profile', () => {
  StorageManager.saveProfile(VALID_PROFILE);
  const loaded = StorageManager.loadProfile();
  expect(loaded).toEqual(VALID_PROFILE);
});
```

### Testing API endpoints

```javascript
import { validateAnalyzeRequest } from '../../server/middleware/validation.js';

it('should reject missing image', () => {
  const req = { body: { profile: {} } };
  const res = { status: jest.fn(), json: jest.fn() };
  const next = jest.fn();

  validateAnalyzeRequest(req, res, next);
  expect(res.status).toHaveBeenCalledWith(400);
});
```

## Debugging Tests

### Run single test
```bash
npm test -- tests/unit/validation.test.js
```

### Debug test in Node debugger
```bash
node --inspect-brk node_modules/.bin/jest --runInBand
```

### Add debug output
```javascript
it('should work', () => {
  console.log('Debug info:', someValue);  // Will show in output with -verbose
  expect(someValue).toBeDefined();
});
```

### Check what fetch was called with
```javascript
const calls = fetch.mock.calls;
console.log(calls[0]); // [url, options]
```

## Continuous Integration

Tests should pass locally before pushing:

```bash
npm test && npm run lint && npm run build
```

CI/CD pipeline runs:
1. `npm test` - All tests must pass
2. `npm run lint` - No linting errors
3. `npm run build` - Build must succeed

## Adding Tests for New Features

When adding a new feature:

1. **Add unit tests** for the module in `tests/unit/`
2. **Add integration tests** for the feature flow in `tests/integration/`
3. **Update coverage report** if adding to core modules
4. **Run full test suite** to ensure nothing breaks

Example: Adding a new field validator

```javascript
// In src/validation.js - add VALIDATORS entry
export const validateProfile = (data) => { /* ... */ };

// In tests/unit/validation.test.js - add tests
describe('newField validation', () => {
  it('should accept valid newField values', () => {
    const result = validateProfile({ newField: 'valid' });
    expect(result.valid).toBe(true);
  });

  it('should reject invalid newField values', () => {
    const result = validateProfile({ newField: 'invalid' });
    expect(result.valid).toBe(false);
  });
});
```

## Coverage Reports

After running tests with coverage:

```bash
npm test -- --coverage
```

View HTML report:
```bash
open coverage/index.html
```

### Improving Coverage

To see which lines are not covered:
1. Open `coverage/index.html` in browser
2. Click on file to see uncovered lines (highlighted in red)
3. Add tests for those code paths

## Common Issues

### Test timeout
- Tests run too long: Increase timeout
  ```javascript
  it('should complete', (done) => {
    // test
  }, 10000); // 10 second timeout
  ```

### localStorage mock not working
- Make sure to call `setupLocalStorage()` in beforeEach
- Clear mocks in beforeEach: `jest.clearAllMocks()`

### Fetch mock not working
- Import and clear in each test: `fetch.mockClear()`
- Use `mockResolvedValueOnce` or `mockRejectedValueOnce` for single call

### Tests passing locally but failing in CI
- May be timing related: add delays with `await delay(100)`
- Check for missing jest setup: ensure `tests/setup.js` is loaded

## Performance Benchmarks

Performance tests are documented in `PERFORMANCE_BASELINE.md`. For any changes affecting performance, run:

```bash
npm test -- tests/performance/
```

## Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Testing Library](https://testing-library.com/)
- [JavaScript Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)
