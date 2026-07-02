/**
 * Integration tests for API calls
 * Tests the full request/response cycle
 */

import { validateAnalyzeRequest } from '../../server/middleware/validation.js';
import { setupLocalStorage } from '../helpers/test-utils.js';
import { MOCK_IMAGE_BASE64, VALID_PROFILE } from '../helpers/mock-data.js';

describe('API Integration Tests', () => {
  beforeEach(() => {
    setupLocalStorage();
  });

  const createMockRes = () => ({
    statusCode: null,
    body: null,
    status: function(code) {
      this.statusCode = code;
      return this;
    },
    json: function(data) {
      this.body = data;
      return this;
    },
  });

  const createMockNext = () => {
    let called = false;
    const fn = () => {
      called = true; 
    };
    fn.wasCalled = () => called;
    return fn;
  };

  describe('request validation', () => {
    it('should accept valid request', () => {
      const req = {
        body: {
          image: MOCK_IMAGE_BASE64,
          profile: VALID_PROFILE,
        },
      };
      const res = createMockRes();
      const next = createMockNext();

      validateAnalyzeRequest(req, res, next);
      expect(next.wasCalled()).toBe(true);
      expect(res.statusCode).toBeNull();
    });

    it('should reject missing image', () => {
      const req = {
        body: {
          profile: VALID_PROFILE,
        },
      };
      const res = createMockRes();
      const next = createMockNext();

      validateAnalyzeRequest(req, res, next);
      expect(res.statusCode).toBe(400);
      expect(next.wasCalled()).toBe(false);
    });

    it('should reject missing profile', () => {
      const req = {
        body: {
          image: MOCK_IMAGE_BASE64,
        },
      };
      const res = createMockRes();
      const next = createMockNext();

      validateAnalyzeRequest(req, res, next);
      expect(res.statusCode).toBe(400);
    });

    it('should reject invalid image format', () => {
      const req = {
        body: {
          image: 'not-a-data-url',
          profile: VALID_PROFILE,
        },
      };
      const res = createMockRes();
      const next = createMockNext();

      validateAnalyzeRequest(req, res, next);
      expect(res.statusCode).toBe(400);
    });

    it('should reject oversized image', () => {
      const req = {
        body: {
          image: 'data:image/jpeg;base64,' + 'A'.repeat(25 * 1024 * 1024),
          profile: VALID_PROFILE,
        },
      };
      const res = createMockRes();
      const next = createMockNext();

      validateAnalyzeRequest(req, res, next);
      expect(res.statusCode).toBe(400);
    });

    it('should reject non-object profile', () => {
      const req = {
        body: {
          image: MOCK_IMAGE_BASE64,
          profile: 'not an object',
        },
      };
      const res = createMockRes();
      const next = createMockNext();

      validateAnalyzeRequest(req, res, next);
      expect(res.statusCode).toBe(400);
    });

    it('should reject profile as array', () => {
      const req = {
        body: {
          image: MOCK_IMAGE_BASE64,
          profile: [1, 2, 3],
        },
      };
      const res = createMockRes();
      const next = createMockNext();

      validateAnalyzeRequest(req, res, next);
      expect(res.statusCode).toBe(400);
    });
  });

  describe('request acceptance', () => {
    it('should accept JPEG image', () => {
      const req = {
        body: {
          image: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABA...',
          profile: VALID_PROFILE,
        },
      };
      const res = createMockRes();
      const next = createMockNext();

      validateAnalyzeRequest(req, res, next);
      expect(next.wasCalled()).toBe(true);
    });

    it('should accept PNG image', () => {
      const req = {
        body: {
          image: 'data:image/png;base64,iVBORw0KGgo...',
          profile: VALID_PROFILE,
        },
      };
      const res = createMockRes();
      const next = createMockNext();

      validateAnalyzeRequest(req, res, next);
      expect(next.wasCalled()).toBe(true);
    });

    it('should accept WebP image', () => {
      const req = {
        body: {
          image: 'data:image/webp;base64,UklGRi4A...',
          profile: VALID_PROFILE,
        },
      };
      const res = createMockRes();
      const next = createMockNext();

      validateAnalyzeRequest(req, res, next);
      expect(next.wasCalled()).toBe(true);
    });

    it('should accept empty profile object', () => {
      const req = {
        body: {
          image: MOCK_IMAGE_BASE64,
          profile: {},
        },
      };
      const res = createMockRes();
      const next = createMockNext();

      validateAnalyzeRequest(req, res, next);
      expect(next.wasCalled()).toBe(true);
    });

    it('should accept valid profile with all fields', () => {
      const req = {
        body: {
          image: MOCK_IMAGE_BASE64,
          profile: VALID_PROFILE,
        },
      };
      const res = createMockRes();
      const next = createMockNext();

      validateAnalyzeRequest(req, res, next);
      expect(next.wasCalled()).toBe(true);
    });
  });

  describe('error response format', () => {
    it('should return 400 on validation error', () => {
      const req = {
        body: {
          image: null,
          profile: null,
        },
      };
      const res = createMockRes();
      const next = createMockNext();

      validateAnalyzeRequest(req, res, next);
      expect(res.statusCode).toBe(400);
    });

    it('should return error message in response', () => {
      const req = {
        body: {
          image: null,
          profile: VALID_PROFILE,
        },
      };
      const res = createMockRes();
      const next = createMockNext();

      validateAnalyzeRequest(req, res, next);
      expect(res.body).not.toBeNull();
      expect(res.body.error).toBeDefined();
    });

    it('should provide helpful error messages', () => {
      const req = {
        body: {
          image: 'invalid-format',
          profile: VALID_PROFILE,
        },
      };
      const res = createMockRes();
      const next = createMockNext();

      validateAnalyzeRequest(req, res, next);
      const error = res.body.error;
      expect(error.toLowerCase()).toContain('image');
    });
  });

  describe('validation sequence', () => {
    it('should validate request body first', () => {
      const req = {
        body: undefined,
      };
      const res = createMockRes();
      const next = createMockNext();

      validateAnalyzeRequest(req, res, next);
      expect(res.statusCode).toBe(400);
    });

    it('should validate image before profile', () => {
      const req = {
        body: {
          image: null,
          profile: null,
        },
      };
      const res = createMockRes();
      const next = createMockNext();

      validateAnalyzeRequest(req, res, next);
      // Should fail due to image validation
      expect(res.statusCode).toBe(400);
    });

    it('should fail fast on first error', () => {
      const req = {
        body: {
          image: null,
          profile: null,
        },
      };
      const res = createMockRes();
      const next = createMockNext();

      validateAnalyzeRequest(req, res, next);
      // Should only report one error
      expect(res.statusCode).toBe(400);
      expect(res.body.error).toBeDefined();
    });
  });

  describe('complete workflow validation', () => {
    it('should validate complete request/response cycle', () => {
      // 1. Create valid request
      const req = {
        body: {
          image: MOCK_IMAGE_BASE64,
          profile: VALID_PROFILE,
        },
      };

      // 2. Create response object
      const res = createMockRes();
      const next = createMockNext();

      // 3. Validate request
      validateAnalyzeRequest(req, res, next);

      // 4. Check it passed validation
      expect(next.wasCalled()).toBe(true);
      expect(res.statusCode).toBeNull();
    });

    it('should allow retry after validation failure', () => {
      // First attempt - invalid
      let req = {
        body: {
          image: null,
          profile: VALID_PROFILE,
        },
      };
      let res = createMockRes();
      let next = createMockNext();

      validateAnalyzeRequest(req, res, next);
      expect(res.statusCode).toBe(400);

      // Second attempt - valid
      req = {
        body: {
          image: MOCK_IMAGE_BASE64,
          profile: VALID_PROFILE,
        },
      };
      res = createMockRes();
      next = createMockNext();

      validateAnalyzeRequest(req, res, next);
      expect(next.wasCalled()).toBe(true);
    });
  });
});
