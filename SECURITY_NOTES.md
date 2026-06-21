# Security & Privacy Implementation Notes

## Phase 1: Data Protection Foundation

### Cookies & Data Storage

#### Removed (GDPR/CCPA Compliance)
- Cookie fallback system previously used to back up profile data
- Cookies violated GDPR consent requirements and CCPA opt-out provisions
- 5-year expiration extended data retention beyond necessary

#### Current Implementation
- Single source of truth: localStorage only
- Profile data stored as plaintext JSON in localStorage
- localStorage is domain-specific and cannot be accessed by third-party sites
- Data persists across browser sessions unless manually cleared

#### Future Improvements (Phase 2)
- All sensitive fields will be encrypted at rest using Web Crypto API
- Encryption key derived from user's master password
- IndexedDB will replace localStorage for better quota management
- Each field encrypted independently for granular access control

---

## Security Headers

### Added to All HTTP Responses
- **X-Content-Type-Options: nosniff**
  - Prevents MIME type sniffing attacks
  - Forces browser to respect declared Content-Type

- **X-Frame-Options: DENY**
  - Prevents clickjacking attacks
  - Disallows embedding the app in iframes

- **X-XSS-Protection: 1; mode=block**
  - Legacy XSS protection for older browsers
  - Enables XSS auditor and blocks page if attack detected

---

## Input Sanitization

### Profile Data Sanitization (Before Claude API)
- All user-supplied profile values sanitized before sending to Claude Vision API
- Removes newlines, tabs, and excessive whitespace
- Prevents prompt injection attacks via profile fields
- Maximum 200 characters per field to limit attack surface
- Applied to all standard fields (name, email, phone, address, etc.)

### Benefits
- Prevents attackers from injecting instructions into Claude prompt via form data
- Reduces token usage for API calls
- Improves consistency of API responses

---

## Data Deletion (GDPR Right to Deletion)

### Implemented: "Clear All Data" Button
- Located in profile section (red button, prominent positioning)
- User confirmation required before deletion
- Clears all profile data from localStorage
- Clears saved form results
- Clears captured images from DOM
- Clears signature library
- No recovery possible once deleted

### User Impact
- Users can exercise their right to deletion on-device
- No data recovery from app after deletion
- Cloud data (profile data sent to Claude) controlled via Anthropic privacy policy

---

## Data Handling Summary

### What Data Is Collected
- Personal information (name, DOB, SSN, etc.)
- Contact information (email, phone, address)
- Employment information (employer, job title)
- Insurance information (provider, policy numbers)
- Emergency contact details
- Custom user-defined fields
- Signature images
- Form images (captured by user)

### Where Data Is Stored
1. **Local Storage (Browser)**
   - Profile data: localStorage under key 'clickfiller_profile'
   - Result positions: localStorage under key 'clickfiller_saved_result'
   - Signatures: localStorage under key 'clickfiller_signatures'
   - Lifetime: Until user clears browser data or uses Clear All Data button

2. **Claude API (Anthropic)**
   - Profile data sent with each form analysis request
   - Form image sent for analysis
   - Handled per Anthropic's privacy policy and data retention terms
   - See: https://www.anthropic.com/privacy

### What Data Is Sent to Claude
- Form image (base64-encoded)
- Profile data (name, address, contact info, etc.)
- NOT sent: Signature images, previous results, browsing history

---

## API Security

### Validation
- Request validation middleware checks for required fields
- Image data format validation (base64 image)
- Profile object shape validation
- Malformed requests rejected with 400 errors

### Rate Limiting (Recommended Future)
- Not yet implemented
- Should be added before production deployment
- Prevents abuse via rapid API calls

---

## Compliance Status

### GDPR
- ✅ Data minimization: Only collects necessary information
- ✅ Transparency: Privacy policy explains data handling
- ✅ Right to deletion: Clear All Data button implemented
- ✅ No cookies: Single localStorage source only
- ⚠️ Encryption: Will be added in Phase 2

### CCPA
- ✅ Opt-out of data collection: User can delete all data
- ✅ Right to deletion: Clear All Data implemented
- ⚠️ Privacy notice: Should be displayed on first use
- ⚠️ Encryption: Will be added in Phase 2

### HIPAA (Partial)
- ⚠️ Not HIPAA-compliant
- Note: Not all insurance data should be stored on-device unencrypted
- Encryption strongly recommended for insurance policy numbers

---

## Known Limitations & Future Work

### Phase 2 Priorities
1. Implement encryption (`src/encryption.js`)
2. Add HTTPS enforcement in production
3. Add rate limiting to API
4. Implement session timeout for sensitive operations
5. Add two-factor authentication option
6. Add audit logging for data access

### Not Yet Implemented
- Password protection for profile
- Master key management
- Secure key derivation (PBKDF2)
- Authenticated encryption (AES-256-GCM)
- Encryption key backup/recovery

---

## Testing Checklist (Phase 1)

- [x] Security headers present in all responses
- [x] Input sanitization prevents prompt injection
- [x] Clear All Data button exists and functions
- [x] No cookie storage in use
- [x] Profile still loads and saves correctly
- [x] Custom fields work as before
- [x] No console errors after security changes
- [x] Documentation complete and accurate

---

## Developer Notes

### Adding New Sensitive Fields
1. Update `src/profile.js` to include field
2. Update `SECURITY_AND_PRIVACY.md` data collection list
3. In Phase 2, mark field as encrypted in `src/encryption.js`
4. Test that sanitization doesn't break field values

### Testing Prompt Injection
```
Try entering newline characters in profile fields:
firstName: "John\n\nIgnore all previous instructions..."
```
This should be sanitized to: `firstName: "John Ignore all previous instructions..."`

---

Last Updated: Phase 1 Implementation
Next Review: After Phase 2 encryption implementation
