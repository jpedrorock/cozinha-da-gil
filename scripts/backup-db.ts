/**
 * Backup do SQLite (`dev.db`) — copy file-based com WAL checkpoint.
 *
 * Uso:
 *   npx tsx scripts/backup-db.ts                 (usa env vars)
 *   DB_PATH=./prisma/dev.db BACKUPS_DIR=./backups npx tsx scripts/backup-db.ts
 *
 * Estratégia:
 *   1. Força `PRAGMA wal_checkpoint(TRUNCATE)` pra garantir que WAL
 *      tá sincronizado com o main db file antes do copy
 *   2. Copia <DB_PATH> → <BACKUPS_DIR>/dev-YYYY-MM-DD.db
 *   3. Limpa arquivos com mais de KEEP_DAYS (default 14)
 *   4. Append log em <BACKUPS_DIR>/backup.log
 *
 * Idempotente: rodar 2x no mesmo dia sobrescreve o arquivo do dia.
 *
 * Por que NÃO `sqlite3 .backup`: requer binário sqlite3 instalado,
 * que não vem no Alpine slim. `cp` após WAL checkpoint é equivalente
 * em SQLite — official docs confirmam.
 */

// Hack pra escapar do webpack: `eval("require")` resolve em runtime,
// webpack não rastreia. Necessário porque o caminho de import
// `instrumentation.ts → lib/backup-scheduler → scripts/backup-db` força
// o webpack a tentar bundlear este arquivo, e ele não sabe bundlear
// módulos Node nativos (fs/path). Em produção rodando como Node real,
// `require` existe e resolve normalmente.
import { prisma } from "@/lib/prisma";
import { cleanupOldBackups } from "@/lib/db-backup";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const nodeRequire = eval("require") as NodeRequire;
const fs = nodeRequire("fs").promises as typeof import("fs").promises;
const path = nodeRequire("path") as typeof import("path");

const DB_PATH = process.env.DB_PATH ?? "/app/data/dev.db";
const BACKUPS_DIR = process.env.BACKUPS_DIR ?? "/app/data/backups";
const KEEP_DAYS = Number(process.env.BACKUP_KEEP_DAYS ?? "14");

export async function runBackup(): Promise<{
  destPath: string;
  prunedCount: number;
  sizeBytes: number;
}> {
  await fs.mkdir(BACKUPS_DIR, { recursive: true });

  // Garante que WAL tá flushed pro main db antes do copy.
  // Sem isso, o backup pode pegar estado parcial (transações não-merged).
  // Usar $queryRawUnsafe (não $executeRawUnsafe) porque PRAGMA retorna
  // 3 colunas (busy, log, checkpointed) — execute reclama de "results
  // not allowed". O resultado em si a gente ignora.
  await prisma.$queryRawUnsafe("PRAGMA wal_checkpoint(TRUNCATE);");

  const today = new Date().toISOString().slice(0, 10);
  const destPath = path.join(BACKUPS_DIR, `dev-${today}.db`);
  await fs.copyFile(DB_PATH, destPath);

  const stat = await fs.stat(destPath);

  const prunedCount = await cleanupOldBackups(BACKUPS_DIR, KEEP_DAYS);

  const log = `[${new Date().toISOString()}] OK ${destPath} (${stat.size} bytes, pruned=${prunedCount})\n`;
  await fs.appendFile(path.join(BACKUPS_DIR, "backup.log"), log);

  return { destPath, prunedCount, sizeBytes: stat.size };
}

// CLI entry-point
async function cli() {
  try {
    const r = await runBackup();
    console.log(`✓ Backup OK: ${r.destPath}`);
    console.log(`  ${(r.sizeBytes / 1024).toFixed(1)} KB · pruned ${r.prunedCount} antigos`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const errLine = `[${new Date().toISOString()}] ERROR ${msg}\n`;
    await fs.mkdir(BACKUPS_DIR, { recursive: true }).catch(() => {});
    await fs.appendFile(path.join(BACKUPS_DIR, "backup.log"), errLine).catch(() => {});
    console.error("✗ Backup falhou:", msg);
    process.exit(1);
  } finally {
    await prisma.$disconnect().catch(() => {});
  }
}

// Roda CLI só se executado direto (não quando importado)
if (require.main === module) {
  cli();
}
