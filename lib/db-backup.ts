import { copyFile, mkdir, readdir, unlink } from "node:fs/promises";
import { dirname, join } from "node:path";
import { randomBytes } from "node:crypto";

/**
 * Copia o `dev.db` (SQLite) pra um arquivo timestamped em `backups/`.
 *
 * Usado antes de operações destrutivas (Zona de Perigo → apagar dados)
 * pra dar uma rede de segurança: se Gil clicar errado, o snapshot tá lá
 * pra restaurar manualmente via `cp backups/wipe-... dev.db`.
 *
 * Resolve o caminho do `dev.db` via `DATABASE_URL` (`file:/...`). Local
 * (`./dev.db`) e prod Coolify (`/app/data/dev.db`) funcionam igual.
 *
 * Retorna caminho absoluto do backup criado, ou lança se falhar.
 */
export async function backupDatabase(reason: string): Promise<string> {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl || !dbUrl.startsWith("file:")) {
    throw new Error("backupDatabase: DATABASE_URL não é sqlite file:");
  }
  const dbPath = dbUrl.replace(/^file:/, "");
  const stamp = stampNow();
  // backups/ fica ao lado do dev.db pra ficar no mesmo volume Coolify.
  const backupDir = join(dirname(dbPath), "backups");
  await mkdir(backupDir, { recursive: true });
  const safeReason = reason.replace(/[^a-z0-9-]/gi, "-").toLowerCase();
  const backupPath = join(backupDir, `${safeReason}-${stamp}.db`);
  await copyFile(dbPath, backupPath);
  return backupPath;
}

/**
 * Remove arquivos `dev-YYYY-MM-DD.db` em `backupsDir` cuja data no nome
 * é anterior a `now - keepDays` dias. Arquivos fora do padrão (ex:
 * `wipe-*.db`, `backup.log`) são ignorados.
 *
 * Retorna a quantidade de arquivos removidos.
 */
export async function pruneOldBackups(
  backupsDir: string,
  keepDays: number,
  now: Date = new Date(),
): Promise<number> {
  let entries: string[];
  try {
    entries = await readdir(backupsDir);
  } catch {
    return 0; // pasta ainda não existe — nada a limpar
  }
  const cutoff = now.getTime() - keepDays * 24 * 60 * 60 * 1000;
  let pruned = 0;
  for (const name of entries) {
    const m = /^dev-(\d{4}-\d{2}-\d{2})\.db$/.exec(name);
    if (!m) continue;
    const fileDate = new Date(m[1]).getTime();
    if (Number.isFinite(fileDate) && fileDate < cutoff) {
      try {
        await unlink(join(backupsDir, name));
        pruned++;
      } catch {
        // arquivo pode ter sumido entre readdir e unlink — ignorar
      }
    }
  }
  return pruned;
}

/**
 * Helper: timestamp ISO sem `:` (filename-safe) + 4 chars random pra
 * garantir unique mesmo se 2 chamadas caírem no mesmo ms.
 */
function stampNow(): string {
  // YYYY-MM-DDTHH-MM-SS-mmm-XXXX
  const iso = new Date().toISOString().replace(/[:.]/g, "-").replace(/Z$/, "");
  const suffix = randomBytes(2).toString("hex"); // 4 chars hex
  return `${iso}-${suffix}`;
}

