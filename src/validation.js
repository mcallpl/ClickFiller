/**
 * Profile data validation module
 * Validates all profile fields before saving
 */

const VALIDATORS = {
  firstName: {
    validate: (value) => {
      if (!value) {
        return true;
      } // optional
      if (value.length > 50) {
        return false;
      }
      // Allow any Unicode letter (incl. accented, e.g. José), plus hyphens and apostrophes
      return /^[\p{L}'-]+$/u.test(value);
    },
    message: 'First name must be max 50 characters, letters/hyphens/apostrophes only',
  },
  middleName: {
    validate: (value) => {
      if (!value) {
        return true;
      } // optional
      if (value.length > 50) {
        return false;
      }
      return /^[\p{L}'-]+$/u.test(value);
    },
    message: 'Middle name must be max 50 characters, letters/hyphens/apostrophes only',
  },
  lastName: {
    validate: (value) => {
      if (!value) {
        return true;
      } // optional
      if (value.length > 50) {
        return false;
      }
      return /^[\p{L}'-]+$/u.test(value);
    },
    message: 'Last name must be max 50 characters, letters/hyphens/apostrophes only',
  },
  email: {
    validate: (value) => {
      if (!value) {
        return true;
      } // optional
      // RFC 5322 simplified regex
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(value) && value.length <= 100;
    },
    message: 'Email must be a valid email address',
  },
  phone: {
    validate: (value) => {
      if (!value) {
        return true;
      } // optional
      // Digits and dashes only, 10-15 characters
      const phoneRegex = /^[\d+() -]{10,15}$/;
      return phoneRegex.test(value);
    },
    message: 'Phone must be 10-15 characters, digits and dashes only',
  },
  workPhone: {
    validate: (value) => {
      if (!value) {
        return true;
      } // optional
      const phoneRegex = /^[\d+() -]{10,15}$/;
      return phoneRegex.test(value);
    },
    message: 'Work phone must be 10-15 characters, digits and dashes only',
  },
  emergencyContactPhone: {
    validate: (value) => {
      if (!value) {
        return true;
      } // optional
      const phoneRegex = /^[\d+() -]{10,15}$/;
      return phoneRegex.test(value);
    },
    message: 'Emergency contact phone must be 10-15 characters, digits and dashes only',
  },
  ssn4: {
    validate: (value) => {
      if (!value) {
        return true;
      } // optional
      return /^\d{4}$/.test(value);
    },
    message: 'SSN (last 4) must be exactly 4 digits',
  },
  dateOfBirth: {
    validate: (value) => {
      if (!value) {
        return true;
      } // optional
      // Require strict ISO YYYY-MM-DD format
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
      if (!m) {
        return false;
      }
      const year = Number(m[1]);
      const month = Number(m[2]);
      const day = Number(m[3]);
      // Build the date in UTC and verify the parts round-trip. This rejects
      // impossible dates like 2000-02-30, which the JS Date constructor would
      // otherwise silently roll over to a valid nearby date (e.g. Feb 29).
      const date = new Date(Date.UTC(year, month - 1, day));
      if (
        date.getUTCFullYear() !== year ||
        date.getUTCMonth() !== month - 1 ||
        date.getUTCDate() !== day
      ) {
        return false;
      }
      // Check it's not a future date
      if (date.getTime() > Date.now()) {
        return false;
      }
      return true;
    },
    message: 'Date of birth must be a valid date in the past',
  },
  zipCode: {
    validate: (value) => {
      if (!value) {
        return true;
      } // optional
      // US zip code: 5 or 9 digits (with or without hyphen)
      return /^\d{5}(-\d{4})?$/.test(value);
    },
    message: 'ZIP code must be 5 or 9 digits (e.g., 12345 or 12345-6789)',
  },
  gender: {
    validate: (value) => {
      if (!value) {
        return true;
      } // optional
      return value.length <= 50;
    },
    message: 'Gender must be max 50 characters',
  },
  streetAddress: {
    validate: (value) => {
      if (!value) {
        return true;
      } // optional
      return value.length <= 100;
    },
    message: 'Street address must be max 100 characters',
  },
  aptUnit: {
    validate: (value) => {
      if (!value) {
        return true;
      } // optional
      return value.length <= 50;
    },
    message: 'Apt/Unit must be max 50 characters',
  },
  city: {
    validate: (value) => {
      if (!value) {
        return true;
      } // optional
      return value.length <= 50 && /^[a-zA-Z\s\-']+$/.test(value);
    },
    message: 'City must be max 50 characters, letters and spaces/hyphens/apostrophes only',
  },
  state: {
    validate: (value) => {
      if (!value) {
        return true;
      } // optional
      return value.length <= 50 && /^[a-zA-Z\s\-']+$/.test(value);
    },
    message: 'State must be max 50 characters, letters and spaces/hyphens/apostrophes only',
  },
  employer: {
    validate: (value) => {
      if (!value) {
        return true;
      } // optional
      return value.length <= 100;
    },
    message: 'Employer must be max 100 characters',
  },
  jobTitle: {
    validate: (value) => {
      if (!value) {
        return true;
      } // optional
      return value.length <= 100;
    },
    message: 'Job title must be max 100 characters',
  },
  insuranceProvider: {
    validate: (value) => {
      if (!value) {
        return true;
      } // optional
      return value.length <= 100;
    },
    message: 'Insurance provider must be max 100 characters',
  },
  policyNumber: {
    validate: (value) => {
      if (!value) {
        return true;
      } // optional
      return value.length <= 50;
    },
    message: 'Policy number must be max 50 characters',
  },
  groupNumber: {
    validate: (value) => {
      if (!value) {
        return true;
      } // optional
      return value.length <= 50;
    },
    message: 'Group number must be max 50 characters',
  },
  emergencyContactName: {
    validate: (value) => {
      if (!value) {
        return true;
      } // optional
      return value.length <= 50 && /^[a-zA-Z\s\-']+$/.test(value);
    },
    message: 'Emergency contact name must be max 50 characters, letters and spaces/hyphens/apostrophes only',
  },
  emergencyContactRelation: {
    validate: (value) => {
      if (!value) {
        return true;
      } // optional
      return value.length <= 50;
    },
    message: 'Emergency contact relationship must be max 50 characters',
  },
};

/**
 * Validate a complete profile object
 * @param {Object} data - Profile data to validate
 * @returns {Object} { valid: boolean, errors: Object<fieldName, errorMessage> }
 */
export function validateProfile(data) {
  const errors = {};

  // Validate each known field
  Object.entries(data).forEach(([key, value]) => {
    if (key === '_custom') {
      return;
    } // Skip custom fields array

    if (VALIDATORS[key]) {
      if (!VALIDATORS[key].validate(value)) {
        errors[key] = VALIDATORS[key].message;
      }
    }
  });

  // Validate custom fields if present
  if (data._custom && Array.isArray(data._custom)) {
    data._custom.forEach((field, idx) => {
      if (!field.label || !field.value) {
        return;
      }

      // Custom field label: max 50 chars. Allow the punctuation that appears
      // in real printed form labels — parentheses, comma, period, slash, hash,
      // ampersand, apostrophe, colon, asterisk — so a legitimate label like
      // "Weight (lb)" or "Policy #" never fails the save. Still rejects markup
      // and injection characters (@, <, >, {, }, etc.).
      if (field.label.length > 50 || !/^[a-zA-Z0-9\s\-().,/#&':*]+$/.test(field.label)) {
        errors[`_custom_label_${idx}`] = 'Custom field name must be max 50 characters; letters, numbers, spaces and basic punctuation only';
      }

      // Custom field value: max 100 chars
      if (field.value.length > 100) {
        errors[`_custom_value_${idx}`] = 'Custom field value must be max 100 characters';
      }
    });
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Get validation error message for a field (if any)
 * @param {string} fieldName - Name of the field
 * @param {any} value - Value to validate
 * @returns {string|null} Error message or null if valid
 */
export function getFieldError(fieldName, value) {
  if (!VALIDATORS[fieldName]) {
    return null;
  }
  if (!VALIDATORS[fieldName].validate(value)) {
    return VALIDATORS[fieldName].message;
  }
  return null;
}

/**
 * Sanitize a custom field value (remove suspicious characters)
 * @param {string} value - Value to sanitize
 * @returns {string} Sanitized value
 */
export function sanitizeCustomValue(value) {
  // Remove anything that looks like a script or HTML tag
  return value
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .trim();
}
