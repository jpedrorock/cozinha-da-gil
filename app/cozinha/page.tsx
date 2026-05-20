import { prisma } from "@/lib/prisma";
import { serializeOrder } from "@/lib/orders";
import { CozinhaClient } from "./CozinhaClient";

export const dynamic = "force-dynamic";

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export default async function CozinhaPage() {
  const [ordersRaw, ingredients] = await Promise.all([
    prisma.order.findMany({
      where: {
        status: { in: ["PEDIDO_FEITO", "EM_PREPARO"] },
        createdAt: { gte: startOfToday() },
      },
      include: { items: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.ingredient.findMany({
      orderBy: [{ category: "asc" }, { position: "asc" }],
    }),
  ]);

  const allToppings = ingredients
    .filter((i) => i.category === "topping")
    .map((i) => i.name);

  const orders = ordersRaw.map(serializeOrder);
  return <CozinhaClient initialOrders={orders} allToppings={allToppings} />;
}
