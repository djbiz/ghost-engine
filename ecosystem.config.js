module.exports = {
  apps: [
    {
      name: 'ghost-engine',
      script: 'scripts/pipeline-automation.js',
      cwd: '/opt/ghost-engine',
      instances: 2,
      exec_mode: 'cluster',
      max_memory_restart: '512M',
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: '/opt/ghost-engine/logs/error.log',
      out_file: '/opt/ghost-engine/logs/out.log',
      merge_logs: true,
      autorestart: true,
      watch: false,
      kill_timeout: 5000,
      listen_timeout: 10000
    },
    {
      name: 'heartbeat-0730',
      script: 'scripts/heartbeat-morning.js',
      cwd: '/opt/ghost-engine',
      cron_restart: '30 11 * * *',
      instances: 1,
      exec_mode: 'fork',
      autorestart: false,
      env_production: {
        NODE_ENV: 'production'
      },
      error_file: '/opt/ghost-engine/logs/heartbeat-0730-error.log',
      out_file: '/opt/ghost-engine/logs/heartbeat-0730-out.log'
    },
    {
      name: 'heartbeat-0900',
      script: 'scripts/heartbeat-closer.js',
      cwd: '/opt/ghost-engine',
      cron_restart: '0 13 * * *',
      instances: 1,
      exec_mode: 'fork',
      autorestart: false,
      env_production: {
        NODE_ENV: 'production'
      },
      error_file: '/opt/ghost-engine/logs/heartbeat-0900-error.log',
      out_file: '/opt/ghost-engine/logs/heartbeat-0900-out.log'
    },
    {
      name: 'heartbeat-1100',
      script: 'scripts/heartbeat-fulfillment.js',
      cwd: '/opt/ghost-engine',
      cron_restart: '0 15 * * *',
      instances: 1,
      exec_mode: 'fork',
      autorestart: false,
      env_production: {
        NODE_ENV: 'production'
      },
      error_file: '/opt/ghost-engine/logs/heartbeat-1100-error.log',
      out_file: '/opt/ghost-engine/logs/heartbeat-1100-out.log'
    },
    {
      name: 'heartbeat-2300',
      script: 'scripts/heartbeat-night.js',
      cwd: '/opt/ghost-engine',
      cron_restart: '0 3 * * *',
      instances: 1,
      exec_mode: 'fork',
      autorestart: false,
      env_production: {
        NODE_ENV: 'production'
      },
      error_file: '/opt/ghost-engine/logs/heartbeat-2300-error.log',
      out_file: '/opt/ghost-engine/logs/heartbeat-2300-out.log'
    }
  ]
};
