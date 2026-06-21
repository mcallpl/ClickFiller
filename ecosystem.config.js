/**
 * PM2 Ecosystem Configuration for ClickFiller
 *
 * Usage:
 *   pm2 start ecosystem.config.js             # Start app
 *   pm2 start ecosystem.config.js --env prod  # Start with production env
 *   pm2 startup                               # Enable auto-start on reboot
 *   pm2 save                                  # Save process list
 *   pm2 logs                                  # View logs
 *   pm2 monit                                 # Monitor CPU/Memory
 */

module.exports = {
  apps: [
    {
      name: 'clickfiller',
      script: './server/index.js',
      instances: 'max',
      exec_mode: 'cluster',
      watch: false,
      ignore_watch: ['node_modules', 'dist', 'logs'],

      // Environment variables
      env: {
        NODE_ENV: 'development',
        PORT: 3001
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3001
      },

      // Logging
      out_file: '/var/log/clickfiller/app.log',
      error_file: '/var/log/clickfiller/error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',

      // Memory and crash handling
      max_memory_restart: '512M',
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',

      // Graceful shutdown
      kill_timeout: 10000,
      listen_timeout: 10000,

      // Health check
      cron_restart: '0 0 * * *',
    }
  ],

  deploy: {
    production: {
      user: 'app',
      host: 'your-digital-ocean-ip',
      ref: 'origin/main',
      repo: 'git@github.com:yourusername/clickfiller.git',
      path: '/home/app/clickfiller',
      'post-deploy': 'npm ci && npm run build && pm2 reload ecosystem.config.js --env production'
    }
  }
};
