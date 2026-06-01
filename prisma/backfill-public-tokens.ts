// Backfill idempotente: gera publicToken pros pedidos antigos que
// ficaram null depois do schema change. Roda no boot do Docker
// (entrypoint) — segue o pattern de outros backfills no projeto.
//
// Tudo num try-catch porque entrypoint não pode quebrar boot.
// Em prod, se algum pedido falha, log + segue — pedido fica sem
// link de acompanhamento, mas app sobe normal.

import { PrismaClient } from "@prisma/client";
import { generatePublicToken } from "../lib/public-token";

async function main() {
  const prisma = new PrismaClient();
  try {
    const pending = await prisma.order.findMany({
      where: { publicToken: null },
      select: { id: true },
    });
    if (pending.length === 0) {
      console.log("[backfill-public-tokens] Nada pra fazer (todos já têm token).");
      return;
    }
    console.log(`[backfill-public-tokens] Gerando token pra ${pending.length} pedidos...`);
    let ok = 0;
    let failed = 0;
    for (const { id } of pending) {
      // Tentativa única por pedido — colisão é virtualmente impossível
      // (~59 bits de entropia). Se mesmo assim colidir, próxima execução
      // do backfill pega de novo.
      try {
        await prisma.order.update({
          where: { id },
          data: { publicToken: generatePublicToken() },
        });
        ok++;
      } catch (err) {
        failed++;
        console.error(`[backfill-public-tokens] falha id=${id}:`, err);
      }
    }
    console.log(`[backfill-public-tokens] OK=${ok}, falhas=${failed}.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("[backfill-public-tokens] erro fatal:", err);
  process.exitCode = 1;
});
