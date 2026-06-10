import { copyFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { randomBytes } from "node:crypto";

/**
 * Copia o `dev.db` (SQLite) pra um arquivo timestamped em `backups/`.
 *
 * Usado antes de operações destrutivas (Zona de Perigo → apagar dados)
 * pra dar uma rede de seguranção: se Gil clicar errado, o snapshot tá lá
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
 * Helper: timestamp ISO sem `:` (filename-safe) + 4 chars random pra
 * garantir unique mesmo se 2 chamadas caírem no mesmo ms (ex: testes
 * rodando em loop tight; o ISO tem granularidade só de ms).
 */
function stampNow(): string {
  // YYYY-MM-DDTHH-MM-SS-mmm-XXXX
  const iso = new Date().toISOString().replace(/[:.]/g, "-").replace(/Z$/, "");
  const suffix = randomBytes(2).toString("hex"); // 4 chars hex
  return `${iso}-${suffix}`;
}
