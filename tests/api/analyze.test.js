/**
 * API tests for form analyze endpoint
 * Tests POST /api/analyze validation and request handling
 */

import { validateAnalyzeRequest } from '../../server/middleware/validation.js';
import { MOCK_IMAGE_BASE64, VALID_PROFILE, OVERSIZED_IMAGE } from '../helpers/mock-data.js';

describe('Form Analyze Endpoint Validation', () => {
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

  describe('validateAnalyzeRequest middleware', () => {
    describe('valid requests', () => {
      it('should allow valid request with image and profile', () => {
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

      it('should allow valid JPEG image', () => {
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

      it('should allow valid PNG image', () => {
        const req = {
          body: {
            image: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA...',
            profile: VALID_PROFILE,
          },
        };
        const res = createMockRes();
        const next = createMockNext();

        validateAnalyzeRequest(req, res, next);
        expect(next.wasCalled()).toBe(true);
      });

      it('should allow any image/* format', () => {
        const req = {
          body: {
            image: 'data:image/webp;base64,UklGRmYAAABXRUJQVlA4...',
            profile: VALID_PROFILE,
          },
        };
        const res = createMockRes();
        const next = createMockNext();

        validateAnalyzeRequest(req, res, next);
        expect(next.wasCalled()).toBe(true);
      });

      it('should allow profile with minimal fields', () => {
        const req = {
          body: {
            image: MOCK_IMAGE_BASE64,
            profile: { firstName: 'John' },
          },
        };
        const res = createMockRes();
        const next = createMockNext();

        validateAnalyzeRequest(req, res, next);
        expect(next.wasCalled()).toBe(true);
      });

      it('should allow profile with all fields', () => {
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

    describe('missing body', () => {
      it('should reject request without body', () => {
        const req = { body: undefined };
        const res = createMockRes();
        const next = createMockNext();

        validateAnalyzeRequest(req, res, next);
        expect(res.statusCode).toBe(400);
        expect(next.wasCalled()).toBe(false);
      });

      it('should reject request with null body', () => {
        const req = { body: null };
        const res = createMockRes();
        const next = createMockNext();

        validateAnalyzeRequest(req, res, next);
        expect(res.statusCode).toBe(400);
      });

      it('should reject non-JSON body', () => {
        const req = { body: 'not json' };
        const res = createMockRes();
        const next = createMockNext();

        validateAnalyzeRequest(req, res, next);
        expect(res.statusCode).toBe(400);
      });
    });

    describe('missing image', () => {
      it('should reject request without image', () => {
        const req = {
          body: {
            profile: VALID_PROFILE,
          },
        };
        const res = createMockRes();
        const next = createMockNext();

        validateAnalyzeRequest(req, res, next);
        expect(res.statusCode).toBe(400);
      });

      it('should reject request with null image', () => {
        const req = {
          body: {
            image: null,
            profile: VALID_PROFILE,
          },
        };
        const res = createMockRes();
        const next = createMockNext();

        validateAnalyzeRequest(req, res, next);
        expect(res.statusCode).toBe(400);
      });

      it('should reject request with empty string image', () => {
        const req = {
          body: {
            image: '',
            profile: VALID_PROFILE,
          },
        };
        const res = createMockRes();
        const next = createMockNext();

        validateAnalyzeRequest(req, res, next);
        expect(res.statusCode).toBe(400);
      });

      it('should reject non-string image', () => {
        const req = {
          body: {
            image: { data: 'base64...' },
            profile: VALID_PROFILE,
          },
        };
        const res = createMockRes();
        const next = createMockNext();

        validateAnalyzeRequest(req, res, next);
        expect(res.statusCode).toBe(400);
      });

      it('should reject numeric image', () => {
        const req = {
          body: {
            image: 12345,
            profile: VALID_PROFILE,
          },
        };
        const res = createMockRes();
        const next = createMockNext();

        validateAnalyzeRequest(req, res, next);
        expect(res.statusCode).toBe(400);
      });
    });

    describe('invalid image format', () => {
      it('should reject image without data: prefix', () => {
        const req = {
          body: {
            image: 'iVBORw0KGgoAAAANSUhEUgAAAA...',
            profile: VALID_PROFILE,
          },
        };
        const res = createMockRes();
        const next = createMockNext();

        validateAnalyzeRequest(req, res, next);
        expect(res.statusCode).toBe(400);
      });

      it('should reject non-image data URL', () => {
        const req = {
          body: {
            image: 'data:text/plain;base64,SGVsbG8=',
            profile: VALID_PROFILE,
          },
        };
        const res = createMockRes();
        const next = createMockNext();

        validateAnalyzeRequest(req, res, next);
        expect(res.statusCode).toBe(400);
      });

      it('should reject video/* format', () => {
        const req = {
          body: {
            image: 'data:video/mp4;base64,AAAA...',
            profile: VALID_PROFILE,
          },
        };
        const res = createMockRes();
        const next = createMockNext();

        validateAnalyzeRequest(req, res, next);
        expect(res.statusCode).toBe(400);
      });

      it('should reject application/* format', () => {
        const req = {
          body: {
            image: 'data:application/json;base64,e30=',
            profile: VALID_PROFILE,
          },
        };
        const res = createMockRes();
        const next = createMockNext();

        validateAnalyzeRequest(req, res, next);
        expect(res.statusCode).toBe(400);
      });

      it('should provide helpful error message for invalid format', () => {
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

    describe('missing profile', () => {
      it('should reject request without profile', () => {
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

      it('should reject request with null profile', () => {
        const req = {
          body: {
            image: MOCK_IMAGE_BASE64,
            profile: null,
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
            profile: [],
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
            profile: 'string',
          },
        };
        const res = createMockRes();
        const next = createMockNext();

        validateAnalyzeRequest(req, res, next);
        expect(res.statusCode).toBe(400);
      });

      it('should reject numeric profile', () => {
        const req = {
          body: {
            image: MOCK_IMAGE_BASE64,
            profile: 12345,
          },
        };
        const res = createMockRes();
        const next = createMockNext();

        validateAnalyzeRequest(req, res, next);
        expect(res.statusCode).toBe(400);
      });
    });

    describe('image size validation', () => {
      it('should allow normal size image', () => {
        const req = {
          body: {
            image: 'data:image/jpeg;base64,' + 'A'.repeat(1024 * 1024),
            profile: VALID_PROFILE,
          },
        };
        const res = createMockRes();
        const next = createMockNext();

        validateAnalyzeRequest(req, res, next);
        expect(next.wasCalled()).toBe(true);
      });

      it('should allow 20MB image (at limit)', () => {
        const req = {
          body: {
            image: 'data:image/jpeg;base64,' + 'A'.repeat(20 * 1024 * 1024),
            profile: VALID_PROFILE,
          },
        };
        const res = createMockRes();
        const next = createMockNext();

        validateAnalyzeRequest(req, res, next);
        expect(next.wasCalled()).toBe(true);
      });

      it('should reject image larger than 20MB', () => {
        const req = {
          body: {
            image: OVERSIZED_IMAGE,
            profile: VALID_PROFILE,
          },
        };
        const res = createMockRes();
        const next = createMockNext();

        validateAnalyzeRequest(req, res, next);
        expect(res.statusCode).toBe(400);
      });

      it('should provide helpful error for oversized image', () => {
        const req = {
          body: {
            image: 'data:image/jpeg;base64,' + 'A'.repeat(25 * 1024 * 1024),
            profile: VALID_PROFILE,
          },
        };
        const res = createMockRes();
        const next = createMockNext();

        validateAnalyzeRequest(req, res, next);
        const error = res.body.error;
        expect(error.toLowerCase()).toContain('large');
      });
    });

    describe('error response format', () => {
      it('should return error in JSON format', () => {
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

      it('should include helpful error messages', () => {
        const req = {
          body: {
            image: 'invalid',
            profile: VALID_PROFILE,
          },
        };
        const res = createMockRes();
        const next = createMockNext();

        validateAnalyzeRequest(req, res, next);
        const error = res.body.error;
        expect(error).toBeDefined();
        expect(error.length).toBeGreaterThan(0);
      });
    });

    describe('request flow control', () => {
      it('should call next() on valid request', () => {
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

      it('should not call next() on invalid request', () => {
        const req = {
          body: {
            image: null,
            profile: VALID_PROFILE,
          },
        };
        const res = createMockRes();
        const next = createMockNext();

        validateAnalyzeRequest(req, res, next);
        expect(next.wasCalled()).toBe(false);
      });
    });
  });
});
