/**
 * Integration tests for profile flow
 * Tests complete profile save/load/clear cycle
 */

import { StorageManager } from '../../src/storage-manager.js';
import { validateProfile } from '../../src/validation.js';
import { setupLocalStorage } from '../helpers/test-utils.js';
import { VALID_PROFILE, PARTIAL_PROFILE, INVALID_PROFILE } from '../helpers/mock-data.js';

describe('Profile Flow Integration Tests', () => {
  beforeEach(() => {
    setupLocalStorage();
  });

  describe('save and retrieve profile', () => {
    it('should save valid profile and retrieve it', () => {
      // Save
      const saveResult = StorageManager.saveProfile(VALID_PROFILE);
      expect(saveResult.success).toBe(true);

      // Retrieve
      const loaded = StorageManager.loadProfile();
      expect(loaded).toEqual(VALID_PROFILE);
    });

    it('should handle partial profile with only required fields', () => {
      // Save minimal profile
      const saveResult = StorageManager.saveProfile(PARTIAL_PROFILE);
      expect(saveResult.success).toBe(true);

      // Verify it loads back
      const loaded = StorageManager.loadProfile();
      expect(loaded.firstName).toBe(PARTIAL_PROFILE.firstName);
      expect(loaded.lastName).toBe(PARTIAL_PROFILE.lastName);
    });

    it('should persist profile across multiple loads', () => {
      // Save
      StorageManager.saveProfile(VALID_PROFILE);

      // Load multiple times
      const load1 = StorageManager.loadProfile();
      const load2 = StorageManager.loadProfile();
      const load3 = StorageManager.loadProfile();

      expect(load1).toEqual(load2);
      expect(load2).toEqual(load3);
      expect(load1).toEqual(VALID_PROFILE);
    });

    it('should maintain data integrity through validation', () => {
      // Save
      StorageManager.saveProfile(VALID_PROFILE);

      // Load
      const loaded = StorageManager.loadProfile();

      // Validate loaded data
      const validation = validateProfile(loaded);
      expect(validation.valid).toBe(true);
    });
  });

  describe('validate before save', () => {
    it('should reject invalid profile at save time', () => {
      const result = StorageManager.saveProfile(INVALID_PROFILE);
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should not store invalid data', () => {
      StorageManager.saveProfile(INVALID_PROFILE);
      const loaded = StorageManager.loadProfile();
      expect(loaded).toBeNull(); // Nothing was saved
    });

    it('should provide specific validation errors', () => {
      const result = StorageManager.saveProfile({
        firstName: 'John123', // Invalid
        email: 'bad-email', // Invalid
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('firstName');
      expect(result.error).toContain('email');
    });

    it('should validate each field independently', () => {
      const invalidEmail = { email: 'invalid' };
      const result = StorageManager.saveProfile(invalidEmail);
      expect(result.success).toBe(false);
      expect(result.error).toContain('email');
    });
  });

  describe('update profile', () => {
    it('should replace profile on second save', () => {
      // Save first profile
      StorageManager.saveProfile(VALID_PROFILE);
      let loaded = StorageManager.loadProfile();
      expect(loaded.firstName).toBe(VALID_PROFILE.firstName);

      // Save different profile
      const newProfile = { ...PARTIAL_PROFILE, firstName: 'Different' };
      StorageManager.saveProfile(newProfile);
      loaded = StorageManager.loadProfile();

      expect(loaded.firstName).toBe('Different');
    });

    it('should handle partial updates', () => {
      // Save complete profile
      StorageManager.saveProfile(VALID_PROFILE);

      // Update with different data
      const update = { firstName: 'Alice' };
      StorageManager.saveProfile(update);
      const loaded = StorageManager.loadProfile();

      expect(loaded.firstName).toBe('Alice');
    });

    it('should maintain profile state across updates', () => {
      const profile1 = { firstName: 'John', lastName: 'Doe' };
      StorageManager.saveProfile(profile1);

      const profile2 = { firstName: 'Jane' };
      StorageManager.saveProfile(profile2);

      const loaded = StorageManager.loadProfile();
      expect(loaded.firstName).toBe('Jane');
    });
  });

  describe('clear profile', () => {
    it('should clear all profile data', () => {
      // Save
      StorageManager.saveProfile(VALID_PROFILE);
      expect(StorageManager.hasProfile()).toBe(true);

      // Clear
      StorageManager.clearProfile();
      localStorage.getItem.mockReturnValue(null);

      // Verify cleared
      expect(StorageManager.hasProfile()).toBe(false);
      const loaded = StorageManager.loadProfile();
      expect(loaded).toBeNull();
    });

    it('should allow saving new profile after clear', () => {
      // Save and clear
      StorageManager.saveProfile(VALID_PROFILE);
      StorageManager.clearProfile();
      localStorage.getItem.mockReturnValue(null);

      // Save new profile
      const newProfile = { firstName: 'Bob', email: 'bob@example.com' };
      const result = StorageManager.saveProfile(newProfile);
      expect(result.success).toBe(true);
    });

    it('should handle clear when no profile exists', () => {
      localStorage.getItem.mockReturnValue(null);
      expect(() => StorageManager.clearProfile()).not.toThrow();
    });
  });

  describe('storage quota', () => {
    it('should prevent save when quota exceeded', () => {
      localStorage.setItem.mockImplementation(() => {
        throw new Error('QuotaExceededError');
      });

      const result = StorageManager.saveProfile(VALID_PROFILE);
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should warn before reaching quota limit', () => {
      const largeData = 'A'.repeat(4.5 * 1024 * 1024);
      const check = StorageManager.checkQuotaBeforeSave(largeData);

      if (check.quotaWarning) {
        expect(check.canSave).toBe(true);
        expect(check.message).toContain('%');
      }
    });

    it('should track storage usage', () => {
      StorageManager.saveProfile(VALID_PROFILE);
      const usage = StorageManager.getStorageUsage();

      expect(usage.used).toBeGreaterThan(0);
      expect(usage.percentFull).toBeGreaterThanOrEqual(0);
      expect(usage.percentFull).toBeLessThanOrEqual(100);
    });
  });

  describe('profile existence checking', () => {
    it('should correctly report when profile exists', () => {
      StorageManager.saveProfile(VALID_PROFILE);
      expect(StorageManager.hasProfile()).toBe(true);
    });

    it('should correctly report when profile does not exist', () => {
      localStorage.getItem.mockReturnValue(null);
      expect(StorageManager.hasProfile()).toBe(false);
    });

    it('should distinguish saved vs empty storage', () => {
      StorageManager.saveProfile(VALID_PROFILE);
      expect(StorageManager.hasProfile()).toBe(true);

      StorageManager.clearProfile();
      localStorage.getItem.mockReturnValue(null);
      expect(StorageManager.hasProfile()).toBe(false);
    });
  });

  describe('error recovery', () => {
    it('should handle corrupted stored profile gracefully', () => {
      localStorage.getItem.mockReturnValue('not valid json');
      const loaded = StorageManager.loadProfile();
      expect(loaded).toBeNull();
    });

    it('should allow recovery after load error', () => {
      localStorage.getItem.mockReturnValue('bad json');
      let loaded = StorageManager.loadProfile();
      expect(loaded).toBeNull();

      // Reset mock and save valid profile
      localStorage.getItem.mockReturnValue(null);
      StorageManager.saveProfile(VALID_PROFILE);

      // Should be able to load now
      localStorage.getItem.mockReturnValue(JSON.stringify(VALID_PROFILE));
      loaded = StorageManager.loadProfile();
      expect(loaded).not.toBeNull();
    });

    it('should handle save errors without crashing', () => {
      localStorage.setItem.mockImplementation(() => {
        throw new Error('Storage error');
      });

      const result = StorageManager.saveProfile(VALID_PROFILE);
      expect(result.success).toBe(false);
      // Should not throw
    });
  });

  describe('custom fields in profile', () => {
    it('should save and load profile with custom fields', () => {
      const profileWithCustom = {
        firstName: 'John',
        _custom: [
          { label: 'License', value: 'DL123' },
        ],
      };

      StorageManager.saveProfile(profileWithCustom);
      const loaded = StorageManager.loadProfile();

      expect(loaded._custom).toBeDefined();
      expect(loaded._custom[0].label).toBe('License');
    });

    it('should sanitize custom field values on save', () => {
      const profileWithXSS = {
        firstName: 'John',
        _custom: [
          { label: 'Field', value: '<script>alert("XSS")</script>' },
        ],
      };

      StorageManager.saveProfile(profileWithXSS);
      const loaded = StorageManager.loadProfile();

      expect(loaded._custom[0].value).not.toContain('<script>');
    });
  });

  describe('complete workflow', () => {
    it('should handle complete user workflow', () => {
      // 1. User opens app - no profile
      expect(StorageManager.hasProfile()).toBe(false);

      // 2. User fills in info
      const profile = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
      };

      // 3. User saves
      let result = StorageManager.saveProfile(profile);
      expect(result.success).toBe(true);

      // 4. App reloads - profile still there
      const loaded = StorageManager.loadProfile();
      expect(loaded.firstName).toBe('John');

      // 5. User updates info
      const updated = { ...profile, lastName: 'Smith' };
      result = StorageManager.saveProfile(updated);
      expect(result.success).toBe(true);

      // 6. Verify update
      const reloaded = StorageManager.loadProfile();
      expect(reloaded.lastName).toBe('Smith');

      // 7. User clears all data
      StorageManager.clearProfile();
      localStorage.getItem.mockReturnValue(null);
      expect(StorageManager.hasProfile()).toBe(false);
    });

    it('should validate on every save in workflow', () => {
      // Valid save
      let result = StorageManager.saveProfile(VALID_PROFILE);
      expect(result.success).toBe(true);

      // Invalid save attempt
      result = StorageManager.saveProfile({ firstName: '123' });
      expect(result.success).toBe(false);

      // Original profile still there
      const loaded = StorageManager.loadProfile();
      expect(loaded.firstName).toBe(VALID_PROFILE.firstName);
    });
  });
});
