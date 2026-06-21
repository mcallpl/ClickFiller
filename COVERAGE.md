# ClickFiller Test Coverage Baseline

## Overview

This document tracks the test coverage baseline for ClickFiller. Coverage is measured using Jest and reported in `coverage/` directory after running tests.

## Current Coverage Targets

### Global Minimum
- **Lines**: 70%
- **Functions**: 70%
- **Branches**: 70%
- **Statements**: 70%

### Core Modules (100% Required)
- `src/validation.js` - 100%
- `src/storage-manager.js` - 100%
- `src/config.js` - 100%

## Files Included in Coverage

Coverage tracking includes:
- `src/**/*.js` - All frontend source files
- `server/**/*.js` - All backend source files

### Files Excluded from Coverage
- `src/app.js` - Main entry point (tested via integration/e2e)
- `server/index.js` - Server startup (tested via API tests)
- `node_modules/` - Third-party dependencies
- `dist/` - Build output

## How to View Coverage

### Generate Coverage Report
```bash
npm test -- --coverage
```

### View HTML Report
After generating coverage report:
```bash
open coverage/index.html
```

The HTML report shows:
- Overall coverage percentage
- Coverage by file
- Coverage by line (green = covered, red = not covered)
- Coverage by branch

### Check Coverage Summary
```bash
npm test -- --coverage --silent
```

Shows summary table in terminal.

## Baseline Snapshot

### Establishment Date
Coverage baseline established during Phase 2 test suite creation.

### Expected Coverage Levels

**Validation Module** (`src/validation.js`)
- Lines: 100%
- Functions: 100%
- Branches: 100%
- Statements: 100%
- Tests: 140+ assertions

**Storage Manager** (`src/storage-manager.js`)
- Lines: 100%
- Functions: 100%
- Branches: 100%
- Statements: 100%
- Tests: 100+ assertions

**Configuration** (`src/config.js`)
- Lines: 100%
- Functions: 100%
- Branches: 100%
- Statements: 100%
- Tests: 80+ assertions

**API Validation** (`server/middleware/validation.js`)
- Lines: 100%
- Functions: 100%
- Branches: 95%+
- Statements: 100%
- Tests: 60+ assertions

### Total Test Count
- Unit Tests: 200+
- Integration Tests: 50+
- E2E Tests: 15+
- API Tests: 50+
- **Total: 315+ test cases**

## Coverage Tracking

Track coverage changes over time:

### After Each Release
1. Run full test suite: `npm test -- --coverage`
2. Compare metrics to baseline
3. Document any decreases in coverage
4. Commit coverage report snapshot

### When Adding Features
1. Add tests for new code
2. Ensure coverage meets minimum thresholds
3. Update this document if adding new modules

### When Refactoring
1. Maintain or improve coverage
2. Verify all tests still pass
3. Check coverage didn't decrease

## Continuous Integration

CI/CD pipeline checks coverage:

### Minimum Coverage Requirements
```
Global: 70% (minimum)
Branches: 70% (minimum)
```

### Strict Modules
```
validation.js: 100% (required)
storage-manager.js: 100% (required)
config.js: 100% (required)
```

Tests must pass locally and in CI/CD:
```bash
npm test # Must pass
npm test -- --coverage # Must meet thresholds
npm run lint # Must have no errors
npm run build # Must succeed
```

## Coverage Reports by Module

### src/validation.js
**Lines**: 247 total
- Email validation: 100%
- Phone validation: 100%
- SSN validation: 100%
- ZIP code validation: 100%
- Date validation: 100%
- Name field validation: 100%
- Address field validation: 100%
- Employment field validation: 100%
- Insurance field validation: 100%
- Emergency contact validation: 100%
- Custom field validation: 100%
- Sanitization: 100%

### src/storage-manager.js
**Lines**: 164 total
- Save profile: 100%
- Load profile: 100%
- Check profile exists: 100%
- Clear profile: 100%
- Get storage usage: 100%
- Check quota: 100%
- Get cleanup suggestions: 100%
- Error handling: 100%
- Custom field handling: 100%

### src/config.js
**Lines**: 71 total
- API endpoints: 100%
- Storage keys: 100%
- Timeouts: 100%
- Class names: 100%
- Messages: 100%
- Image processing: 100%
- Signature processing: 100%
- View names: 100%

### server/middleware/validation.js
**Lines**: 34 total
- Request body validation: 100%
- Image validation: 100%
- Image format validation: 100%
- Image size validation: 100%
- Profile validation: 100%
- Error responses: 100%

### server/index.js (Express setup)
**Excluded from coverage** - Server startup code
- Tested via API integration tests

### src/app.js (Main entry point)
**Excluded from coverage** - Main logic flow
- Tested via E2E tests

## Improving Coverage

### Finding Uncovered Code
1. Open HTML coverage report: `coverage/index.html`
2. Click on file name
3. Red highlighting shows uncovered lines
4. Hover for branch coverage details

### Adding Tests for Uncovered Lines

For each uncovered line:
1. Identify what path isn't tested
2. Write test case to exercise that path
3. Verify coverage increased
4. Run full test suite to ensure no regressions

### Example: Uncovered Error Path
```javascript
// Function to test
function parseData(json) {
  try {
    return JSON.parse(json);
  } catch (e) {
    throw new Error('Parse failed');
  }
}

// Test coverage (before)
// Happy path covered, error path not covered
it('should parse valid JSON', () => {
  expect(parseData('{"key":"value"}')).toEqual({ key: 'value' });
});

// Add test for error path
it('should throw on invalid JSON', () => {
  expect(() => parseData('invalid')).toThrow();
});
```

## Coverage Decline Prevention

### When Coverage Decreases
1. Identify which files/lines lost coverage
2. Check recent commits for changes
3. Add tests for uncovered code paths
4. Verify coverage threshold requirements met

### Preventing Accidental Coverage Loss
- Run `npm test -- --coverage` before committing
- Compare coverage metrics to baseline
- CI/CD blocks merge if thresholds not met
- Code review checks for new code without tests

## Coverage Statistics

### Test File Counts
- Unit tests: 4 files (400+ lines)
- Integration tests: 3 files (300+ lines)
- E2E tests: 1 file (200+ lines)
- API tests: 2 files (300+ lines)
- **Total: 1200+ lines of test code**

### Test to Code Ratio
- validation.js: 247 lines code, 140 lines tests (0.57 ratio)
- storage-manager.js: 164 lines code, 150 lines tests (0.91 ratio)
- config.js: 71 lines code, 100 lines tests (1.4 ratio)

Ratio > 0.5 indicates comprehensive testing.

## Future Coverage Goals

### Phase 3 Targets
- Maintain global 70% minimum
- Increase global coverage to 80%
- Add tests for UI components
- Test error boundaries
- Test accessibility

### Phase 4 Targets
- Achieve 85%+ global coverage
- Add visual regression tests
- Add performance benchmarks
- Add security testing
- E2E tests with real browser

## Maintenance

### Regular Tasks
- [ ] Run coverage report after each feature
- [ ] Update baseline after releases
- [ ] Review coverage trends monthly
- [ ] Fix declining coverage immediately
- [ ] Document coverage changes

### Quarterly Review
1. Analyze coverage trends
2. Identify low-coverage areas
3. Plan tests for high-risk code
4. Update coverage targets if needed

## Resources

- [Jest Coverage Documentation](https://jestjs.io/docs/en/coverage)
- [Code Coverage Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices#6-measure-and-analyze-code-coverage)
- [Coverage Thresholds](https://jestjs.io/docs/configuration#coveragethreshold-object)
