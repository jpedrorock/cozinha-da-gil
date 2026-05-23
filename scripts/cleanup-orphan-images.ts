/**
 * Lista (ou deleta) imagens em uploads/products/ que não estão
 * referenciadas por nenhum Product.imageUrl no banco.
 *
 * Uso:
 *   npx tsx scripts/cleanup-orphan-images.ts          # dry-run (só lista)
 *   npx tsx scripts/cleanup-orphan-images.ts --delete  # deleta os órfãos
 *
 * Idempotente. Seguro de rodar em prod — sem --delete nunca toca em arquivo.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { getProductsDir } from "@/lib/uploads";

const DRY_RUN = !process.argv.includes("--delete");

async function main() {
  const dir = getProductsDir();

  let files: string[];
  try {
    files = await fs.readdir(dir);
  } catch {
    console.log(`Diretório ${dir} não existe — nada a fazer.`);
    await prisma.$disconnect();
    return;
  }

  const imageFiles = files.filter((f) => /\.(png|svg)$/i.test(f));

  const products = await prisma.product.findMany({
    where: { imageUrl: { not: null } },
    select: { id: true, name: true, imageUrl: true },
  });

  const referencedFilenames = new Set(
    products
      .map((p) => {
        if (!p.imageUrl) return null;
        const prefix = "/api/uploads/products/";
        return p.imageUrl.startsWith(prefix) ? p.imageUrl.slice(prefix.length) : null;
      })
      .filter(Boolean) as string[],
  );

  const orphans = imageFiles.filter((f) => !referencedFilenames.has(f));

  console.log(`Arquivos em ${dir}: ${imageFiles.length}`);
  console.log(`Referenciados no DB: ${referencedFilenames.size}`);
  console.log(`Órfãos encontrados: ${orphans.length}`);

  if (orphans.length === 0) {
    console.log("Nenhum arquivo órfão. Nada a fazer.");
    await prisma.$disconnect();
    return;
  }

  for (const f of orphans) {
    if (DRY_RUN) {
      console.log(`  [dry-run] órfão: ${f}`);
    } else {
      await fs.unlink(path.join(dir, f));
      console.log(`  deletado: ${f}`);
    }
  }

  if (DRY_RUN) {
    console.log(`\nDry-run completo. Use --delete pra remover os ${orphans.length} arquivo(s) acima.`);
  } else {
    console.log(`\n${orphans.length} arquivo(s) removido(s).`);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
