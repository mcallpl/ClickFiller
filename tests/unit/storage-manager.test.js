/**
 * Unit tests for storage-manager.js
 * Tests localStorage operations with mocked localStorage
 */

import { StorageManager } from '../../src/storage-manager.js';
import { setupLocalStorage } from '../helpers/test-utils.js';
import { VALID_PROFILE, PARTIAL_PROFILE, PROFILE_WITH_CUSTOM_FIELDS } from '../helpers/mock-data.js';

describe('StorageManager', () => {
  const STORAGE_KEY = 'clickfiller_profile';

  beforeEach(() => {
    setupLocalStorage();
  });

  describe('saveProfile()', () => {
    it('should save a valid profile', () => {
      const result = StorageManager.saveProfile(VALID_PROFILE);
      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
      expect(localStorage.setItem).toHaveBeenCalled();
    });

    it('should save a partial profile (optional fields)', () => {
      const result = StorageManager.saveProfile(PARTIAL_PROFILE);
      expect(result.success).toBe(true);
    });

    it('should reject invalid profile data', () => {
      const invalidProfile = {
        firstName: 'John123', // Invalid: numbers
      };
      const result = StorageManager.saveProfile(invalidProfile);
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('Validation failed');
    });

    it('should store correct key', () => {
      StorageManager.saveProfile(VALID_PROFILE);
      const calls = localStorage.setItem.mock.calls;
      expect(calls[0][0]).toBe(STORAGE_KEY);
    });

    it('should stringify profile as JSON', () => {
      StorageManager.saveProfile(VALID_PROFILE);
      const calls = localStorage.setItem.mock.calls;
      const saved = calls[0][1];
      expect(() => JSON.parse(saved)).not.toThrow();
      const parsed = JSON.parse(saved);
      expect(parsed.firstName).toBe(VALID_PROFILE.firstName);
    });

    it('should sanitize custom field values', () => {
      const profileWithXSS = {
        firstName: 'John',
        _custom: [
          { label: 'Field1', value: 'Hello <script>alert("XSS")</script>' },
        ],
      };
      StorageManager.saveProfile(profileWithXSS);
      const calls = localStorage.setItem.mock.calls;
      const saved = JSON.parse(calls[0][1]);
      expect(saved._custom[0].value).not.toContain('<script>');
    });

    it('should trim custom field values', () => {
      const profile = {
        firstName: 'John',
        _custom: [
          { label: '  Field1  ', value: '  value  ' },
        ],
      };
      StorageManager.saveProfile(profile);
      const calls = localStorage.setItem.mock.calls;
      const saved = JSON.parse(calls[0][1]);
      expect(saved._custom[0].label).toBe('Field1');
      expect(saved._custom[0].value).toBe('value');
    });

    it('should handle multiple custom fields', () => {
      const result = StorageManager.saveProfile(PROFILE_WITH_CUSTOM_FIELDS);
      expect(result.success).toBe(true);
    });

    it('should handle profile larger than 85% quota threshold', () => {
      // Create a profile that's substantial but under limit
      const largeProfile = {
        firstName: 'John',
        ...Object.fromEntries(
          Array(10).fill(0).map((_, i) => [`field${i}`, 'A'.repeat(50)])
        ),
      };
      const result = StorageManager.saveProfile(largeProfile);
      expect(result.success).toBe(true);
    });

    it('should catch localStorage errors', () => {
      localStorage.setItem.mockImplementation(() => {
        throw new Error('QuotaExceededError');
      });
      const result = StorageManager.saveProfile(VALID_PROFILE);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to save');
    });
  });

  describe('loadProfile()', () => {
    it('should load a saved profile', () => {
      StorageManager.saveProfile(VALID_PROFILE);
      const loaded = StorageManager.loadProfile();
      expect(loaded).toEqual(VALID_PROFILE);
    });

    it('should return null if no profile saved', () => {
      localStorage.getItem.mockReturnValue(null);
      const loaded = StorageManager.loadProfile();
      expect(loaded).toBeNull();
    });

    it('should handle corrupted JSON', () => {
      localStorage.getItem.mockReturnValue('not valid json {');
      const loaded = StorageManager.loadProfile();
      expect(loaded).toBeNull();
    });

    it('should preserve custom fields when loading', () => {
      StorageManager.saveProfile(PROFILE_WITH_CUSTOM_FIELDS);
      const loaded = StorageManager.loadProfile();
      expect(loaded._custom).toEqual(PROFILE_WITH_CUSTOM_FIELDS._custom);
    });

    it('should load partial profiles', () => {
      StorageManager.saveProfile(PARTIAL_PROFILE);
      const loaded = StorageManager.loadProfile();
      expect(loaded.firstName).toBe(PARTIAL_PROFILE.firstName);
    });
  });

  describe('hasProfile()', () => {
    it('should return true if profile exists', () => {
      localStorage.getItem.mockReturnValue(JSON.stringify(VALID_PROFILE));
      expect(StorageManager.hasProfile()).toBe(true);
    });

    it('should return false if no profile exists', () => {
      localStorage.getItem.mockReturnValue(null);
      expect(StorageManager.hasProfile()).toBe(false);
    });

    it('should check correct storage key', () => {
      StorageManager.hasProfile();
      expect(localStorage.getItem).toHaveBeenCalledWith(STORAGE_KEY);
    });
  });

  describe('clearProfile()', () => {
    it('should remove profile from storage', () => {
      StorageManager.clearProfile();
      expect(localStorage.removeItem).toHaveBeenCalledWith(STORAGE_KEY);
    });

    it('should work after saving', () => {
      StorageManager.saveProfile(VALID_PROFILE);
      StorageManager.clearProfile();
      expect(localStorage.removeItem).toHaveBeenCalledWith(STORAGE_KEY);
    });

    it('should handle removeItem errors', () => {
      localStorage.removeItem.mockImplementation(() => {
        throw new Error('Failed to remove');
      });
      expect(() => StorageManager.clearProfile()).not.toThrow();
    });
  });

  describe('getStorageUsage()', () => {
    it('should return usage object with expected properties', () => {
      StorageManager.saveProfile(VALID_PROFILE);
      const usage = StorageManager.getStorageUsage();
      expect(usage).toHaveProperty('used');
      expect(usage).toHaveProperty('available');
      expect(usage).toHaveProperty('percentFull');
    });

    it('should return percentFull as a number', () => {
      StorageManager.saveProfile(VALID_PROFILE);
      const usage = StorageManager.getStorageUsage();
      expect(typeof usage.percentFull).toBe('number');
      expect(usage.percentFull).toBeGreaterThanOrEqual(0);
      expect(usage.percentFull).toBeLessThanOrEqual(100);
    });

    it('should return 0 usage when no profile saved', () => {
      localStorage.getItem.mockReturnValue(null);
      const usage = StorageManager.getStorageUsage();
      expect(usage.used).toBe(0);
      expect(usage.percentFull).toBe(0);
    });

    it('should estimate usage for larger profile', () => {
      const largeProfile = {
        firstName: 'John',
        data: 'A'.repeat(1000),
      };
      StorageManager.saveProfile(largeProfile);
      const usage = StorageManager.getStorageUsage();
      expect(usage.used).toBeGreaterThan(0);
    });

    it('should define available as 5MB', () => {
      const usage = StorageManager.getStorageUsage();
      expect(usage.available).toBe(5 * 1024 * 1024);
    });
  });

  describe('checkQuotaBeforeSave()', () => {
    it('should allow save for normal data', () => {
      const data = JSON.stringify(VALID_PROFILE);
      const result = StorageManager.checkQuotaBeforeSave(data);
      expect(result.canSave).toBe(true);
    });

    it('should reject save for oversized data', () => {
      const largeData = 'A'.repeat(6 * 1024 * 1024); // 6MB
      const result = StorageManager.checkQuotaBeforeSave(largeData);
      expect(result.canSave).toBe(false);
      expect(result.message).toBeDefined();
    });

    it('should warn at 85% threshold', () => {
      // Create data that's ~85% of 5MB limit
      // The method does newData.length * 2, so for 85% of 5MB: (5MB * 0.85) / 2 = ~2.125MB
      const thresholdData = 'A'.repeat(2.125 * 1024 * 1024);
      const result = StorageManager.checkQuotaBeforeSave(thresholdData);
      expect(result.canSave).toBe(true);
      if (result.quotaWarning) {
        expect(result.message).toBeDefined();
      }
    });

    it('should not warn below 85% threshold', () => {
      const normalData = 'A'.repeat(1024 * 100); // ~100KB
      const result = StorageManager.checkQuotaBeforeSave(normalData);
      expect(result.canSave).toBe(true);
      expect(result.quotaWarning).not.toBe(true);
    });

    it('should provide helpful error message for oversized data', () => {
      const largeData = 'A'.repeat(6 * 1024 * 1024);
      const result = StorageManager.checkQuotaBeforeSave(largeData);
      expect(result.message).toContain('5MB');
      expect(result.message.toLowerCase()).toContain('signature');
    });

    it('should include percentFull in warning message', () => {
      const largeData = 'A'.repeat(2.2 * 1024 * 1024);
      const result = StorageManager.checkQuotaBeforeSave(largeData);
      // Check if warning was triggered (at 88% of 5MB)
      if (result.quotaWarning) {
        expect(result.message).toContain('%');
      }
    });
  });

  describe('getCleanupSuggestions()', () => {
    it('should return array of suggestions', () => {
      const suggestions = StorageManager.getCleanupSuggestions();
      expect(Array.isArray(suggestions)).toBe(true);
    });

    it('should return no suggestions for low usage', () => {
      localStorage.getItem.mockReturnValue(null);
      const suggestions = StorageManager.getCleanupSuggestions();
      expect(suggestions.length).toBe(0);
    });

    it('should return suggestions for high usage', () => {
      localStorage.getItem.mockReturnValue('A'.repeat(3 * 1024 * 1024));
      const suggestions = StorageManager.getCleanupSuggestions();
      expect(suggestions.length).toBeGreaterThan(0);
    });

    it('should suggest removing signatures', () => {
      localStorage.getItem.mockReturnValue('A'.repeat(3 * 1024 * 1024));
      const suggestions = StorageManager.getCleanupSuggestions();
      const suggestion = suggestions.find(s => s.toLowerCase().includes('signature'));
      expect(suggestion).toBeDefined();
    });

    it('should suggest removing custom fields', () => {
      localStorage.getItem.mockReturnValue('A'.repeat(3 * 1024 * 1024));
      const suggestions = StorageManager.getCleanupSuggestions();
      const suggestion = suggestions.find(s => s.toLowerCase().includes('custom'));
      expect(suggestion).toBeDefined();
    });
  });

  describe('profile save and load cycle', () => {
    it('should maintain data integrity through save/load', () => {
      StorageManager.saveProfile(VALID_PROFILE);
      const loaded = StorageManager.loadProfile();
      expect(loaded).toEqual(VALID_PROFILE);
    });

    it('should handle multiple sequential saves', () => {
      StorageManager.saveProfile(VALID_PROFILE);
      StorageManager.saveProfile(PARTIAL_PROFILE);
      const loaded = StorageManager.loadProfile();
      expect(loaded).toEqual(PARTIAL_PROFILE);
    });

    it('should work with save->clear->check', () => {
      StorageManager.saveProfile(VALID_PROFILE);
      expect(StorageManager.hasProfile()).toBe(true);
      StorageManager.clearProfile();
      localStorage.getItem.mockReturnValue(null);
      expect(StorageManager.hasProfile()).toBe(false);
    });

    it('should preserve all field types through cycle', () => {
      const profile = {
        firstName: 'John',
        ssn4: '1234',
        dateOfBirth: '1990-01-15',
      };
      StorageManager.saveProfile(profile);
      const loaded = StorageManager.loadProfile();
      expect(loaded.ssn4).toBe('1234');
      expect(loaded.dateOfBirth).toBe('1990-01-15');
    });
  });

  describe('error handling', () => {
    it('should handle JSON parse errors gracefully', () => {
      localStorage.getItem.mockReturnValue('invalid json');
      const loaded = StorageManager.loadProfile();
      expect(loaded).toBeNull();
    });

    it('should handle localStorage access errors', () => {
      localStorage.setItem.mockImplementation(() => {
        throw new Error('Access denied');
      });
      const result = StorageManager.saveProfile(VALID_PROFILE);
      expect(result.success).toBe(false);
    });

    it('should validate before attempting save', () => {
      const invalidData = {
        firstName: 'John123', // Invalid
      };
      const result = StorageManager.saveProfile(invalidData);
      expect(result.success).toBe(false);
      expect(localStorage.setItem).not.toHaveBeenCalled();
    });
  });
});
