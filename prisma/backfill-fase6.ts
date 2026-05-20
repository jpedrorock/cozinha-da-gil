// Backfill Fase 6 — atribui productId/productSizeId/productName aos
// OrderItems existentes (criados antes do schema multi-produto) e cria
// uma EventSession "histórica" pra agrupar os pedidos antigos.
//
// Roda uma vez após o seed novo. Idempotente: pula registros que já
// têm productId preenchido.

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // 1. Mapa de produtos pra resolver kind+size → productId/productSizeId
  const products = await prisma.product.findMany({ include: { sizes: true } });

  function resolveProduct(kind: string, size: string) {
    // mapeia kind antigo → name de produto
    const productByKind: Record<string, string> = {
      salgado: "Pastel Salgado",
      doce: "Pastel Doce",
      macarrao: "Macarrão",
      combo: "Combo 4 Sabores",
    };
    const productName = productByKind[kind];
    if (!productName) return null;
    const product = products.find((p) => p.name === productName && p.type === kind);
    if (!product) return null;
    // mapeia size antigo → ProductSize.name (case-insensitive, ignora variação)
    const sizeMap: Record<string, string> = {
      pequeno: "Pequeno",
      grande: "Grande",
      normal: "Normal",
      mini: "Mini Pack",
    };
    const sizeName = sizeMap[size?.toLowerCase()];
    const productSize = sizeName
      ? product.sizes.find((s) => s.name === sizeName)
      : null;
    return { product, productSize };
  }

  // 2. Backfill OrderItem
  const items = await prisma.orderItem.findMany({ where: { productId: null } });
  let updated = 0;
  let skipped = 0;
  for (const item of items) {
    const resolved = resolveProduct(item.kind, item.size);
    if (!resolved) {
      skipped++;
      continue;
    }
    await prisma.orderItem.update({
      where: { id: item.id },
      data: {
        productId: resolved.product.id,
        productSizeId: resolved.productSize?.id ?? null,
        productName: resolved.product.name,
      },
    });
    updated++;
  }
  console.log(`✓ OrderItem backfill: ${updated} atualizados, ${skipped} pulados (kind não mapeado).`);

  // 3. Cria EventSession histórica se não existir e ainda tiver pedidos sem session
  const ordersWithoutSession = await prisma.order.count({ where: { eventSessionId: null } });
  if (ordersWithoutSession === 0) {
    console.log("✓ EventSession: todos os pedidos já têm sessão atribuída.");
  } else {
    const HIST_NAME = "Histórico (pré-Fase 6)";
    let hist = await prisma.eventSession.findFirst({ where: { name: HIST_NAME } });
    if (!hist) {
      // Pega o range de createdAt dos pedidos sem sessão pra preencher openedAt/closedAt
      const firstOrder = await prisma.order.findFirst({
        where: { eventSessionId: null },
        orderBy: { createdAt: "asc" },
      });
      const lastOrder = await prisma.order.findFirst({
        where: { eventSessionId: null },
        orderBy: { createdAt: "desc" },
      });
      hist = await prisma.eventSession.create({
        data: {
          name: HIST_NAME,
          openedAt: firstOrder?.createdAt ?? new Date(),
          openedBy: "—",
          closedAt: lastOrder?.createdAt ?? new Date(),
          closedBy: "—",
        },
      });
      console.log(`✓ EventSession histórica criada (id=${hist.id}).`);
    }
    const result = await prisma.order.updateMany({
      where: { eventSessionId: null },
      data: { eventSessionId: hist.id },
    });
    console.log(`✓ Order backfill: ${result.count} pedidos atribuídos à sessão histórica.`);
  }

  // 4. Stats
  const totalOrders = await prisma.order.count();
  const totalItems = await prisma.orderItem.count();
  const itemsWithProduct = await prisma.orderItem.count({ where: { productId: { not: null } } });
  const sessions = await prisma.eventSession.count();
  console.log(
    `📊 Estado: ${totalOrders} pedidos · ${totalItems} items (${itemsWithProduct} com productId) · ${sessions} sessões.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
