/**
 * Mock data for tests
 * Provides realistic test data for validation and integration tests
 */

export const VALID_PROFILE = {
  firstName: 'John',
  middleName: 'Q',
  lastName: 'Smith',
  email: 'john.smith@example.com',
  phone: '555-123-4567',
  workPhone: '(555) 987-6543',
  emergencyContactPhone: '+1-555-111-2222',
  ssn4: '1234',
  dateOfBirth: '1990-01-15',
  zipCode: '12345',
  zipCodePlus4: '12345-6789',
  gender: 'Male',
  streetAddress: '123 Main Street',
  aptUnit: 'Apt 4B',
  city: 'Springfield',
  state: 'Illinois',
  employer: 'Acme Corporation',
  jobTitle: 'Software Engineer',
  insuranceProvider: 'Blue Cross',
  policyNumber: 'BC12345678',
  groupNumber: 'GRP999',
  emergencyContactName: 'Jane Smith',
  emergencyContactRelation: 'Spouse',
};

export const INVALID_PROFILE = {
  firstName: 'John123', // Invalid: numbers
  email: 'not-an-email', // Invalid: no @
  phone: '123', // Invalid: too short
  ssn4: '12345', // Invalid: 5 digits
  zipCode: '123', // Invalid: too short
  city: 'New City 123', // Invalid: numbers
};

export const PARTIAL_PROFILE = {
  firstName: 'Jane',
  lastName: 'Doe',
  email: 'jane@example.com',
  // Other fields are optional
};

export const PROFILE_WITH_CUSTOM_FIELDS = {
  firstName: 'Bob',
  lastName: 'Johnson',
  _custom: [
    { label: 'Drivers License', value: 'DL123456789' },
    { label: 'Passport', value: 'PP987654321' },
  ],
};

export const MOCK_IMAGE_BASE64 = 'data:image/jpeg;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

export const MOCK_FORM_RESPONSE = {
  fields: [
    {
      label: 'Full Name',
      x: 20,
      y: 15,
      width: 50,
      height: 3,
      value: 'John Q Smith',
      fontSize: 1.5,
    },
    {
      label: 'Email',
      x: 20,
      y: 25,
      width: 50,
      height: 3,
      value: 'john.smith@example.com',
      fontSize: 1.5,
    },
    {
      label: 'Phone',
      x: 20,
      y: 35,
      width: 50,
      height: 3,
      value: '555-123-4567',
      fontSize: 1.5,
    },
  ],
};

export const OVERSIZED_IMAGE = 'data:image/jpeg;base64,' + 'A'.repeat(21 * 1024 * 1024);
