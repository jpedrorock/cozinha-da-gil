/**
 * Migração one-shot: Product.imageDataUrl (base64 no DB) → arquivo no
 * filesystem (volume) + Product.imageUrl URL relativa.
 *
 * Roda 1x em produção depois do deploy com o novo schema:
 *   npx tsx scripts/migrate-product-images.ts
 *
 * Idempotente: produto que já tem imageUrl (mesmo que ainda tenha
 * imageDataUrl) é pulado. Produto sem imageDataUrl é pulado.
 *
 * Audit #63.
 */

import { prisma } from "@/lib/prisma-client";
import { saveProductImage } from "@/lib/uploads";

async function main() {
  const candidates = await prisma.product.findMany({
    where: {
      imageDataUrl: { not: null },
      imageUrl: null,
    },
    select: { id: true, name: true, imageDataUrl: true },
  });

  console.log(`Encontrados ${candidates.length} produto(s) com imageDataUrl pra migrar.`);

  let migrated = 0;
  let failed = 0;
  for (const p of candidates) {
    if (!p.imageDataUrl) continue;
    try {
      const url = await saveProductImage(p.id, p.imageDataUrl, null);
      if (!url) {
        console.warn(`  ✗ ${p.name} (${p.id}): formato inválido, pulando`);
        failed++;
        continue;
      }
      await prisma.product.update({
        where: { id: p.id },
        data: { imageUrl: url, imageDataUrl: null },
      });
      console.log(`  ✓ ${p.name} → ${url}`);
      migrated++;
    } catch (e) {
      console.error(`  ✗ ${p.name} (${p.id}):`, e);
      failed++;
    }
  }

  console.log(`\nMigração concluída: ${migrated} migrados, ${failed} falharam.`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
