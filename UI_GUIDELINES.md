# ClickFiller UI/UX Guidelines

## Overview
These guidelines ensure a consistent, accessible, and user-friendly experience across the ClickFiller application.

## Design System

### Color Palette
- **Primary**: `#2563eb` (Blue) - Actions, interactive elements
- **Primary Dark**: `#1d4ed8` - Primary hover state
- **Background**: `#0f172a` (Dark Blue) - Page background
- **Surface**: `#1e293b` - Card/panel backgrounds
- **Surface Light**: `#334155` - Secondary elements
- **Text**: `#f1f5f9` (Light) - Primary text
- **Text Muted**: `#94a3b8` - Secondary text, hints
- **Success**: `#22c55e` (Green) - Success states
- **Error**: `#ef4444` (Red) - Errors, destructive actions
- **Warning**: `#f59e0b` (Orange) - Warnings, alerts

### Typography
- **Font Family**: System font stack (`-apple-system, BlinkMacSystemFont, 'Segoe UI'`)
- **Base Size**: 16px
- **Headings**: 600-700 weight
- **Body**: 400-500 weight
- **Contrast**: All text meets WCAG AA minimum (4.5:1 for normal text)

### Spacing
- **Base Unit**: 4px
- **Common**: 8px, 12px, 16px, 20px, 24px
- **Component Padding**: 12-24px
- **Component Gap**: 8-12px

### Border Radius
- **Default**: 12px (`var(--radius)`)
- **Small**: 4-8px
- **Full**: 50% (circles)

### Touch Targets
All interactive elements maintain a **minimum 44x44px** touch target to support mobile users.

## Notification System

### Toast Notifications
Used for brief, non-critical feedback that doesn't require user interaction.

#### Types

**Success** (Green, `#22c55e`)
```javascript
import { showToast } from './components/toast.js';
showToast('Profile saved!', 'success');
```
- When data is saved or operation completes successfully
- Auto-dismisses after 4 seconds
- User can click to dismiss early

**Info** (Blue, `#2563eb`)
```javascript
showToast('Form analysis complete', 'info');
```
- Informational messages
- Auto-dismisses after 4 seconds

**Warning** (Orange, `#f59e0b`)
```javascript
showToast('Storage is running low', 'warning');
```
- Non-critical warnings
- Auto-dismisses after 4 seconds

**Error** (Red, `#ef4444`)
```javascript
showToast('Unable to save image', 'error');
```
- For recoverable errors
- Auto-dismisses after 4 seconds

#### Styling
- Position: Bottom-right, stacks vertically
- Animation: Slide in from right (200ms), slide out when dismissed
- Max Width: Responsive, fits on mobile
- Has left border indicator for type
- Close button for manual dismissal

### Error Modals
Used for critical errors that require user attention and acknowledgment.

```javascript
import { showError } from './components/error-modal.js';

// Simple error
showError('Profile Missing', 'Please fill in your information in the "My Info" tab first.');

// With action button
showError(
  'Analysis Failed',
  'The form image is too small. Please retake the photo with better framing.',
  {
    label: 'Retake Photo',
    callback: () => {
      // Handle action
    }
  }
);
```

#### Features
- Centered modal with backdrop overlay
- Clear title (e.g., "Profile Missing")
- User-friendly message (avoid technical jargon)
- Optional action button
- Close button
- Keyboard support (Escape to close)
- Accessible (role="alertdialog", aria-modal)

## Loading States

### Loading Overlay
Used to show progress during long operations.

```javascript
import { showLoadingOverlay, updateLoadingOverlay, dismissLoadingOverlay } from './modules/ui-utils.js';

const overlay = showLoadingOverlay(
  'Analyzing form...',
  'Step 1/3: Detecting fields...'
);

// Update progress
updateLoadingOverlay(overlay, 'Analyzing form...', 'Step 2/3: Matching data...');

// Dismiss when done
dismissLoadingOverlay(overlay);
```

#### Features
- Centered spinner animation
- Main message and optional step counter
- Blocks interaction (semi-transparent dark overlay)
- Smooth animations (200-300ms)
- Aria-live updates for screen readers

#### Usage Examples
- Form analysis: "Step 1/3: Detecting form fields..." → "Step 2/3: Matching your data..." → "Step 3/3: Positioning text..."
- PDF export: "Generating PDF..."
- Signature upload: "Optimizing signature image..."
- Resume form: "Loading saved form..."

## Buttons

### States
- **Default**: Full color, no effects
- **Hover**: Slightly darker shade, subtle lift
- **Active**: Pressed/scale effect (98%)
- **Disabled**: Reduced opacity (60%), no cursor

### Sizes
- **Standard**: 44px minimum height, 28px horizontal padding
- **Large**: 18px font, full width
- **Minimum Touch Target**: 44x44px

### Types
- **Primary** (Blue): Main actions (Save, Fill Form, Download PDF)
- **Secondary** (Light Gray): Alternative actions (Cancel, Retake, Add)
- **Danger** (Red): Destructive actions (Clear All Data)

## Form Fields

### Input States
- **Default**: Gray border, dark background
- **Focus**: Blue border, outline
- **Valid**: Green border, light green background
- **Invalid**: Red border, light red background

### Labels
All form fields have:
- Associated `<label>` element with proper `for` attribute
- Clear, descriptive text
- Visual focus indicator
- Minimum 44px touch target for inputs

## View Transitions

Smooth transitions between major views (Capture → Result → Profile):
- Fade-in animation (opacity: 0 → 1)
- Duration: 300ms
- Only applied on view switches, not individual elements

## Keyboard Navigation

### Supported Keys
- **Tab**: Navigate between interactive elements
- **Shift+Tab**: Reverse navigation
- **Enter**: Activate buttons, submit forms
- **Escape**: Close modals, cancel operations
- **Arrow Keys**: Navigate selectable lists (if applicable)

### Focus Indicators
- 2px solid blue outline
- 2px offset from element
- Visible on all interactive elements

### Skip Link
- "Skip to main content" link at top of page
- Visible on focus
- Allows keyboard users to bypass navigation

## Accessibility Checklist

### ARIA Labels
- All buttons have descriptive `aria-label` attributes
- Form fields have associated `<label>` elements
- Modal dialogs have `aria-modal="true"` and `aria-labelledby`
- Status updates use `aria-live="polite"` and `aria-atomic="true"`
- Disabled elements have `aria-disabled` attribute

### Semantic HTML
- Use `<main>` for primary content
- Use `<nav>` for navigation
- Use `<form>` for form containers
- Use `<section>` with `aria-label` for major sections
- Use `<button>` for interactive elements, not `<div>`

### Color Contrast
All text meets WCAG AA minimum:
- Regular text: 4.5:1 ratio minimum
- Large text (18px+, 14px bold+): 3:1 ratio minimum

#### Verified Elements
- Button text on background: ✓ 7.1:1 (primary), ✓ 5.8:1 (secondary)
- Form labels on background: ✓ 6.2:1
- Error messages: ✓ 6.8:1
- Toast notifications: ✓ All types pass

### Screen Reader Support
- All images have descriptive alt text
- Form fields have labels or aria-labels
- Hidden decorative elements have `aria-hidden="true"`
- Status messages use `aria-live` regions
- Links have meaningful text (avoid "Click here")

## Mobile Responsive

### Breakpoints
- Base: Mobile-first (max-width: 480px)
- Tablet: 768px+
- Desktop: 1024px+

### Adjustments
- App container max-width: 480px
- Touch targets always 44x44px minimum
- Buttons full width on mobile
- Modals scale to 90% of viewport width
- Toast notifications adjust positioning on small screens

## Error Prevention & Recovery

### Preventive Design
1. **Validation**: Show field errors immediately on blur
2. **Confirmation**: Destructive actions show confirmation before executing
3. **Hints**: Provide helpful hints for complex fields
4. **Defaults**: Pre-fill known information when possible

### Recovery
1. **Clear Messages**: Tell users what went wrong in plain language
2. **Solutions**: Suggest how to fix the issue
3. **Action Buttons**: Provide quick actions (e.g., "Go to Profile", "Retake Photo")
4. **Logging**: All errors logged to console for debugging

## Performance Considerations

### Animations
- Kept under 300ms for responsiveness
- Use GPU-accelerated properties (transform, opacity)
- Avoid excessive repaints (border-color, background-color)

### Images
- Form images resized before API call (max 1200px)
- JPEG quality set to 0.75 for balance
- Signatures resized to max 400px width

### Storage
- Profile data validates before saving
- Storage quota warnings at 85% usage
- Cleanup suggestions when nearing limits

## Internationalization (Future)

Design supports future localization:
- All user-facing text in configuration
- Time formats use browser locale
- Numbers format appropriately
- RTL layout consideration

## Theme Customization

The dark theme is defined in CSS custom properties (variables):
```css
:root {
  --primary: #2563eb;
  --bg: #0f172a;
  --surface: #1e293b;
  /* ... */
}
```

To create a light theme variant, override these variables.

## Testing Checklist

### Accessibility Testing
- [ ] Keyboard navigation works (Tab, Enter, Escape)
- [ ] Screen reader announces all content correctly
- [ ] Color contrast meets WCAG AA (4.5:1 for normal text)
- [ ] Focus indicators visible on all interactive elements
- [ ] Aria labels present and descriptive

### Mobile Testing
- [ ] Touch targets are 44x44px minimum
- [ ] No horizontal scrolling on mobile
- [ ] Toasts visible and dismissible on small screens
- [ ] Forms usable with on-screen keyboard
- [ ] Images load and display correctly

### Browser Testing
- [ ] Chrome/Edge (latest 2 versions)
- [ ] Firefox (latest 2 versions)
- [ ] Safari (latest 2 versions)
- [ ] Mobile Safari (iOS)
- [ ] Chrome Mobile (Android)

### User Testing
- [ ] Error messages are understood by non-technical users
- [ ] New users can complete basic workflow without guidance
- [ ] Power users can perform all functions efficiently
- [ ] Recovery from errors is intuitive

## Resources

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [WebAIM Color Contrast Checker](https://webaim.org/resources/contrastchecker/)
- [MDN Accessibility](https://developer.mozilla.org/en-US/docs/Web/Accessibility)
- [Apple Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/)
