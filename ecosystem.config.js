// PM2 ecosystem — supervisor pro `next start`.
//
// Uso:
//   npm install -g pm2
//   npm run build
//   pm2 start ecosystem.config.js
//   pm2 save && pm2 startup     # auto-start no boot do sistema
//
// Comandos úteis durante o evento:
//   pm2 status                  # status de todos os processos
//   pm2 logs cozinha            # tail dos logs
//   pm2 restart cozinha         # restart sem perder a fila
//   pm2 stop cozinha            # parar (mantém na lista pra restart)

module.exports = {
  apps: [
    {
      name: "cozinha",
      script: "npm",
      args: "start",
      cwd: __dirname,
      // Restart automático se travar. Max 10 restarts em 1min = pára.
      // Se acontecer, log do pm2 vai mostrar o motivo.
      autorestart: true,
      max_restarts: 10,
      min_uptime: "10s",

      // Variáveis de ambiente
      env: {
        NODE_ENV: "production",
        // PORT default é 3000. Pode override aqui se houver conflito.
        // PORT: 3001,
      },

      // Logs
      out_file: "./logs/pm2-out.log",
      error_file: "./logs/pm2-err.log",
      merge_logs: true,
      time: true, // prefixa cada linha com timestamp

      // Watch desligado — não restart em mudança de arquivo (use dev pra isso)
      watch: false,
    },
  ],
};
