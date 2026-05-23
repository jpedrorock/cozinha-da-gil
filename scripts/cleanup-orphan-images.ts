/**
 * Remove imagens em uploads/products/ que não têm Product.imageUrl correspondente no DB.
 *
 * Por padrão roda em dry-run (lista apenas). Passar --delete pra apagar.
 *
 * Uso:
 *   npx tsx scripts/cleanup-orphan-images.ts          # dry-run
 *   npx tsx scripts/cleanup-orphan-images.ts --delete # apaga órfãs
 *
 * Idempotente. Seguro rodar quantas vezes quiser.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { getProductsDir } from "@/lib/uploads";

const dryRun = !process.argv.includes("--delete");

async function main() {
  const uploadsDir = getProductsDir();

  let files: string[];
  try {
    files = await fs.readdir(uploadsDir);
  } catch {
    console.log(`Diretório de uploads não existe: ${uploadsDir}`);
    console.log("Nada a fazer.");
    return;
  }

  const imageFiles = files.filter((f) => /\.(png|svg|jpg|jpeg|webp)$/i.test(f));
  console.log(`Arquivos encontrados em uploads/products/: ${imageFiles.length}`);

  // Coleta todas as imageUrl salvas no banco (apenas a parte do filename).
  const products = await prisma.product.findMany({
    select: { imageUrl: true },
    where: { imageUrl: { not: null } },
  });

  const knownFilenames = new Set(
    products
      .map((p) => p.imageUrl)
      .filter((url): url is string => url !== null)
      .map((url) => path.basename(url)), // "/api/uploads/products/abc.png" → "abc.png"
  );

  const orphans = imageFiles.filter((f) => !knownFilenames.has(f));

  if (orphans.length === 0) {
    console.log("Nenhuma imagem órfã encontrada.");
    return;
  }

  console.log(`\nImagens órfãs (${orphans.length}):`);
  for (const f of orphans) {
    console.log(`  ${dryRun ? "[DRY-RUN] " : ""}${f}`);
  }

  if (dryRun) {
    console.log(`\nMode: dry-run. Rode com --delete pra apagar.`);
    return;
  }

  let deleted = 0;
  let failed = 0;
  for (const f of orphans) {
    try {
      await fs.unlink(path.join(uploadsDir, f));
      console.log(`  Apagado: ${f}`);
      deleted++;
    } catch (err) {
      console.error(`  Erro ao apagar ${f}:`, err);
      failed++;
    }
  }

  console.log(`\nConcluído: ${deleted} apagado(s), ${failed} erro(s).`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
