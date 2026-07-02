/**
 * StorageManager - Centralized localStorage management
 * Handles profile data storage with quota management
 */

import { validateProfile, sanitizeCustomValue } from './validation.js';

const STORAGE_KEY = 'clickfiller_profile';
const QUOTA_WARNING_THRESHOLD = 0.85; // Warn at 85% full

export class StorageManager {
  /**
   * Save a profile with validation
   * @param {Object} data - Profile data to save
   * @returns {Object} { success: boolean, error?: string }
   */
  static saveProfile(data) {
    // Validate the profile
    const validation = validateProfile(data);
    if (!validation.valid) {
      const errors = Object.entries(validation.errors)
        .map(([field, msg]) => `${field}: ${msg}`)
        .join('; ');
      return {
        success: false,
        error: `Validation failed: ${errors}`,
      };
    }

    // Sanitize custom fields
    if (data._custom && Array.isArray(data._custom)) {
      data._custom = data._custom.map(field => ({
        label: field.label.trim(),
        value: sanitizeCustomValue(field.value.trim()),
      }));
    }

    const json = JSON.stringify(data);

    // Check quota before saving
    const quotaCheck = this.checkQuotaBeforeSave(json);
    if (!quotaCheck.canSave) {
      return {
        success: false,
        error: quotaCheck.message,
      };
    }

    try {
      localStorage.setItem(STORAGE_KEY, json);
      return { success: true };
    } catch (e) {
      console.error('localStorage save failed:', e);
      return {
        success: false,
        error: 'Failed to save: ' + (e.message || 'storage error'),
      };
    }
  }

  /**
   * Load a profile from storage
   * @returns {Object|null} Profile data or null if not found
   */
  static loadProfile() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) {
        return null;
      }
      return JSON.parse(saved);
    } catch (e) {
      console.error('Failed to load profile:', e);
      return null;
    }
  }

  /**
   * Check if a profile exists
   * @returns {boolean}
   */
  static hasProfile() {
    return localStorage.getItem(STORAGE_KEY) !== null;
  }

  /**
   * Clear all profile data
   */
  static clearProfile() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      console.error('Failed to clear profile:', e);
    }
  }

  /**
   * Get storage usage info
   * @returns {Object} { used: bytes, available: bytes, percentFull: number }
   */
  static getStorageUsage() {
    let used = 0;
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      used = saved.length * 2; // Rough estimate: 2 bytes per character
    }

    // localStorage limit is typically 5-10MB, using 5MB as estimate
    const available = 5 * 1024 * 1024; // 5MB
    const percentFull = (used / available) * 100;

    return {
      used,
      available,
      percentFull,
    };
  }

  /**
   * Check if save would exceed quota
   * @param {string} newData - JSON string of new data
   * @returns {Object} { canSave: boolean, message?: string, quotaWarning?: boolean }
   */
  static checkQuotaBeforeSave(newData) {
    const newSize = newData.length * 2; // Rough estimate
    const limit = 5 * 1024 * 1024; // 5MB

    if (newSize > limit) {
      return {
        canSave: false,
        message: 'Profile data is too large (exceeds 5MB limit). Please remove signatures or custom fields.',
      };
    }

    const percentFull = (newSize / limit) * 100;
    if (percentFull > QUOTA_WARNING_THRESHOLD * 100) {
      return {
        canSave: true,
        quotaWarning: true,
        message: `Warning: Profile is ${Math.round(percentFull)}% of storage limit. Consider removing old signatures or custom fields.`,
      };
    }

    return { canSave: true };
  }

  /**
   * Get cleanup suggestions
   * @returns {string[]} Array of cleanup suggestions
   */
  static getCleanupSuggestions() {
    const usage = this.getStorageUsage();
    const suggestions = [];

    if (usage.percentFull > 50) {
      suggestions.push('Remove unused signatures from your profile');
      suggestions.push('Delete custom fields you no longer need');
      suggestions.push('Clear old form data if not needed');
    }

    return suggestions;
  }
}
