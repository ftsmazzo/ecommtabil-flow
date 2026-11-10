// PM2: mantém o EcommFlow rodando e reinicia em caso de falha
module.exports = {
  apps: [{
    name: 'ecommflow',
    script: 'node_modules/next/dist/bin/next',
    args: 'start -p 3000',
    cwd: __dirname,
    instances: 1,
    autorestart: true,
    max_memory_restart: '600M',
    env: { NODE_ENV: 'production', TZ: 'America/Sao_Paulo' },
  }],
};
