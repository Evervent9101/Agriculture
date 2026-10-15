// PM2 process definitions.
// deploy.sh sets APP_DIR=/opt/devops-app/current (a link to the newest release) and loads
// /opt/devops-app/.env first, so DATABASE_URL is available here.
const path = require('path');

// Use the "current" link when deploy.sh provides it. Falling back to __dirname is for running by hand.
const root = process.env.APP_DIR || __dirname;

module.exports = {
  apps: [
    {
      name: 'backend',
      cwd: path.join(root, 'backend'),
      script: 'src/index.js',
      instances: 2,              // cluster mode -> zero-downtime reloads
      exec_mode: 'cluster',
      max_memory_restart: '300M',
      kill_timeout: 5000,
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        DATABASE_URL: process.env.DATABASE_URL,
        AUTH_SECRET: process.env.AUTH_SECRET,                       // signs login tokens (created by deploy.sh)
        ALLOW_REGISTRATION: process.env.ALLOW_REGISTRATION || 'true', // set to false in .env to close sign-up
        APP_VERSION: process.env.APP_VERSION || '2.0.0',
        BUILD_NUMBER: process.env.BUILD_NUMBER || 'manual',
      },
    },
    {
      // PM2's built-in static file server for the built React app
      name: 'frontend',
      script: 'serve',
      env: {
        PM2_SERVE_PATH: path.join(root, 'frontend', 'dist'),
        PM2_SERVE_PORT: 8080,
        PM2_SERVE_SPA: 'true',
        PM2_SERVE_HOMEPAGE: '/index.html',
      },
    },
  ],
};
