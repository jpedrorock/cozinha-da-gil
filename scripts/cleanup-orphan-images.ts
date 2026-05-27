/**
 * Limpa imagens órfãs em uploads/products/ (audit-crit BACKLOG-órfãs).
 *
 * Órfão = arquivo no disco cuja URL (/api/uploads/products/<file>) NÃO
 * aparece em nenhum Product.imageUrl no DB.
 *
 * Quando isso acontece: admin troca imagem via UI → lib/uploads deleta
 * a antiga (OK). Mas se um Product for deletado direto no DB (sem passar
 * pelo DELETE /api/products) ou se a migração legacy escreveu arquivos
 * antes de popular imageUrl, sobram resíduos no volume.
 *
 * Uso:
 *   npx tsx scripts/cleanup-orphan-images.ts            # dry-run (default — só lista)
 *   npx tsx scripts/cleanup-orphan-images.ts --delete   # deleta de verdade
 *
 * Idempotente. Logs claros de o que foi deletado/mantido.
 */

import { prisma } from "@/lib/prisma-client";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const nodeRequire = eval("require") as NodeRequire;
const fs = nodeRequire("fs").promises as typeof import("fs").promises;
const path = nodeRequire("path") as typeof import("path");

const UPLOADS_ROOT = process.env.UPLOADS_DIR || path.join(process.cwd(), "data", "uploads");
const PRODUCTS_DIR = path.join(UPLOADS_ROOT, "products");

type Report = {
  totalFiles: number;
  referenced: string[];
  orphans: string[];
  deletedBytes: number;
};

export async function cleanup(deleteMode: boolean): Promise<Report> {
  // 1. Listar arquivos no disco
  let entries: string[];
  try {
    entries = await fs.readdir(PRODUCTS_DIR);
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e.code === "ENOENT") {
      console.log(`Diretório ${PRODUCTS_DIR} não existe — nada pra limpar.`);
      return { totalFiles: 0, referenced: [], orphans: [], deletedBytes: 0 };
    }
    throw err;
  }
  // Filtra só arquivos de imagem (ignora subdirs, logs etc)
  const files = entries.filter((f) => /\.(png|svg)$/i.test(f));

  // 2. Listar imageUrl de todos os produtos
  const products = await prisma.product.findMany({
    where: { imageUrl: { not: null } },
    select: { imageUrl: true },
  });
  const referencedFilenames = new Set<string>();
  for (const p of products) {
    if (!p.imageUrl) continue;
    const m = /^\/api\/uploads\/products\/(.+)$/.exec(p.imageUrl);
    if (m) referencedFilenames.add(m[1]);
  }

  // 3. Separar
  const referenced: string[] = [];
  const orphans: string[] = [];
  for (const f of files) {
    if (referencedFilenames.has(f)) referenced.push(f);
    else orphans.push(f);
  }

  // 4. Sumário
  let deletedBytes = 0;
  if (orphans.length === 0) {
    console.log(`✓ Sem órfãos. ${files.length} arquivo(s) no disco, todos referenciados.`);
  } else {
    console.log(`\nÓrfãos encontrados (${orphans.length} de ${files.length}):`);
    for (const f of orphans) {
      const stat = await fs.stat(path.join(PRODUCTS_DIR, f)).catch(() => null);
      const size = stat ? `${(stat.size / 1024).toFixed(1)} KB` : "?";
      console.log(`  ${deleteMode ? "🗑" : "→"} ${f} (${size})`);
      if (deleteMode && stat) {
        await fs.unlink(path.join(PRODUCTS_DIR, f));
        deletedBytes += stat.size;
      }
    }
    if (!deleteMode) {
      console.log(`\nDry-run: nada foi deletado. Re-rode com --delete pra apagar de verdade.`);
    } else {
      console.log(`\n✓ Deletados: ${orphans.length} arquivo(s), ${(deletedBytes / 1024).toFixed(1)} KB liberados.`);
    }
  }

  return { totalFiles: files.length, referenced, orphans, deletedBytes };
}

async function cli() {
  const deleteMode = process.argv.includes("--delete");
  try {
    await cleanup(deleteMode);
  } catch (err) {
    console.error("✗ Cleanup falhou:", err);
    process.exit(1);
  } finally {
    await prisma.$disconnect().catch(() => {});
  }
}

if (require.main === module) {
  cli();
}
