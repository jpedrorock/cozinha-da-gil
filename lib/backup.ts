import { promises as fs } from "node:fs";
import path from "node:path";

/**
 * Copia o dev.db pra prisma/backups/ com nome timestamped.
 * Chamado automaticamente no fechar caixa + manualmente via /api/backup.
 *
 * Trade-offs:
 * - SQLite com WAL pode estar gravando enquanto copiamos. Pra um DB de uns
 *   poucos MB e poucas writes/segundo, copy direto é "good enough" e
 *   raramente corrompe. Pra ser bombproof precisaria de `sqlite3 .backup`
 *   (que respeita WAL), mas é overkill aqui.
 * - Sem rotação automática: backups acumulam. Gil pode limpar manualmente
 *   pela pasta. Se ficar problema, adicionar prune dos N mais antigos.
 */

const DB_FILENAME = "dev.db";
const BACKUP_SUBDIR = "backups";

// Rotação: mantém os N mais recentes. Antigos são apagados após cada backup.
// Suficiente pra histórico de ~30 eventos sem inchar disco.
const KEEP_LAST_N = 30;

function projectRoot(): string {
  // Em dev e em prod (next standalone), o cwd é a raiz do projeto.
  return process.cwd();
}

function dbPath(): string {
  return path.join(projectRoot(), "prisma", DB_FILENAME);
}

function backupDir(): string {
  return path.join(projectRoot(), "prisma", BACKUP_SUBDIR);
}

function timestamp(): string {
  // YYYY-MM-DD-HHMMSS, ordenável lexicograficamente
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

export type BackupResult = {
  ok: boolean;
  path?: string;
  bytes?: number;
  error?: string;
};

/**
 * Faz uma cópia do dev.db pra prisma/backups/.
 * `label` vai pro nome do arquivo (ex: "close-Festa-Junina").
 */
export async function backupDatabase(label?: string): Promise<BackupResult> {
  try {
    const src = dbPath();
    const stat = await fs.stat(src);
    if (!stat.isFile()) {
      return { ok: false, error: "dev.db não encontrado." };
    }

    const dir = backupDir();
    await fs.mkdir(dir, { recursive: true });

    const safeLabel = label ? label.replace(/[^a-zA-Z0-9_-]+/g, "-").slice(0, 40) : "manual";
    const filename = `${timestamp()}-${safeLabel}.db`;
    const dest = path.join(dir, filename);

    await fs.copyFile(src, dest);
    const destStat = await fs.stat(dest);

    // Rotação fire-and-forget (não bloqueia a resposta)
    void pruneOldBackups().catch(() => {});

    return { ok: true, path: dest, bytes: destStat.size };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Mantém só os N backups mais recentes. Apaga o resto.
 * Chamado automaticamente depois de cada `backupDatabase`.
 */
export async function pruneOldBackups(keep = KEEP_LAST_N): Promise<{ removed: number }> {
  try {
    const list = await listBackups();
    if (list.length <= keep) return { removed: 0 };
    const toRemove = list.slice(keep); // já vem ordenado mais recente primeiro
    let removed = 0;
    for (const item of toRemove) {
      try {
        await fs.unlink(backupFilePath(item.filename));
        removed++;
      } catch {
        // ignora — não trava se um arquivo já sumiu
      }
    }
    return { removed };
  } catch {
    return { removed: 0 };
  }
}

/**
 * Lista backups existentes (mais recentes primeiro).
 * Pra UI mostrar histórico ou limpeza manual.
 */
export async function listBackups(): Promise<
  Array<{ filename: string; bytes: number; mtime: string }>
> {
  try {
    const dir = backupDir();
    const entries = await fs.readdir(dir);
    const stats = await Promise.all(
      entries
        .filter((e) => e.endsWith(".db"))
        .map(async (e) => {
          const s = await fs.stat(path.join(dir, e));
          return { filename: e, bytes: s.size, mtime: s.mtime.toISOString() };
        }),
    );
    return stats.sort((a, b) => b.mtime.localeCompare(a.mtime));
  } catch {
    return [];
  }
}

export function backupFilePath(filename: string): string {
  // Sanitiza pra impedir path traversal
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, "");
  return path.join(backupDir(), safe);
}
