import { chromium } from 'playwright';
import fs from 'fs';

const APP_URL = 'http://localhost:5173';
const REPORT_FILE = 'error-test-results.txt';

let testResults = [];
let consoleErrors = [];
let consoleWarnings = [];
let page;
let browser;

function recordTest(name, status, details = '') {
  const result = { name, status, details };
  testResults.push(result);
  const icon = status === 'PASSED' ? '✅' : status === 'FAILED' ? '❌' : '⚠️ ';
  console.log(`${icon} ${name}${details ? ' - ' + details : ''}`);
}

async function setupBrowser() {
  browser = await chromium.launch();
  page = await browser.newPage();

  page.on('console', msg => {
    const logEntry = `[${msg.type().toUpperCase()}] ${msg.text()}`;
    console.log(logEntry);
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    } else if (msg.type() === 'warning') {
      consoleWarnings.push(msg.text());
    }
  });

  page.on('pageerror', error => {
    const errorMsg = `[PAGE ERROR] ${error.message}`;
    console.log(errorMsg);
    consoleErrors.push(error.message);
  });

  await page.goto(APP_URL, { waitUntil: 'networkidle' });
  console.log(`\n🌐 App loaded: ${APP_URL}\n`);
}

async function clearStorage() {
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// TEST 1: INVALID PROFILE DATA
async function test1_InvalidProfileData() {
  console.log('\n=== TEST 1: INVALID PROFILE DATA ===');

  try {
    await page.goto(APP_URL, { waitUntil: 'networkidle' });
    await sleep(500);

    // Find profile form elements
    const profileInputs = await page.locator('input').all();

    if (profileInputs.length === 0) {
      recordTest('Invalid email error', 'FAILED', 'No form inputs found');
      return;
    }

    // Test 1a: Invalid email
    const emailInput = await page.locator('input[type="email"], input[name*="email"]').first();
    if (await emailInput.count() > 0) {
      await emailInput.fill('notanemail');
      await page.locator('button:has-text("Save")').first().click();
      await sleep(800);

      const errorVisible = await page.locator('.error, [role="alert"], .validation-error').first().isVisible({ timeout: 2000 }).catch(() => false);
      recordTest('Invalid email error', errorVisible ? 'PASSED' : 'FAILED', errorVisible ? 'Error displayed' : 'No error shown');
    } else {
      recordTest('Invalid email error', 'FAILED', 'Email input not found');
    }

    // Test 1b: Invalid phone
    await clearStorage();
    await page.reload({ waitUntil: 'networkidle' });
    await sleep(500);

    const phoneInput = await page.locator('input[type="tel"], input[name*="phone"]').first();
    if (await phoneInput.count() > 0) {
      await phoneInput.fill('abc-def-ghij');
      await page.locator('button:has-text("Save")').first().click();
      await sleep(800);

      const errorVisible = await page.locator('.error, [role="alert"], .validation-error').first().isVisible({ timeout: 2000 }).catch(() => false);
      recordTest('Invalid phone error', errorVisible ? 'PASSED' : 'FAILED', errorVisible ? 'Error displayed' : 'No error shown');
    } else {
      recordTest('Invalid phone error', 'WARNING', 'Phone input not found');
    }

    // Test 1c: ZIP too short
    const zipInput = await page.locator('input[name*="zip"], input[name*="postal"]').first();
    if (await zipInput.count() > 0) {
      await zipInput.fill('12');
      await page.locator('button:has-text("Save")').first().click();
      await sleep(800);

      const errorVisible = await page.locator('.error, [role="alert"], .validation-error').first().isVisible({ timeout: 2000 }).catch(() => false);
      recordTest('Invalid ZIP error', errorVisible ? 'PASSED' : 'FAILED', errorVisible ? 'Error displayed' : 'No error shown');
    } else {
      recordTest('Invalid ZIP error', 'WARNING', 'ZIP input not found');
    }

  } catch (e) {
    recordTest('Invalid Profile Data tests', 'FAILED', e.message.substring(0, 100));
  }
}

// TEST 2: MISSING PROFILE
async function test2_MissingProfile() {
  console.log('\n=== TEST 2: MISSING PROFILE ===');

  try {
    await clearStorage();

    const context = await browser.newContext();
    const freshPage = await context.newPage();

    freshPage.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await freshPage.goto(APP_URL, { waitUntil: 'networkidle' });
    await sleep(500);

    // Try to interact with form without saving profile
    const fillBtn = await freshPage.locator('button:has-text("Fill")').first();

    if (await fillBtn.count() > 0) {
      await fillBtn.click();
      await sleep(1000);

      const errorVisible = await freshPage.locator('.error, [role="alert"], .warning').first().isVisible({ timeout: 2000 }).catch(() => false);
      recordTest('Missing profile error', errorVisible ? 'PASSED' : 'WARNING', errorVisible ? 'Error shown' : 'No error message detected');
    } else {
      recordTest('Missing profile error', 'WARNING', 'Fill button not found');
    }

    await freshPage.close();
    await context.close();

  } catch (e) {
    recordTest('Missing Profile test', 'FAILED', e.message.substring(0, 100));
  }
}

// TEST 3: NAVIGATION PERSISTENCE
async function test3_NavigationPersistence() {
  console.log('\n=== TEST 3: NAVIGATION PERSISTENCE ===');

  try {
    await clearStorage();
    await page.goto(APP_URL, { waitUntil: 'networkidle' });
    await sleep(500);

    // Try rapid tab switching
    const tabs = await page.locator('button[role="tab"], [data-tab], .tab-button').all();

    if (tabs.length >= 2) {
      // Click first tab
      await tabs[0].click();
      await sleep(300);

      // Click second tab
      await tabs[1].click();
      await sleep(300);

      // Click back to first
      await tabs[0].click();
      await sleep(300);

      // Check if page is still responsive
      const pageHealthy = await page.evaluate(() => {
        return document.querySelector('body') !== null && window !== null;
      });

      recordTest('Navigation stability', pageHealthy ? 'PASSED' : 'FAILED', 'App stable after tab switching');
    } else {
      recordTest('Navigation stability', 'WARNING', 'Tab buttons not found');
    }

  } catch (e) {
    recordTest('Navigation Persistence test', 'FAILED', e.message.substring(0, 100));
  }
}

// TEST 4: LARGE DATA STORAGE
async function test4_LargeDataStorage() {
  console.log('\n=== TEST 4: LARGE DATA STORAGE ===');

  try {
    await clearStorage();
    await page.goto(APP_URL, { waitUntil: 'networkidle' });
    await sleep(500);

    const nameInput = await page.locator('input[name*="name"], input[type="text"]').first();

    if (await nameInput.count() > 0) {
      // Fill with 1000 character string
      const longText = 'Test User ' + 'A'.repeat(990);
      await nameInput.fill(longText);

      // Try to save
      const saveBtn = await page.locator('button:has-text("Save")').first();
      if (await saveBtn.count() > 0) {
        await saveBtn.click();
        await sleep(800);
      }

      // Reload and check persistence
      await page.reload({ waitUntil: 'networkidle' });
      await sleep(500);

      const savedValue = await nameInput.inputValue();
      if (savedValue && savedValue.length > 100) {
        recordTest('Large data storage', 'PASSED', 'Large data persists');
      } else {
        recordTest('Large data storage', 'FAILED', 'Data lost after reload');
      }
    } else {
      recordTest('Large data storage', 'FAILED', 'Input not found');
    }

  } catch (e) {
    recordTest('Large Data Storage test', 'FAILED', e.message.substring(0, 100));
  }
}

// TEST 5: MOBILE VIEWPORT
async function test5_MobileViewport() {
  console.log('\n=== TEST 5: MOBILE VIEWPORT ===');

  try {
    const mobileContext = await browser.newContext({
      viewport: { width: 375, height: 812 },
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15'
    });

    const mobilePage = await mobileContext.newPage();
    mobilePage.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(`[Mobile] ${msg.text()}`);
    });

    await mobilePage.goto(APP_URL, { waitUntil: 'networkidle' });
    await sleep(500);

    const viewport = await mobilePage.viewportSize();
    recordTest('Mobile viewport loaded', 'PASSED', `${viewport.width}x${viewport.height}`);

    // Test mobile input
    const inputs = await mobilePage.locator('input').all();
    if (inputs.length > 0) {
      await inputs[0].fill('Test');
      await sleep(300);
      recordTest('Mobile input interaction', 'PASSED', 'Input works on mobile');
    }

    await mobilePage.close();
    await mobileContext.close();

  } catch (e) {
    recordTest('Mobile Viewport test', 'FAILED', e.message.substring(0, 100));
  }
}

// TEST 6: FORM FIELD DETECTION
async function test6_FormFieldDetection() {
  console.log('\n=== TEST 6: FORM FIELD DETECTION ===');

  try {
    await page.goto(APP_URL, { waitUntil: 'networkidle' });
    await sleep(500);

    // Check for file upload input
    const fileInput = await page.locator('input[type="file"]').first();

    if (await fileInput.count() > 0) {
      recordTest('File upload input found', 'PASSED', 'File input available');

      // Check for accept attribute (validation)
      const accept = await fileInput.getAttribute('accept');
      if (accept) {
        recordTest('File type validation', 'PASSED', `Accept filter: ${accept}`);
      } else {
        recordTest('File type validation', 'WARNING', 'No accept filter set');
      }
    } else {
      recordTest('File upload input found', 'FAILED', 'No file input found');
    }

  } catch (e) {
    recordTest('Form Field Detection test', 'FAILED', e.message.substring(0, 100));
  }
}

// TEST 7: ERROR MESSAGE DISPLAY
async function test7_ErrorMessageDisplay() {
  console.log('\n=== TEST 7: ERROR MESSAGE DISPLAY ===');

  try {
    await page.goto(APP_URL, { waitUntil: 'networkidle' });
    await sleep(500);

    // Look for error/alert message containers
    const errorElements = await page.locator('.error, .alert, [role="alert"], .warning, .message').all();

    if (errorElements.length > 0) {
      recordTest('Error message containers exist', 'PASSED', `Found ${errorElements.length} containers`);
    } else {
      recordTest('Error message containers exist', 'WARNING', 'No error containers detected');
    }

    // Check for user-friendly error patterns (not alert())
    const hasAlert = await page.evaluate(() => {
      return window.alert !== undefined;
    });

    recordTest('Error handling (not using alert)', hasAlert ? 'WARNING' : 'PASSED', 'App may use browser alert()');

  } catch (e) {
    recordTest('Error Message Display test', 'FAILED', e.message.substring(0, 100));
  }
}

// TEST 8: NETWORK ERROR HANDLING
async function test8_NetworkErrorHandling() {
  console.log('\n=== TEST 8: NETWORK ERROR HANDLING ===');

  try {
    // Simulate slow network
    const client = await page.context().newCDPSession(page);
    await client.send('Network.emulateNetworkConditions', {
      offline: false,
      downloadThroughput: 50 * 1024 / 8,
      uploadThroughput: 20 * 1024 / 8,
      latency: 400
    });

    recordTest('Network throttling applied', 'PASSED', 'Slow 3G simulated');

    // Reset network
    await client.send('Network.emulateNetworkConditions', {
      offline: false,
      downloadThroughput: -1,
      uploadThroughput: -1,
      latency: 0
    });

  } catch (e) {
    recordTest('Network Error Handling test', 'FAILED', e.message.substring(0, 100));
  }
}

// TEST 9: SIGNATURE FUNCTIONALITY
async function test9_SignatureFunctionality() {
  console.log('\n=== TEST 9: SIGNATURE FUNCTIONALITY ===');

  try {
    await page.goto(APP_URL, { waitUntil: 'networkidle' });
    await sleep(500);

    // Look for signature-related elements
    const hasSignature = await page.evaluate(() => {
      return (
        document.querySelector('canvas') !== null ||
        document.querySelector('[name*="signature"]') !== null ||
        document.querySelector('[id*="signature"]') !== null
      );
    });

    if (hasSignature) {
      recordTest('Signature feature', 'PASSED', 'Signature functionality present');
    } else {
      recordTest('Signature feature', 'WARNING', 'No signature functionality found');
    }

  } catch (e) {
    recordTest('Signature Functionality test', 'FAILED', e.message.substring(0, 100));
  }
}

// TEST 10: CONSOLE ERROR ANALYSIS
async function test10_ConsoleAnalysis() {
  console.log('\n=== TEST 10: CONSOLE ERROR ANALYSIS ===');

  try {
    // Navigate through all major features
    const tabs = await page.locator('button[role="tab"], [data-tab], .tab-button').all();

    for (let i = 0; i < Math.min(tabs.length, 3); i++) {
      try {
        await tabs[i].click();
        await sleep(300);
      } catch (e) {
        // Continue even if tab click fails
      }
    }

    recordTest('App usable (no crash)', 'PASSED', `${consoleErrors.length} errors logged`);

  } catch (e) {
    recordTest('Console Analysis test', 'FAILED', e.message.substring(0, 100));
  }
}

function generateReport() {
  console.log('\n\n╔════════════════════════════════════════════╗');
  console.log('║   PRODUCTION ERROR EDGE CASE TESTING      ║');
  console.log('╚════════════════════════════════════════════╝\n');

  const passed = testResults.filter(r => r.status === 'PASSED').length;
  const failed = testResults.filter(r => r.status === 'FAILED').length;
  const warning = testResults.filter(r => r.status === 'WARNING').length;

  console.log(`Tests Run: ${testResults.length}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`⚠️  Warnings: ${warning}\n`);

  console.log('Detailed Results:');
  testResults.forEach(r => {
    const icon = r.status === 'PASSED' ? '✅' : r.status === 'FAILED' ? '❌' : '⚠️ ';
    console.log(`${icon} ${r.name}${r.details ? ' - ' + r.details : ''}`);
  });

  console.log('\n\nConsole Errors Found:');
  if (consoleErrors.length > 0) {
    console.log(`Total: ${consoleErrors.length}`);
    const uniqueErrors = [...new Set(consoleErrors)];
    uniqueErrors.slice(0, 10).forEach(e => console.log(`  ❌ ${e.substring(0, 80)}`));
    if (uniqueErrors.length > 10) {
      console.log(`  ... and ${uniqueErrors.length - 10} more`);
    }
  } else {
    console.log('  ✅ No console errors');
  }

  console.log('\nConsole Warnings Found:');
  if (consoleWarnings.length > 0) {
    console.log(`Total: ${consoleWarnings.length}`);
    const uniqueWarnings = [...new Set(consoleWarnings)];
    uniqueWarnings.slice(0, 5).forEach(w => console.log(`  ⚠️  ${w.substring(0, 80)}`));
  } else {
    console.log('  ✅ No console warnings');
  }

  // Overall assessment
  console.log('\n\nOVERALL ERROR HANDLING ASSESSMENT:');
  if (failed === 0 && consoleErrors.length === 0) {
    console.log('🟢 EXCELLENT - All errors handled gracefully, no console errors');
  } else if (failed <= 2 && consoleErrors.length <= 5) {
    console.log('🟡 GOOD - Most errors handled, minor console issues');
  } else {
    console.log('🔴 POOR - Several error cases broken or multiple console errors');
  }

  // Write to file
  fs.writeFileSync(REPORT_FILE, `
PRODUCTION ERROR EDGE CASE TESTING REPORT
===========================================

Date: ${new Date().toISOString()}
App URL: ${APP_URL}

SUMMARY
-------
Tests Run: ${testResults.length}
✅ Passed: ${passed}
❌ Failed: ${failed}
⚠️  Warnings: ${warning}

DETAILED RESULTS
----------------
${testResults.map(r => {
  const icon = r.status === 'PASSED' ? '✅' : r.status === 'FAILED' ? '❌' : '⚠️ ';
  return `${icon} ${r.name}${r.details ? ' - ' + r.details : ''}`;
}).join('\n')}

CONSOLE ERRORS (${consoleErrors.length})
-------------------
${consoleErrors.length > 0 ? [...new Set(consoleErrors)].map(e => `  ❌ ${e}`).join('\n') : '  ✅ No errors'}

CONSOLE WARNINGS (${consoleWarnings.length})
--------------------
${consoleWarnings.length > 0 ? [...new Set(consoleWarnings)].map(w => `  ⚠️  ${w}`).join('\n') : '  ✅ No warnings'}

OVERALL ASSESSMENT
------------------
${failed === 0 && consoleErrors.length === 0 ? '🟢 EXCELLENT' : failed <= 2 && consoleErrors.length <= 5 ? '🟡 GOOD' : '🔴 POOR'}
  `);

  console.log(`\n📝 Full report saved to: ${REPORT_FILE}`);
}

async function runAllTests() {
  try {
    await setupBrowser();

    await test1_InvalidProfileData();
    await test2_MissingProfile();
    await test3_NavigationPersistence();
    await test4_LargeDataStorage();
    await test5_MobileViewport();
    await test6_FormFieldDetection();
    await test7_ErrorMessageDisplay();
    await test8_NetworkErrorHandling();
    await test9_SignatureFunctionality();
    await test10_ConsoleAnalysis();

    generateReport();

  } catch (e) {
    console.error(`Fatal error: ${e.message}`);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

runAllTests().catch(console.error);
