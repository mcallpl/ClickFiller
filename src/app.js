/**
 * ClickFiller - Main Application Initialization
 *
 * This is the clean entry point that initializes all modules.
 * Most application logic has been moved to focused, single-responsibility modules.
 */

import { initializeApp } from './app-init.js';
import { initNavigation } from './modules/navigation.js';
import { initCapture } from './modules/capture.js';
import { initResult } from './modules/result.js';
import { initProfile } from './modules/profile.js';
import { initErrorHandling } from './modules/error-handler.js';

// Initialize app-wide setup
initializeApp();

// Initialize all feature modules
initNavigation();
initCapture();
initResult();
initProfile();
initErrorHandling();
