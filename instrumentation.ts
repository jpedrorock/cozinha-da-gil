/**
 * Next.js instrumentation hook — roda 1x quando o servidor sobe.
 *
 * Habilitado via `experimental.instrumentationHook: true` em next.config.mjs.
 *
 * Uso atual: registrar scheduler de backup diário do SQLite.
 *
 * Cuidado: `register` roda em todos os runtimes (Node + Edge). Só
 * importar coisas Node-only dentro do `if (NEXT_RUNTIME === 'nodejs')`.
 */

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  // Import dinâmico pra não cair em edge runtime
  const { startBackupScheduler } = await import("@/lib/backup-scheduler");
  startBackupScheduler();
}
