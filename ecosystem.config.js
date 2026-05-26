module.exports = {
  apps: [
    {
      name: 'slumpadrotation',
      script: 'node_modules/.bin/next',
      args: 'start',
      cwd: '/var/www/slumpadrotation',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        DATABASE_URL: 'file:/var/www/slumpadrotation/prisma/prod.db',
        SITE_ADMIN_PASSWORD: 'byt-det-har',
      },
    },
  ],
}
