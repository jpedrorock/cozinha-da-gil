import { prisma } from "@/lib/prisma";
import { serializeOrder } from "@/lib/orders";
import { getEventSessionStatus } from "@/lib/event-session";
import { serializeProduct } from "@/lib/products";
import { serializePromotion } from "@/lib/promotions";
import { AtendenteClient } from "./AtendenteClient";
import type { Ingredient } from "@prisma/client";

export const dynamic = "force-dynamic";

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export default async function AtendentePage() {
  const [ingredientsRaw, ordersRaw, eventStatus, productsRaw, promosRaw] = await Promise.all([
    prisma.ingredient.findMany({ orderBy: [{ category: "asc" }, { position: "asc" }] }),
    prisma.order.findMany({
      where: { createdAt: { gte: startOfToday() } },
      include: { items: true },
      orderBy: { createdAt: "desc" },
    }),
    getEventSessionStatus(),
    prisma.product.findMany({
      where: { available: true },
      include: { sizes: { orderBy: { position: "asc" } } },
      orderBy: [{ position: "asc" }, { name: "asc" }],
    }),
    // Promoções ativas via SSR pra evitar fetch no client mount
    prisma.promotion.findMany({
      where: { active: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const ingredients: Record<string, Ingredient[]> = {};
  for (const ing of ingredientsRaw) (ingredients[ing.category] ??= []).push(ing);

  const orders = ordersRaw.map(serializeOrder);
  const products = productsRaw.map(serializeProduct);
  const promotions = promosRaw.map(serializePromotion);

  return (
    <AtendenteClient
      ingredients={ingredients}
      initialOrders={orders}
      initialEventStatus={eventStatus}
      initialProducts={products}
      initialPromotions={promotions}
    />
  );
}
