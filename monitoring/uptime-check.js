#!/usr/bin/env node

/**
 * ClickFiller Uptime Monitor
 *
 * Periodically pings the application health endpoint and alerts on failures.
 *
 * Usage:
 *   node monitoring/uptime-check.js
 *
 * Configuration via environment variables:
 *   HEALTH_CHECK_URL    - URL to check (default: http://localhost:3001/health)
 *   CHECK_INTERVAL      - Interval in seconds (default: 60)
 *   FAILURE_THRESHOLD   - Consecutive failures before alert (default: 3)
 *   LOG_FILE            - Path to log file (default: /var/log/clickfiller/uptime.log)
 *   SLACK_WEBHOOK_URL   - Slack webhook for alerts (optional)
 *   EMAIL_TO            - Email address for alerts (optional)
 */

import http from 'http';
import https from 'https';
import fs from 'fs';
import path from 'path';

// Configuration
const config = {
  healthCheckUrl: process.env.HEALTH_CHECK_URL || 'http://localhost:3001/health',
  checkInterval: parseInt(process.env.CHECK_INTERVAL || '60', 10) * 1000,
  failureThreshold: parseInt(process.env.FAILURE_THRESHOLD || '3', 10),
  logFile: process.env.LOG_FILE || '/var/log/clickfiller/uptime.log',
  slackWebhookUrl: process.env.SLACK_WEBHOOK_URL || null,
  emailTo: process.env.EMAIL_TO || null,
};

// State
let consecutiveFailures = 0;
let lastAlertTime = 0;
const alertCooldown = 5 * 60 * 1000; // 5 minutes minimum between alerts

// Utility Functions
function log(level, message) {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] [${level}] ${message}`;

  console.log(logEntry);

  try {
    const dir = path.dirname(config.logFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.appendFileSync(config.logFile, logEntry + '\n');
  } catch (err) {
    console.error(`Failed to write log: ${err.message}`);
  }
}

function performHealthCheck() {
  return new Promise((resolve) => {
    const url = new URL(config.healthCheckUrl);
    const client = url.protocol === 'https:' ? https : http;

    const request = client.get(config.healthCheckUrl, { timeout: 10000 }, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          if (res.statusCode === 200 && response.status === 'ok') {
            resolve({ success: true, statusCode: res.statusCode, response });
          } else {
            resolve({ success: false, statusCode: res.statusCode, error: 'Invalid response' });
          }
        } catch (err) {
          resolve({ success: false, error: 'Invalid JSON response' });
        }
      });
    });

    request.on('error', (error) => {
      resolve({ success: false, error: error.message });
    });

    request.on('timeout', () => {
      request.destroy();
      resolve({ success: false, error: 'Request timeout' });
    });
  });
}

async function sendAlert(message, details) {
  const now = Date.now();

  // Check cooldown period
  if (now - lastAlertTime < alertCooldown) {
    log('DEBUG', `Alert in cooldown period, skipping (${Math.floor((alertCooldown - (now - lastAlertTime)) / 1000)}s remaining)`);
    return;
  }

  log('ALERT', message);

  // Send to Slack
  if (config.slackWebhookUrl) {
    try {
      const payload = {
        text: `ClickFiller Health Alert: ${message}`,
        details: details,
        timestamp: new Date().toISOString(),
      };

      const url = new URL(config.slackWebhookUrl);
      const client = url.protocol === 'https:' ? https : http;

      const request = client.request(config.slackWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      request.write(JSON.stringify(payload));
      request.end();
    } catch (err) {
      log('ERROR', `Failed to send Slack alert: ${err.message}`);
    }
  }

  // Send email (requires external tool)
  if (config.emailTo) {
    log('DEBUG', `Email alert would be sent to ${config.emailTo} (not implemented)`);
  }

  lastAlertTime = now;
}

async function checkHealth() {
  const result = await performHealthCheck();

  if (result.success) {
    if (consecutiveFailures > 0) {
      log('INFO', `Health check passed. Service recovered after ${consecutiveFailures} failures.`);
      consecutiveFailures = 0;
    } else {
      log('DEBUG', `Health check passed. Response time: ${Date.now()}ms`);
    }
  } else {
    consecutiveFailures++;
    log('WARN', `Health check failed (${consecutiveFailures}/${config.failureThreshold}): ${result.error}`);

    if (consecutiveFailures >= config.failureThreshold) {
      await sendAlert(
        `Service unreachable for ${consecutiveFailures} consecutive checks`,
        {
          url: config.healthCheckUrl,
          error: result.error,
          checks: consecutiveFailures,
          threshold: config.failureThreshold,
        }
      );
    }
  }
}

async function main() {
  log('INFO', `ClickFiller Uptime Monitor Started`);
  log('INFO', `Health Check URL: ${config.healthCheckUrl}`);
  log('INFO', `Check Interval: ${config.checkInterval / 1000}s`);
  log('INFO', `Failure Threshold: ${config.failureThreshold}`);

  // Initial check
  await checkHealth();

  // Periodic checks
  setInterval(checkHealth, config.checkInterval);
}

// Handle signals for graceful shutdown
process.on('SIGTERM', () => {
  log('INFO', 'Received SIGTERM, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  log('INFO', 'Received SIGINT, shutting down gracefully');
  process.exit(0);
});

// Start monitoring
main().catch((err) => {
  log('ERROR', `Fatal error: ${err.message}`);
  process.exit(1);
});
