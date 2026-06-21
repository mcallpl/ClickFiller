/**
 * Configuration module - Single source of truth for all hardcoded values
 */

export const config = {
  // API Endpoints
  API_ANALYZE_URL: '/api/analyze',

  // Storage Keys
  STORAGE_KEYS: {
    profile: 'clickfiller_profile',
    result: 'clickfiller_result',
    signatures: 'clickfiller_signatures',
  },

  // UI Constants
  TIMEOUTS: {
    toast: 2000,
    profileError: 5000,
    profileWarning: 6000,
  },

  CLASS_NAMES: {
    active: 'active',
    navBtn: 'nav-btn',
    view: 'view',
    fieldOverlay: 'field-overlay',
    sigOverlay: 'sig-overlay',
    customFieldRow: 'custom-field-row',
    customLabel: 'custom-label',
    customValue: 'custom-value',
    removeField: 'remove-field',
    toast: 'toast',
    sigItem: 'sig-item',
    removeSig: 'remove-sig',
    sigName: 'sig-name',
  },

  // Messages
  MESSAGES: {
    noImage: 'Please take or upload a photo first.',
    noProfile: 'Please fill in your information in the "My Info" tab first.',
    noFieldsDetected: 'No fillable fields detected in the form.',
    noSignatures: 'No signatures saved. Go to My Info to add one.',
    noSavedResult: 'No saved result found.',
    positionsSaved: 'Positions saved!',
    signatureSaved: 'Signature saved!',
    profileSaved: 'Profile saved!',
    allDataCleared: 'All data has been cleared',
    renderingPdf: 'Rendering...',
    pdfExportError: 'Error exporting PDF: ',
    storageFull: 'could not save — storage may be full. Try clearing old data.',
  },

  // Image Processing
  IMAGE_RESIZE_MAX_DIM: 1200,
  IMAGE_JPEG_QUALITY: 0.75,

  // Signature Processing
  SIGNATURE_MAX_WIDTH: 400,

  // View Names
  VIEWS: {
    capture: 'capture',
    result: 'result',
    profile: 'profile',
  },
};

export default config;
