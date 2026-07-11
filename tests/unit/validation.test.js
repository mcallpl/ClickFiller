/**
 * Unit tests for validation.js
 * Tests all validation rules with 100% coverage
 */

import { validateProfile, getFieldError, sanitizeCustomValue } from '../../src/validation.js';
import { VALID_PROFILE, PARTIAL_PROFILE, PROFILE_WITH_CUSTOM_FIELDS } from '../helpers/mock-data.js';

describe('Validation Module', () => {
  describe('validateProfile()', () => {
    it('should return valid=true for a complete valid profile', () => {
      const result = validateProfile(VALID_PROFILE);
      expect(result.valid).toBe(true);
      expect(Object.keys(result.errors).length).toBe(0);
    });

    it('should return valid=true for a partial profile (optional fields)', () => {
      const result = validateProfile(PARTIAL_PROFILE);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual({});
    });

    it('should return valid=true for empty object', () => {
      const result = validateProfile({});
      expect(result.valid).toBe(true);
    });

    it('should handle profiles with all empty optional fields', () => {
      const profile = {
        firstName: '',
        lastName: '',
        email: '',
      };
      const result = validateProfile(profile);
      expect(result.valid).toBe(true);
    });
  });

  describe('firstName validation', () => {
    it('should accept valid first names', () => {
      const names = ['John', 'Mary', 'Jean-Pierre', "O'Connor", 'José'];
      names.forEach(name => {
        const result = validateProfile({ firstName: name });
        expect(result.valid).toBe(true);
      });
    });

    it('should reject first names with numbers', () => {
      const result = validateProfile({ firstName: 'John123' });
      expect(result.valid).toBe(false);
      expect(result.errors.firstName).toBeDefined();
    });

    it('should reject first names over 50 characters', () => {
      const result = validateProfile({ firstName: 'A'.repeat(51) });
      expect(result.valid).toBe(false);
      expect(result.errors.firstName).toBeDefined();
    });

    it('should reject first names with special characters', () => {
      const result = validateProfile({ firstName: 'John@Doe' });
      expect(result.valid).toBe(false);
    });

    it('should accept empty first name (optional)', () => {
      const result = validateProfile({ firstName: '' });
      expect(result.valid).toBe(true);
    });

    it('should accept empty string for firstName', () => {
      const result = validateProfile({ firstName: undefined });
      expect(result.valid).toBe(true);
    });
  });

  describe('email validation', () => {
    it('should accept valid emails', () => {
      const emails = [
        'user@example.com',
        'john.smith@domain.co.uk',
        'test+tag@example.com',
        'user123@test.org',
      ];
      emails.forEach(email => {
        const result = validateProfile({ email });
        expect(result.valid).toBe(true);
      });
    });

    it('should reject emails without @ symbol', () => {
      const result = validateProfile({ email: 'invalidemail.com' });
      expect(result.valid).toBe(false);
      expect(result.errors.email).toBeDefined();
    });

    it('should reject emails without domain', () => {
      const result = validateProfile({ email: 'user@' });
      expect(result.valid).toBe(false);
    });

    it('should reject emails without local part', () => {
      const result = validateProfile({ email: '@example.com' });
      expect(result.valid).toBe(false);
    });

    it('should reject emails with spaces', () => {
      const result = validateProfile({ email: 'user @example.com' });
      expect(result.valid).toBe(false);
    });

    it('should reject emails over 100 characters', () => {
      const result = validateProfile({ email: 'a'.repeat(100) + '@example.com' });
      expect(result.valid).toBe(false);
    });

    it('should accept empty email (optional)', () => {
      const result = validateProfile({ email: '' });
      expect(result.valid).toBe(true);
    });
  });

  describe('phone validation', () => {
    it('should accept valid phone numbers', () => {
      const phones = [
        '555-123-4567',
        '5551234567',
        '(555) 123-4567',
        '+1-555-123-4567',
        '+15551234567',
        '555 123 4567',
      ];
      phones.forEach(phone => {
        const result = validateProfile({ phone });
        expect(result.valid).toBe(true);
      });
    });

    it('should reject phone numbers with letters', () => {
      const result = validateProfile({ phone: '555-CALL-NOW' });
      expect(result.valid).toBe(false);
    });

    it('should reject phone numbers too short', () => {
      const result = validateProfile({ phone: '555-1234' });
      expect(result.valid).toBe(false);
    });

    it('should reject phone numbers too long', () => {
      const result = validateProfile({ phone: '1-555-123-4567-8901' });
      expect(result.valid).toBe(false);
    });

    it('should accept exactly 10 digits', () => {
      const result = validateProfile({ phone: '5551234567' });
      expect(result.valid).toBe(true);
    });

    it('should accept exactly 15 characters', () => {
      const result = validateProfile({ phone: '+1-555-123-4567' });
      expect(result.valid).toBe(true);
    });

    it('should accept empty phone (optional)', () => {
      const result = validateProfile({ phone: '' });
      expect(result.valid).toBe(true);
    });
  });

  describe('SSN validation', () => {
    it('should accept valid 4-digit SSN', () => {
      const result = validateProfile({ ssn4: '1234' });
      expect(result.valid).toBe(true);
    });

    it('should accept SSN with leading zero', () => {
      const result = validateProfile({ ssn4: '0001' });
      expect(result.valid).toBe(true);
    });

    it('should reject SSN with 3 digits', () => {
      const result = validateProfile({ ssn4: '123' });
      expect(result.valid).toBe(false);
      expect(result.errors.ssn4).toBeDefined();
    });

    it('should reject SSN with 5 digits', () => {
      const result = validateProfile({ ssn4: '12345' });
      expect(result.valid).toBe(false);
    });

    it('should reject SSN with letters', () => {
      const result = validateProfile({ ssn4: 'ABCD' });
      expect(result.valid).toBe(false);
    });

    it('should accept empty SSN (optional)', () => {
      const result = validateProfile({ ssn4: '' });
      expect(result.valid).toBe(true);
    });
  });

  describe('zipCode validation', () => {
    it('should accept 5-digit ZIP code', () => {
      const result = validateProfile({ zipCode: '12345' });
      expect(result.valid).toBe(true);
    });

    it('should accept 9-digit ZIP+4 code', () => {
      const result = validateProfile({ zipCode: '12345-6789' });
      expect(result.valid).toBe(true);
    });

    it('should accept ZIP code starting with 0', () => {
      const result = validateProfile({ zipCode: '01234' });
      expect(result.valid).toBe(true);
    });

    it('should reject ZIP code with 4 digits', () => {
      const result = validateProfile({ zipCode: '1234' });
      expect(result.valid).toBe(false);
      expect(result.errors.zipCode).toBeDefined();
    });

    it('should reject ZIP code with 6 digits', () => {
      const result = validateProfile({ zipCode: '123456' });
      expect(result.valid).toBe(false);
    });

    it('should reject ZIP code with letters', () => {
      const result = validateProfile({ zipCode: '1234A' });
      expect(result.valid).toBe(false);
    });

    it('should reject ZIP+4 without hyphen', () => {
      const result = validateProfile({ zipCode: '123456789' });
      expect(result.valid).toBe(false);
    });

    it('should accept empty ZIP code (optional)', () => {
      const result = validateProfile({ zipCode: '' });
      expect(result.valid).toBe(true);
    });
  });

  describe('dateOfBirth validation', () => {
    it('should accept valid past dates', () => {
      const result = validateProfile({ dateOfBirth: '1990-05-15' });
      expect(result.valid).toBe(true);
    });

    it('should accept valid date format', () => {
      const result = validateProfile({ dateOfBirth: '2000-12-31' });
      expect(result.valid).toBe(true);
    });

    it('should reject future dates', () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);
      const result = validateProfile({ dateOfBirth: futureDate.toISOString().split('T')[0] });
      expect(result.valid).toBe(false);
      expect(result.errors.dateOfBirth).toBeDefined();
    });

    it('should reject invalid date format', () => {
      const result = validateProfile({ dateOfBirth: 'not-a-date' });
      expect(result.valid).toBe(false);
    });

    it('should reject invalid date', () => {
      const result = validateProfile({ dateOfBirth: '2000-02-30' });
      expect(result.valid).toBe(false);
    });

    it('should accept empty date (optional)', () => {
      const result = validateProfile({ dateOfBirth: '' });
      expect(result.valid).toBe(true);
    });
  });

  describe('address fields validation', () => {
    it('should accept valid street address', () => {
      const result = validateProfile({ streetAddress: '123 Main Street' });
      expect(result.valid).toBe(true);
    });

    it('should reject street address over 100 chars', () => {
      const result = validateProfile({ streetAddress: 'A'.repeat(101) });
      expect(result.valid).toBe(false);
    });

    it('should accept valid city name', () => {
      const result = validateProfile({ city: 'New York' });
      expect(result.valid).toBe(true);
    });

    it('should accept city with hyphens', () => {
      const result = validateProfile({ city: 'Saint-Louis' });
      expect(result.valid).toBe(true);
    });

    it('should reject city with numbers', () => {
      const result = validateProfile({ city: 'City123' });
      expect(result.valid).toBe(false);
    });

    it('should accept valid state', () => {
      const result = validateProfile({ state: 'California' });
      expect(result.valid).toBe(true);
    });

    it('should accept valid apt/unit', () => {
      const result = validateProfile({ aptUnit: 'Apt 4B' });
      expect(result.valid).toBe(true);
    });

    it('should reject apt/unit over 50 chars', () => {
      const result = validateProfile({ aptUnit: 'A'.repeat(51) });
      expect(result.valid).toBe(false);
    });
  });

  describe('employment fields validation', () => {
    it('should accept valid employer', () => {
      const result = validateProfile({ employer: 'Acme Corporation' });
      expect(result.valid).toBe(true);
    });

    it('should reject employer over 100 chars', () => {
      const result = validateProfile({ employer: 'A'.repeat(101) });
      expect(result.valid).toBe(false);
    });

    it('should accept valid job title', () => {
      const result = validateProfile({ jobTitle: 'Software Engineer' });
      expect(result.valid).toBe(true);
    });

    it('should reject job title over 100 chars', () => {
      const result = validateProfile({ jobTitle: 'A'.repeat(101) });
      expect(result.valid).toBe(false);
    });
  });

  describe('insurance fields validation', () => {
    it('should accept valid insurance provider', () => {
      const result = validateProfile({ insuranceProvider: 'Blue Cross Blue Shield' });
      expect(result.valid).toBe(true);
    });

    it('should accept valid policy number', () => {
      const result = validateProfile({ policyNumber: 'POL123456' });
      expect(result.valid).toBe(true);
    });

    it('should accept valid group number', () => {
      const result = validateProfile({ groupNumber: 'GRP999' });
      expect(result.valid).toBe(true);
    });
  });

  describe('emergency contact fields validation', () => {
    it('should accept valid emergency contact name', () => {
      const result = validateProfile({ emergencyContactName: 'Jane Smith' });
      expect(result.valid).toBe(true);
    });

    it('should accept valid emergency contact relation', () => {
      const result = validateProfile({ emergencyContactRelation: 'Spouse' });
      expect(result.valid).toBe(true);
    });

    it('should accept valid emergency contact phone', () => {
      const result = validateProfile({ emergencyContactPhone: '555-111-2222' });
      expect(result.valid).toBe(true);
    });
  });

  describe('gender field validation', () => {
    it('should accept valid gender values', () => {
      const genders = ['Male', 'Female', 'Other', 'Prefer not to say'];
      genders.forEach(gender => {
        const result = validateProfile({ gender });
        expect(result.valid).toBe(true);
      });
    });

    it('should reject gender over 50 characters', () => {
      const result = validateProfile({ gender: 'A'.repeat(51) });
      expect(result.valid).toBe(false);
    });
  });

  describe('custom fields validation', () => {
    it('should validate profiles with custom fields', () => {
      const result = validateProfile(PROFILE_WITH_CUSTOM_FIELDS);
      expect(result.valid).toBe(true);
    });

    it('should reject custom field label over 50 chars', () => {
      const profile = {
        firstName: 'Test',
        _custom: [
          { label: 'A'.repeat(51), value: 'test' },
        ],
      };
      const result = validateProfile(profile);
      expect(result.valid).toBe(false);
      expect(result.errors._custom_label_0).toBeDefined();
    });

    it('should reject custom field label with invalid chars', () => {
      const profile = {
        firstName: 'Test',
        _custom: [
          { label: 'Field@Invalid', value: 'test' },
        ],
      };
      const result = validateProfile(profile);
      expect(result.valid).toBe(false);
    });

    it('should accept form-style custom labels with punctuation', () => {
      // Labels auto-saved from AI-detected form fields routinely contain
      // parentheses, commas, slashes, etc. These must NOT fail the save
      // (regression: they were rejected, discarding the whole profile).
      const labels = ['Weight (lb)', 'Height (e.g., 5 ft 10 in)', 'Policy #', 'Date (MM/DD/YYYY)'];
      labels.forEach((label) => {
        const result = validateProfile({ _custom: [{ label, value: 'x' }] });
        expect(result.valid).toBe(true);
      });
    });

    it('should not discard a valid custom field because another is invalid', () => {
      // The reported bug: one bad label failed the entire save. With label
      // normalization upstream, saved labels are clean; but even mixed input
      // must only flag the bad one, not claim the whole profile is invalid
      // for the good field.
      const result = validateProfile({
        _custom: [
          { label: 'Shoe Size', value: '10.5' },
          { label: 'Bad@Label', value: 'x' },
        ],
      });
      expect(result.errors._custom_label_0).toBeUndefined();
      expect(result.errors._custom_label_1).toBeDefined();
    });

    it('should reject custom field value over 100 chars', () => {
      const profile = {
        firstName: 'Test',
        _custom: [
          { label: 'CustomField', value: 'A'.repeat(101) },
        ],
      };
      const result = validateProfile(profile);
      expect(result.valid).toBe(false);
      expect(result.errors._custom_value_0).toBeDefined();
    });

    it('should skip incomplete custom fields', () => {
      const profile = {
        firstName: 'Test',
        _custom: [
          { label: 'Field1', value: '' },
          { label: '', value: 'value' },
        ],
      };
      const result = validateProfile(profile);
      expect(result.valid).toBe(true);
    });

    it('should handle multiple valid custom fields', () => {
      const profile = {
        firstName: 'Test',
        _custom: [
          { label: 'License', value: 'DL123' },
          { label: 'Passport', value: 'PP456' },
          { label: 'ID-Card', value: 'ID789' },
        ],
      };
      const result = validateProfile(profile);
      expect(result.valid).toBe(true);
    });
  });

  describe('getFieldError()', () => {
    it('should return null for valid field', () => {
      const error = getFieldError('email', 'test@example.com');
      expect(error).toBeNull();
    });

    it('should return error message for invalid field', () => {
      const error = getFieldError('email', 'invalid-email');
      expect(error).toBeDefined();
      expect(typeof error).toBe('string');
    });

    it('should return null for unknown field', () => {
      const error = getFieldError('unknownField', 'value');
      expect(error).toBeNull();
    });

    it('should return error for invalid phone', () => {
      const error = getFieldError('phone', '123');
      expect(error).toBeDefined();
    });

    it('should return error for invalid ZIP', () => {
      const error = getFieldError('zipCode', 'invalid');
      expect(error).toBeDefined();
    });

    it('should return null for empty optional field', () => {
      const error = getFieldError('firstName', '');
      expect(error).toBeNull();
    });
  });

  describe('sanitizeCustomValue()', () => {
    it('should remove HTML tags', () => {
      const input = 'Hello <script>alert("XSS")</script> World';
      const output = sanitizeCustomValue(input);
      expect(output).not.toContain('<script>');
      expect(output).toContain('Hello');
      expect(output).toContain('World');
    });

    it('should remove javascript: protocol', () => {
      const input = 'javascript: void(0)';
      const output = sanitizeCustomValue(input);
      expect(output).not.toContain('javascript:');
    });

    it('should trim whitespace', () => {
      const input = '   spaces   ';
      const output = sanitizeCustomValue(input);
      expect(output).toBe('spaces');
    });

    it('should handle normal text', () => {
      const input = 'John Doe Smith';
      const output = sanitizeCustomValue(input);
      expect(output).toBe('John Doe Smith');
    });

    it('should remove multiple HTML tags', () => {
      const input = '<div>Hello</div><script>bad</script><p>World</p>';
      const output = sanitizeCustomValue(input);
      expect(output).not.toContain('<');
      expect(output).not.toContain('>');
    });

    it('should handle case-insensitive javascript removal', () => {
      const input = 'JavaScript: malicious code';
      const output = sanitizeCustomValue(input);
      expect(output).not.toContain('JavaScript:');
      expect(output).not.toContain('javascript:');
    });

    it('should preserve safe content', () => {
      const input = 'Dr. Smith & Associates, Inc.';
      const output = sanitizeCustomValue(input);
      expect(output).toBe('Dr. Smith & Associates, Inc.');
    });
  });

  describe('edge cases and integration', () => {
    it('should handle multiple validation errors', () => {
      const profile = {
        firstName: 'John123',
        email: 'bad-email',
        phone: '123',
      };
      const result = validateProfile(profile);
      expect(result.valid).toBe(false);
      expect(Object.keys(result.errors).length).toBeGreaterThan(1);
    });

    it('should validate complete profile with all fields', () => {
      const result = validateProfile(VALID_PROFILE);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual({});
    });

    it('should ignore unknown fields', () => {
      const profile = {
        firstName: 'John',
        unknownField: 'value',
      };
      const result = validateProfile(profile);
      expect(result.valid).toBe(true);
    });
  });
});
