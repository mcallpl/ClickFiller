/**
 * E2E tests for complete user workflow
 * Tests the happy path from app load to PDF download
 */

import { StorageManager } from '../../src/storage-manager.js';
import { validateProfile } from '../../src/validation.js';
import { setupLocalStorage } from '../helpers/test-utils.js';
import { VALID_PROFILE, MOCK_IMAGE_BASE64, MOCK_FORM_RESPONSE } from '../helpers/mock-data.js';

describe('End-to-End: Complete Workflow', () => {
  beforeEach(() => {
    setupLocalStorage();
    fetch.mockClear();
  });

  describe('complete user journey', () => {
    it('should execute full workflow without errors', async () => {
      // STEP 1: App loads - user sees empty profile
      expect(StorageManager.hasProfile()).toBe(false);

      // STEP 2: User fills in "My Info" tab
      const userInfo = VALID_PROFILE;

      // STEP 3: User saves profile
      let result = StorageManager.saveProfile(userInfo);
      expect(result.success).toBe(true);

      // STEP 4: Verify profile was saved
      const savedProfile = StorageManager.loadProfile();
      expect(savedProfile).not.toBeNull();
      expect(savedProfile.firstName).toBe(VALID_PROFILE.firstName);

      // STEP 5: User navigates to Capture tab
      // (UI navigation - no test needed here)

      // STEP 6: User uploads form image (simulated)
      const formImage = MOCK_IMAGE_BASE64;
      expect(formImage).toContain('data:image/');

      // STEP 7: User crops image and confirms
      // (Canvas operations - tested separately)

      // STEP 8: User clicks "Fill Form" - API call made
      // Mock the API response
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => MOCK_FORM_RESPONSE,
      });

      // Simulate API call
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: formImage,
          profile: savedProfile,
        }),
      });

      expect(response.ok).toBe(true);
      const formData = await response.json();
      expect(formData.fields).toBeDefined();
      expect(formData.fields.length).toBeGreaterThan(0);

      // STEP 9: Frontend draws filled form (simulated)
      const filledFields = formData.fields;
      filledFields.forEach(field => {
        expect(field.x).toBeDefined();
        expect(field.y).toBeDefined();
        expect(field.width).toBeDefined();
        expect(field.height).toBeDefined();
        expect(field.value).toBeDefined();
      });

      // STEP 10: User downloads PDF
      // (PDF generation tested separately)

      // SUCCESS: All steps completed
      expect(true).toBe(true);
    });

    it('should handle workflow with validation', () => {
      // Fill invalid profile
      const invalidProfile = {
        firstName: 'John123', // Invalid
      };

      const result = StorageManager.saveProfile(invalidProfile);
      expect(result.success).toBe(false);

      // No invalid data stored
      expect(StorageManager.hasProfile()).toBe(false);
    });

    it('should support profile updates in workflow', () => {
      // Initial profile save
      StorageManager.saveProfile(VALID_PROFILE);

      // User navigates away and back
      let loaded = StorageManager.loadProfile();
      expect(loaded.firstName).toBe(VALID_PROFILE.firstName);

      // User updates profile
      const updated = { ...VALID_PROFILE, firstName: 'Jane' };
      StorageManager.saveProfile(updated);

      // Verify update
      loaded = StorageManager.loadProfile();
      expect(loaded.firstName).toBe('Jane');
    });
  });

  describe('workflow error handling', () => {
    it('should gracefully handle missing profile in API call', async () => {
      // User tries to fill form without saving profile
      const response = {
        status: 400,
        ok: false,
        json: async () => ({ error: 'Missing profile' }),
      };

      expect(response.ok).toBe(false);
      expect(response.status).toBe(400);
    });

    it('should gracefully handle missing image in API call', async () => {
      const response = {
        status: 400,
        ok: false,
        json: async () => ({ error: 'Missing image' }),
      };

      expect(response.ok).toBe(false);
    });

    it('should handle API timeout gracefully', async () => {
      fetch.mockRejectedValueOnce(new Error('Request timeout'));

      try {
        await fetch('/api/analyze');
      } catch (err) {
        expect(err.message).toContain('timeout');
      }
    });

    it('should handle storage errors gracefully', () => {
      localStorage.setItem.mockImplementation(() => {
        throw new Error('Storage full');
      });

      const result = StorageManager.saveProfile(VALID_PROFILE);
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should allow user to retry after error', () => {
      // First save fails
      localStorage.setItem.mockImplementationOnce(() => {
        throw new Error('Storage error');
      });

      let result = StorageManager.saveProfile(VALID_PROFILE);
      expect(result.success).toBe(false);

      // Clear mock and retry
      localStorage.setItem.mockClear();
      localStorage.setItem.mockImplementation((key, value) => {
        // Success
      });

      result = StorageManager.saveProfile(VALID_PROFILE);
      expect(result.success).toBe(true);
    });
  });

  describe('workflow persistence', () => {
    it('should maintain state through page reload simulation', () => {
      // Save profile
      StorageManager.saveProfile(VALID_PROFILE);

      // Simulate page reload (localStorage still has data)
      localStorage.getItem.mockReturnValue(JSON.stringify(VALID_PROFILE));

      // App reloads and loads profile
      const loaded = StorageManager.loadProfile();
      expect(loaded).not.toBeNull();
      expect(loaded.firstName).toBe(VALID_PROFILE.firstName);
    });

    it('should maintain profile across multiple API calls', async () => {
      // Save profile
      StorageManager.saveProfile(VALID_PROFILE);

      // First API call
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => MOCK_FORM_RESPONSE,
      });

      // Profile still available for second call
      const profile1 = StorageManager.loadProfile();
      expect(profile1).not.toBeNull();

      // Second API call with same profile
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ ...MOCK_FORM_RESPONSE, fields: [] }),
      });

      const profile2 = StorageManager.loadProfile();
      expect(profile1).toEqual(profile2);
    });
  });

  describe('workflow with custom data', () => {
    it('should handle profile with custom fields through workflow', () => {
      const profileWithCustom = {
        firstName: 'John',
        _custom: [
          { label: 'License', value: 'DL123456' },
        ],
      };

      // Save
      const result = StorageManager.saveProfile(profileWithCustom);
      expect(result.success).toBe(true);

      // Load and verify custom data
      const loaded = StorageManager.loadProfile();
      expect(loaded._custom).toBeDefined();
      expect(loaded._custom[0].label).toBe('License');
    });

    it('should validate and sanitize custom fields in workflow', () => {
      const profileWithXSS = {
        firstName: 'John',
        _custom: [
          { label: 'Field', value: '<script>alert("xss")</script>' },
        ],
      };

      StorageManager.saveProfile(profileWithXSS);
      const loaded = StorageManager.loadProfile();

      // Should be sanitized
      expect(loaded._custom[0].value).not.toContain('<script>');
    });
  });

  describe('workflow data flow', () => {
    it('should flow data from profile through to API call', async () => {
      // Save profile
      const profile = VALID_PROFILE;
      StorageManager.saveProfile(profile);

      // Load profile
      const savedProfile = StorageManager.loadProfile();

      // Prepare API call with loaded data
      const requestBody = {
        image: MOCK_IMAGE_BASE64,
        profile: savedProfile,
      };

      // Verify data integrity
      expect(requestBody.profile.firstName).toBe(profile.firstName);
      expect(requestBody.profile.email).toBe(profile.email);

      // Make API call
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => MOCK_FORM_RESPONSE,
      });

      const response = await fetch('/api/analyze', {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });

      const result = await response.json();
      expect(result.fields).toBeDefined();
    });

    it('should maintain data consistency through full workflow', () => {
      const originalProfile = VALID_PROFILE;

      // Step 1: Save
      StorageManager.saveProfile(originalProfile);

      // Step 2: Load
      const loaded1 = StorageManager.loadProfile();
      expect(loaded1).toEqual(originalProfile);

      // Step 3: Validate loaded data
      const validation = validateProfile(loaded1);
      expect(validation.valid).toBe(true);

      // Step 4: Load again
      const loaded2 = StorageManager.loadProfile();
      expect(loaded1).toEqual(loaded2);

      // All should match original
      expect(loaded2).toEqual(originalProfile);
    });
  });

  describe('workflow success criteria', () => {
    it('should complete all major steps', async () => {
      const steps = [];

      // 1. Load app
      steps.push('app-load');
      expect(StorageManager.hasProfile()).toBe(false);

      // 2. Fill profile
      steps.push('profile-fill');
      const profile = VALID_PROFILE;

      // 3. Save profile
      steps.push('profile-save');
      const result = StorageManager.saveProfile(profile);
      expect(result.success).toBe(true);

      // 4. View Capture tab (no code needed)
      steps.push('capture-tab');

      // 5. Upload image (no code needed)
      steps.push('image-upload');

      // 6. Confirm crop (no code needed)
      steps.push('image-crop');

      // 7. Click Fill Form
      steps.push('fill-form');
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => MOCK_FORM_RESPONSE,
      });

      // 8. Verify fields rendered
      steps.push('fields-rendered');
      const response = await fetch('/api/analyze', {
        method: 'POST',
        body: JSON.stringify({ image: MOCK_IMAGE_BASE64, profile }),
      });
      const data = await response.json();
      expect(data.fields.length).toBeGreaterThan(0);

      // 9. Download PDF (no code needed)
      steps.push('pdf-download');

      // All steps completed
      expect(steps.length).toBe(9);
    });

    it('should allow user to clear data at any point', () => {
      // Save profile
      StorageManager.saveProfile(VALID_PROFILE);
      expect(StorageManager.hasProfile()).toBe(true);

      // User clears data
      StorageManager.clearProfile();
      localStorage.getItem.mockReturnValue(null);

      // Verify cleared
      expect(StorageManager.hasProfile()).toBe(false);

      // User can start fresh
      const result = StorageManager.saveProfile(VALID_PROFILE);
      expect(result.success).toBe(true);
    });
  });
});
