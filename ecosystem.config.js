module.exports = {
  apps: [
    {
      name: 'slumpadrotation',
      script: 'node_modules/.bin/next',
      // Lyssna bara lokalt – sidan nås enbart via Cloudflare Tunnel (cloudflared på
      // samma maskin). Då kan ingen gå förbi tunneln och fejka CF-Connecting-IP.
      args: 'start -H 127.0.0.1',
      cwd: '/home/sloxxer/slumpadrotation',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
        DATABASE_URL: 'file:/home/sloxxer/slumpadrotation/prisma/prod.db',
        // SITE_ADMIN_PASSWORD och SESSION_SECRET läses från .env – lägg aldrig hemligheter här.
      },
    },
  ],
}
