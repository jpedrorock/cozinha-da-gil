import { promises as fs } from "node:fs";
import path from "node:path";

const FILENAME_RE = /^dev-(\d{4}-\d{2}-\d{2})\.db$/;

/**
 * Apaga arquivos `dev-YYYY-MM-DD.db` em `dir` com data anterior ao corte.
 * Retorna quantos foram removidos. Silencia erros por arquivo individual
 * (arquivo pode ter sumido entre listagem e unlink).
 *
 * Critério: data NO NOME do arquivo (não mtime), então renomear não confunde.
 * Arquivos com nomes que não batem no padrão são ignorados.
 */
export async function pruneBackupFiles(dir: string, keepDays: number): Promise<number> {
  const cutoff = Date.now() - keepDays * 24 * 60 * 60 * 1000;
  let entries: string[];
  try {
    entries = await fs.readdir(dir);
  } catch {
    return 0;
  }
  let removed = 0;
  for (const name of entries) {
    const m = FILENAME_RE.exec(name);
    if (!m) continue;
    const fileDate = new Date(m[1]).getTime();
    if (!Number.isFinite(fileDate)) continue;
    if (fileDate < cutoff) {
      try {
        await fs.unlink(path.join(dir, name));
        removed++;
      } catch {
        // arquivo já sumiu ou permissão — ignora
      }
    }
  }
  return removed;
}
