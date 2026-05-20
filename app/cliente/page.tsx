import { prisma } from "@/lib/prisma";
import { serializeOrder } from "@/lib/orders";
import { ClienteClient } from "./ClienteClient";

export const dynamic = "force-dynamic";

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export default async function ClientePage() {
  const ordersRaw = await prisma.order.findMany({
    where: {
      status: { in: ["PEDIDO_FEITO", "EM_PREPARO", "PRONTO"] },
      createdAt: { gte: startOfToday() },
    },
    include: { items: true },
    orderBy: { createdAt: "asc" },
  });
  const orders = ordersRaw.map(serializeOrder);
  return <ClienteClient initialOrders={orders} />;
}
