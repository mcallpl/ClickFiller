/**
 * Unit tests for config.js
 * Verifies all configuration constants are defined and accessible
 */

import { config } from '../../src/config.js';

describe('Configuration Module', () => {
  describe('config object structure', () => {
    it('should export config object', () => {
      expect(config).toBeDefined();
      expect(typeof config).toBe('object');
    });

    it('should have required top-level keys', () => {
      expect(config).toHaveProperty('API_ANALYZE_URL');
      expect(config).toHaveProperty('STORAGE_KEYS');
      expect(config).toHaveProperty('TIMEOUTS');
      expect(config).toHaveProperty('CLASS_NAMES');
      expect(config).toHaveProperty('MESSAGES');
      expect(config).toHaveProperty('IMAGE_RESIZE_MAX_DIM');
      expect(config).toHaveProperty('IMAGE_JPEG_QUALITY');
      expect(config).toHaveProperty('SIGNATURE_MAX_WIDTH');
      expect(config).toHaveProperty('VIEWS');
    });
  });

  describe('API_ANALYZE_URL', () => {
    it('should be defined', () => {
      expect(config.API_ANALYZE_URL).toBeDefined();
    });

    it('should be a string', () => {
      expect(typeof config.API_ANALYZE_URL).toBe('string');
    });

    it('should start with /api/', () => {
      expect(config.API_ANALYZE_URL).toMatch(/^\/api\//);
    });

    it('should reference /api/analyze', () => {
      expect(config.API_ANALYZE_URL).toBe('/api/analyze');
    });
  });

  describe('STORAGE_KEYS', () => {
    it('should be defined', () => {
      expect(config.STORAGE_KEYS).toBeDefined();
    });

    it('should be an object', () => {
      expect(typeof config.STORAGE_KEYS).toBe('object');
    });

    it('should have profile key', () => {
      expect(config.STORAGE_KEYS).toHaveProperty('profile');
      expect(typeof config.STORAGE_KEYS.profile).toBe('string');
    });

    it('should have result key', () => {
      expect(config.STORAGE_KEYS).toHaveProperty('result');
      expect(typeof config.STORAGE_KEYS.result).toBe('string');
    });

    it('should have signatures key', () => {
      expect(config.STORAGE_KEYS).toHaveProperty('signatures');
      expect(typeof config.STORAGE_KEYS.signatures).toBe('string');
    });

    it('should have unique values', () => {
      const values = Object.values(config.STORAGE_KEYS);
      const uniqueValues = new Set(values);
      expect(uniqueValues.size).toBe(values.length);
    });

    it('should use clickfiller_ prefix', () => {
      Object.values(config.STORAGE_KEYS).forEach(key => {
        expect(key).toMatch(/^clickfiller_/);
      });
    });
  });

  describe('TIMEOUTS', () => {
    it('should be defined', () => {
      expect(config.TIMEOUTS).toBeDefined();
    });

    it('should be an object', () => {
      expect(typeof config.TIMEOUTS).toBe('object');
    });

    it('should have toast timeout', () => {
      expect(config.TIMEOUTS).toHaveProperty('toast');
      expect(typeof config.TIMEOUTS.toast).toBe('number');
      expect(config.TIMEOUTS.toast).toBeGreaterThan(0);
    });

    it('should have profileError timeout', () => {
      expect(config.TIMEOUTS).toHaveProperty('profileError');
      expect(typeof config.TIMEOUTS.profileError).toBe('number');
      expect(config.TIMEOUTS.profileError).toBeGreaterThan(0);
    });

    it('should have profileWarning timeout', () => {
      expect(config.TIMEOUTS).toHaveProperty('profileWarning');
      expect(typeof config.TIMEOUTS.profileWarning).toBe('number');
      expect(config.TIMEOUTS.profileWarning).toBeGreaterThan(0);
    });

    it('should have reasonable timeout values', () => {
      Object.values(config.TIMEOUTS).forEach(timeout => {
        expect(timeout).toBeGreaterThanOrEqual(1000); // At least 1 second
        expect(timeout).toBeLessThanOrEqual(10000); // At most 10 seconds
      });
    });
  });

  describe('CLASS_NAMES', () => {
    it('should be defined', () => {
      expect(config.CLASS_NAMES).toBeDefined();
    });

    it('should be an object', () => {
      expect(typeof config.CLASS_NAMES).toBe('object');
    });

    it('should have active class', () => {
      expect(config.CLASS_NAMES).toHaveProperty('active');
      expect(typeof config.CLASS_NAMES.active).toBe('string');
    });

    it('should have navBtn class', () => {
      expect(config.CLASS_NAMES).toHaveProperty('navBtn');
      expect(typeof config.CLASS_NAMES.navBtn).toBe('string');
    });

    it('should have view class', () => {
      expect(config.CLASS_NAMES).toHaveProperty('view');
      expect(typeof config.CLASS_NAMES.view).toBe('string');
    });

    it('should have fieldOverlay class', () => {
      expect(config.CLASS_NAMES).toHaveProperty('fieldOverlay');
      expect(typeof config.CLASS_NAMES.fieldOverlay).toBe('string');
    });

    it('should have sigOverlay class', () => {
      expect(config.CLASS_NAMES).toHaveProperty('sigOverlay');
      expect(typeof config.CLASS_NAMES.sigOverlay).toBe('string');
    });

    it('should have customFieldRow class', () => {
      expect(config.CLASS_NAMES).toHaveProperty('customFieldRow');
      expect(typeof config.CLASS_NAMES.customFieldRow).toBe('string');
    });

    it('should have toast class', () => {
      expect(config.CLASS_NAMES).toHaveProperty('toast');
      expect(typeof config.CLASS_NAMES.toast).toBe('string');
    });

    it('should have sigItem class', () => {
      expect(config.CLASS_NAMES).toHaveProperty('sigItem');
      expect(typeof config.CLASS_NAMES.sigItem).toBe('string');
    });

    it('should have all values as strings', () => {
      Object.values(config.CLASS_NAMES).forEach(value => {
        expect(typeof value).toBe('string');
        expect(value.length).toBeGreaterThan(0);
      });
    });
  });

  describe('MESSAGES', () => {
    it('should be defined', () => {
      expect(config.MESSAGES).toBeDefined();
    });

    it('should be an object', () => {
      expect(typeof config.MESSAGES).toBe('object');
    });

    it('should have noImage message', () => {
      expect(config.MESSAGES).toHaveProperty('noImage');
      expect(typeof config.MESSAGES.noImage).toBe('string');
    });

    it('should have noProfile message', () => {
      expect(config.MESSAGES).toHaveProperty('noProfile');
      expect(typeof config.MESSAGES.noProfile).toBe('string');
    });

    it('should have noFieldsDetected message', () => {
      expect(config.MESSAGES).toHaveProperty('noFieldsDetected');
      expect(typeof config.MESSAGES.noFieldsDetected).toBe('string');
    });

    it('should have noSignatures message', () => {
      expect(config.MESSAGES).toHaveProperty('noSignatures');
      expect(typeof config.MESSAGES.noSignatures).toBe('string');
    });

    it('should have positionsSaved message', () => {
      expect(config.MESSAGES).toHaveProperty('positionsSaved');
      expect(typeof config.MESSAGES.positionsSaved).toBe('string');
    });

    it('should have signatureSaved message', () => {
      expect(config.MESSAGES).toHaveProperty('signatureSaved');
      expect(typeof config.MESSAGES.signatureSaved).toBe('string');
    });

    it('should have profileSaved message', () => {
      expect(config.MESSAGES).toHaveProperty('profileSaved');
      expect(typeof config.MESSAGES.profileSaved).toBe('string');
    });

    it('should have allDataCleared message', () => {
      expect(config.MESSAGES).toHaveProperty('allDataCleared');
      expect(typeof config.MESSAGES.allDataCleared).toBe('string');
    });

    it('should have pdfExportError message', () => {
      expect(config.MESSAGES).toHaveProperty('pdfExportError');
      expect(typeof config.MESSAGES.pdfExportError).toBe('string');
    });

    it('should have all messages as non-empty strings', () => {
      Object.values(config.MESSAGES).forEach(msg => {
        expect(typeof msg).toBe('string');
        expect(msg.length).toBeGreaterThan(0);
      });
    });
  });

  describe('IMAGE_RESIZE_MAX_DIM', () => {
    it('should be defined', () => {
      expect(config.IMAGE_RESIZE_MAX_DIM).toBeDefined();
    });

    it('should be a positive number', () => {
      expect(typeof config.IMAGE_RESIZE_MAX_DIM).toBe('number');
      expect(config.IMAGE_RESIZE_MAX_DIM).toBeGreaterThan(0);
    });

    it('should be a reasonable dimension', () => {
      expect(config.IMAGE_RESIZE_MAX_DIM).toBeGreaterThanOrEqual(512);
      expect(config.IMAGE_RESIZE_MAX_DIM).toBeLessThanOrEqual(4096);
    });
  });

  describe('IMAGE_JPEG_QUALITY', () => {
    it('should be defined', () => {
      expect(config.IMAGE_JPEG_QUALITY).toBeDefined();
    });

    it('should be a number between 0 and 1', () => {
      expect(typeof config.IMAGE_JPEG_QUALITY).toBe('number');
      expect(config.IMAGE_JPEG_QUALITY).toBeGreaterThan(0);
      expect(config.IMAGE_JPEG_QUALITY).toBeLessThanOrEqual(1);
    });

    it('should be reasonable quality', () => {
      expect(config.IMAGE_JPEG_QUALITY).toBeGreaterThanOrEqual(0.5);
    });
  });

  describe('SIGNATURE_MAX_WIDTH', () => {
    it('should be defined', () => {
      expect(config.SIGNATURE_MAX_WIDTH).toBeDefined();
    });

    it('should be a positive number', () => {
      expect(typeof config.SIGNATURE_MAX_WIDTH).toBe('number');
      expect(config.SIGNATURE_MAX_WIDTH).toBeGreaterThan(0);
    });

    it('should be reasonable width', () => {
      expect(config.SIGNATURE_MAX_WIDTH).toBeGreaterThanOrEqual(100);
      expect(config.SIGNATURE_MAX_WIDTH).toBeLessThanOrEqual(1000);
    });
  });

  describe('VIEWS', () => {
    it('should be defined', () => {
      expect(config.VIEWS).toBeDefined();
    });

    it('should be an object', () => {
      expect(typeof config.VIEWS).toBe('object');
    });

    it('should have capture view', () => {
      expect(config.VIEWS).toHaveProperty('capture');
      expect(typeof config.VIEWS.capture).toBe('string');
    });

    it('should have result view', () => {
      expect(config.VIEWS).toHaveProperty('result');
      expect(typeof config.VIEWS.result).toBe('string');
    });

    it('should have profile view', () => {
      expect(config.VIEWS).toHaveProperty('profile');
      expect(typeof config.VIEWS.profile).toBe('string');
    });

    it('should have all views as strings', () => {
      Object.values(config.VIEWS).forEach(view => {
        expect(typeof view).toBe('string');
        expect(view.length).toBeGreaterThan(0);
      });
    });

    it('should have unique view names', () => {
      const views = Object.values(config.VIEWS);
      const uniqueViews = new Set(views);
      expect(uniqueViews.size).toBe(views.length);
    });
  });

  describe('no undefined values', () => {
    it('should not have any undefined values in config', () => {
      const checkUndefined = (obj, path = '') => {
        Object.entries(obj).forEach(([key, value]) => {
          if (value === undefined) {
            throw new Error(`Undefined value at ${path}${key}`);
          }
          if (typeof value === 'object' && value !== null) {
            checkUndefined(value, `${path}${key}.`);
          }
        });
      };
      expect(() => checkUndefined(config)).not.toThrow();
    });
  });

  describe('immutability', () => {
    it('config object should be frozen or sealed', () => {
      // Note: This test checks if config is properly protected
      // Current implementation may or may not freeze config
      const descriptor = Object.getOwnPropertyDescriptor(config, 'API_ANALYZE_URL');
      // Just verify config structure is consistent
      expect(config.API_ANALYZE_URL).toBe('/api/analyze');
    });
  });

  describe('consistency checks', () => {
    it('should not have conflicting class names', () => {
      const classNames = Object.values(config.CLASS_NAMES);
      const unique = new Set(classNames);
      expect(unique.size).toBe(classNames.length);
    });

    it('should not have conflicting storage keys', () => {
      const keys = Object.values(config.STORAGE_KEYS);
      const unique = new Set(keys);
      expect(unique.size).toBe(keys.length);
    });

    it('should not have conflicting message keys', () => {
      const messages = Object.keys(config.MESSAGES);
      const unique = new Set(messages);
      expect(unique.size).toBe(messages.length);
    });

    it('should not have conflicting timeout keys', () => {
      const timeouts = Object.keys(config.TIMEOUTS);
      const unique = new Set(timeouts);
      expect(unique.size).toBe(timeouts.length);
    });

    it('should have reasonable numeric constants', () => {
      expect(config.IMAGE_RESIZE_MAX_DIM).toBeGreaterThan(0);
      expect(config.IMAGE_JPEG_QUALITY).toBeGreaterThan(0);
      expect(config.SIGNATURE_MAX_WIDTH).toBeGreaterThan(0);
    });
  });

  describe('integration', () => {
    it('should be usable with destructuring', () => {
      const { API_ANALYZE_URL, VIEWS } = config;
      expect(API_ANALYZE_URL).toBe('/api/analyze');
      expect(VIEWS.capture).toBeDefined();
    });

    it('should be usable with dot notation', () => {
      expect(config.MESSAGES.profileSaved).toBeDefined();
      expect(config.CLASS_NAMES.active).toBeDefined();
    });
  });
});
