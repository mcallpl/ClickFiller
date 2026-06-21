# ClickFiller Security & Privacy Policy

## Overview

ClickFiller is a privacy-first form-filling application designed to help users quickly fill out paper or digital forms using stored personal information. **All data is stored locally on your device** — nothing is uploaded to our servers (except what you choose to send to Claude for analysis).

### Mission
We believe you should control your data. This app stores everything on your device and gives you complete control over deletion.

---

## Data Collection & Storage

### What Information We Collect

ClickFiller collects the following information that you voluntarily enter:

#### Personal Information
- First name, middle name, last name
- Date of birth
- Gender
- SSN (last 4 digits only)

#### Contact Information
- Email address
- Phone number
- Street address
- Apartment/unit number
- City, state, ZIP code

#### Employment Information
- Employer name
- Job title
- Work phone number

#### Insurance Information
- Insurance provider name
- Policy number
- Group number

#### Custom Fields
- Any additional fields you create (e.g., "Driver's License #")

#### Signatures
- Image files of your handwritten signatures

#### Form Images
- Photos of forms you capture with your camera
- Uploaded images of forms

### How Data Is Stored Locally

All personal data is stored in your browser's **localStorage** as a JSON text file. This storage is:

- **Local**: Stored only on your device
- **Domain-specific**: Cannot be accessed by other websites
- **Unencrypted**: Currently stored as plaintext (encryption coming Phase 2)
- **Persistent**: Remains until you clear browser data or use "Clear All Data"

**Storage Locations in Browser:**
- Profile data: `localStorage['clickfiller_profile']`
- Saved form results: `localStorage['clickfiller_saved_result']`
- Signatures: `localStorage['clickfiller_signatures']`

### How Data Is NOT Stored

We do **NOT** use:
- Cookies for data storage
- Cloud storage (AWS, Google Cloud, Azure)
- Third-party analytics services
- Tracking pixels or beacons
- Device phone contacts
- Server-side databases

---

## Data Transmission & Processing

### When Data Leaves Your Device

Your profile data and form images are sent to Claude (Anthropic's AI) **only** when you:
1. Take a photo of a form
2. Choose "Fill Form" button
3. Explicitly confirm the action

### What Data Is Sent to Claude

- **Form image** (photo/upload of the form to analyze)
- **Your profile data** (the information you entered in "My Info")

### What Claude Does With Your Data

Claude analyzes the form image and your profile data to:
1. Identify form fields
2. Determine where to place your information
3. Return field positions as JSON coordinates
4. Generate filled text overlay

### What Claude Does NOT Do

- Store your data
- Share your data with third parties
- Use your data to train models
- Track you across sessions

**See Anthropic's privacy policy:** https://www.anthropic.com/privacy

### Data Retention

- **Your device**: Until you delete it (using "Clear All Data" or browser settings)
- **Anthropic's servers**: Per Anthropic's data retention policy (typically 30 days)
- **ClickFiller servers**: We don't have a server database

---

## Security Measures

### Current Protections (Phase 1)

1. **Input Sanitization**
   - All profile data cleaned before sending to Claude
   - Removes newlines, tabs, and special characters
   - Prevents prompt injection attacks

2. **Security Headers**
   - X-Content-Type-Options: nosniff (prevents MIME sniffing)
   - X-Frame-Options: DENY (prevents clickjacking)
   - X-XSS-Protection: 1; mode=block (blocks XSS attacks)

3. **HTTPS (Production)**
   - All connections encrypted in transit

4. **Browser Isolation**
   - No cross-site access to localStorage
   - No third-party scripts with data access

### Future Protections (Phase 2)

1. **Encryption at Rest**
   - AES-256-GCM encryption for sensitive fields
   - Encryption key derived from your master password
   - Decryption only when you use the app

2. **Secure Key Management**
   - PBKDF2 key derivation with 100,000+ iterations
   - Master key backup/recovery options
   - Session-based key expiration

---

## Your Data Rights

### Right to Access
You can see all your data by going to "My Info" tab. Everything displayed is exactly what we have stored.

### Right to Deletion
You can delete **all your data** using the red "Clear All Data" button in the profile section:
1. Click "Clear All Data"
2. Confirm the deletion
3. All local data is immediately removed
4. No recovery is possible

This deletion is:
- **Immediate**: Takes effect instantly
- **Complete**: Removes profile, signatures, saved results
- **Irreversible**: No undo or recovery option
- **Local only**: Doesn't affect data already sent to Claude

### Right to Portability
You can export your profile data by:
1. Opening browser developer tools (F12)
2. Going to Console tab
3. Running: `JSON.stringify(JSON.parse(localStorage.clickfiller_profile), null, 2)`
4. Copy and paste the JSON to save it

### Right to Withdraw Consent
If you don't want to send data to Claude:
- Simply don't click "Fill Form"
- Keep your profile data locally without ever using the analysis feature

---

## Privacy by Design

### What We Don't Track

We do **NOT** track:
- How many times you use the app
- Which forms you fill
- Your location or device
- Your IP address in logs
- User session IDs or cookies

### Minimal Data Collection

We only collect data you explicitly enter:
- No automatic device scanning
- No contact list harvesting
- No geolocation
- No device identifiers

---

## Regulatory Compliance

### GDPR (General Data Protection Regulation)

**Compliance Status: PARTIAL** (Full compliance in Phase 2)

- ✅ **Data Minimization**: We only collect what's necessary
- ✅ **Transparency**: This policy explains everything
- ✅ **Right to Deletion**: "Clear All Data" button implemented
- ✅ **No Cookies**: Single localStorage source only
- ✅ **No Tracking**: No analytics or third-party services
- ⏳ **Encryption**: Coming in Phase 2

**Your GDPR rights:**
- Right to access (view your data in My Info)
- Right to deletion (Clear All Data button)
- Right to data portability (export via console)
- Right to object (don't use the app)
- Right to withdraw consent (delete and close app)

### CCPA (California Consumer Privacy Act)

**Compliance Status: PARTIAL** (Full compliance in Phase 2)

- ✅ **Right to Know**: You can view all data in My Info
- ✅ **Right to Delete**: Clear All Data button available
- ✅ **Right to Opt-Out**: Simply don't use the app
- ✅ **No Sale of Data**: We never sell or share your data
- ✅ **Privacy Notice**: This document serves as notice

**Your CCPA rights:**
- Right to know what data is collected
- Right to delete collected data
- Right to opt-out of future collection
- No discrimination for exercising rights

### HIPAA (Health Insurance Portability & Accountability Act)

**Compliance Status: NOT COMPLIANT** (As currently designed)

⚠️ **Important**: ClickFiller is **not** HIPAA-compliant. If you store protected health information (PHI), you should not use this application until Phase 2 encryption is complete.

Examples of PHI you should **not** store:
- Full insurance policy numbers
- Health history
- Medical conditions
- Prescription information

Safe to store:
- Insurance provider name (can be entered, encrypted in Phase 2)
- Policy number (encrypted in Phase 2)

**Recommendation**: Avoid storing unencrypted insurance data until Phase 2 encryption is live.

---

## Third-Party Services

### Services We Use

1. **Anthropic Claude API**
   - Used only for form analysis
   - When: Only when you click "Fill Form"
   - Data sent: Form image + profile data
   - Privacy: Subject to Anthropic's privacy policy

2. **jsPDF**
   - Used to generate PDF exports
   - Runs locally in your browser
   - No data sent to servers

### Services We Do NOT Use

- Google Analytics
- Sentry (error tracking)
- Mixpanel (user analytics)
- Intercom (customer support chat)
- Third-party advertising

---

## How to Delete Your Data

### Option 1: Using the App (Recommended)

1. Go to "My Info" tab
2. Scroll down to "Clear All Data" button (red button)
3. Click the button
4. Confirm in the popup
5. All data is immediately deleted

### Option 2: Using Browser Settings

**Chrome/Brave/Edge:**
1. Press Ctrl+Shift+Delete
2. Select "All time"
3. Check "Cookies and other site data"
4. Click "Clear data"

**Firefox:**
1. Press Ctrl+Shift+Delete
2. Select "Everything"
3. Check "Site preferences"
4. Click "Clear Now"

**Safari:**
1. Preferences → Privacy
2. "Manage Website Data"
3. Search for ClickFiller domain
4. Click "Remove All"

### Option 3: Delete Locally Stored Files

If you've downloaded forms, signatures, or PDFs:
1. Locate the files in your Downloads folder
2. Delete manually
3. Empty your trash/recycle bin

---

## Data Retention

### On Your Device

- **Profile**: Kept until you delete it
- **Signatures**: Kept until you delete them
- **Form images**: Kept until you delete them
- **Saved results**: Kept until you delete them

You have full control. Everything can be deleted instantly.

### In Anthropic's Systems

- **Form images**: Typically retained for 30 days
- **Profile data**: Typically retained for 30 days
- **Conversation logs**: Subject to Anthropic's retention policy

See Anthropic's privacy policy for details: https://www.anthropic.com/privacy

### In ClickFiller's Servers

- **We have no servers**: ClickFiller is a client-side app
- **No data storage**: No backend database for user data
- **No telemetry**: We don't log user activity

---

## Security Incident Response

### How We Respond to Security Issues

1. **Detection**: Monitor for unusual activity
2. **Assessment**: Determine severity and scope
3. **Remediation**: Deploy fixes to app
4. **Notification**: Alert users if necessary (via app update)

### Reporting Security Issues

If you discover a security vulnerability:

1. **Do not** post it publicly
2. **Do not** exploit or test further
3. **Email**: security@clickfiller.app (when available)
4. **Include**: Description, steps to reproduce, impact

We take security seriously and will:
- Acknowledge receipt within 48 hours
- Provide timeline for fix
- Credit you for responsible disclosure
- Issue fix as soon as possible

---

## Frequently Asked Questions (FAQ)

### Q: Is my data truly private?
**A:** Yes, your profile data is stored only on your device. However, when you use the form-filling feature, your data is sent to Anthropic's Claude API for analysis. See Anthropic's privacy policy for how they handle it.

### Q: Can ClickFiller see my data?
**A:** No. ClickFiller is a client-side app with no server backend. Your device is the only place your data exists locally.

### Q: Can other websites access my data?
**A:** No. Browser localStorage is domain-specific and isolated from other websites.

### Q: What if I lose my phone/device?
**A:** Any data stored locally on that device is lost. Data sent to Claude's API may still be subject to Anthropic's retention policy.

### Q: Can I use ClickFiller for insurance forms?
**A:** Yes, but be aware that insurance policy numbers and group numbers will be unencrypted until Phase 2. For highly sensitive data, wait for encryption or enter manually.

### Q: Will ClickFiller sell my data?
**A:** No. We don't have a business model based on data sales. ClickFiller is designed for privacy.

### Q: What if I sync my browser between devices?
**A:** Be aware that browser sync features (like Chrome Sync) may replicate localStorage data to other devices. If you don't want this, disable browser sync before using ClickFiller.

### Q: Can I export my data?
**A:** Yes. Use the manual export method:
   1. Open browser console (F12)
   2. Run: `JSON.stringify(JSON.parse(localStorage.clickfiller_profile), null, 2)`
   3. Copy and save the JSON

### Q: Is this app HIPAA-compliant?
**A:** Not yet. Phase 2 encryption will make it suitable for limited HIPAA use. Do not store unencrypted PHI.

### Q: Can I delete data sent to Claude?
**A:** No, not from ClickFiller's side. You'd need to submit a deletion request to Anthropic directly. See their privacy policy.

---

## Contact & Support

For privacy questions:
- **Email**: privacy@clickfiller.app (when available)
- **GitHub**: Create a private security advisory
- **In-app**: Use "Report Issue" feature (future)

---

## Policy Updates

This privacy policy may be updated from time to time. When we make significant changes:

1. We will update the version date below
2. We will notify users via app notification (future)
3. Continued use constitutes acceptance

**Current Version:** 1.0 (Phase 1)
**Last Updated:** June 2025
**Next Review:** After Phase 2 implementation

---

## Summary: Your Privacy Principles

1. **Your Data, Your Rules**: You control what's stored and when
2. **Local First**: All data stays on your device by default
3. **No Tracking**: We don't monitor your usage
4. **No Selling**: We never monetize your data
5. **Transparent**: This document explains everything
6. **Easy Deletion**: Delete all data with one click
7. **Future Protection**: Encryption coming in Phase 2

---

**By using ClickFiller, you agree to this Privacy & Security Policy.**
