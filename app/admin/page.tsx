import { prisma } from "@/lib/prisma";
import { serializeOrder } from "@/lib/orders";
import { getEventSessionStatus } from "@/lib/event-session";
import { serializeProduct } from "@/lib/products";
import { serializePromotion } from "@/lib/promotions";
import { AdminClient } from "./AdminClient";

export const dynamic = "force-dynamic";

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function thirtyDaysAgo() {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  d.setHours(0, 0, 0, 0);
  return d;
}

export default async function AdminPage() {
  const [todayOrdersRaw, recentOrdersRaw, ingredients, users, eventStatus, productsRaw, eventsRaw, promotionsRaw] =
    await Promise.all([
      prisma.order.findMany({
        where: { createdAt: { gte: startOfToday() } },
        include: { items: true },
        orderBy: { createdAt: "desc" },
      }),
      // Defesa-em-profundidade: bound temporal (30d) além do take: 50.
      // Se um dia aumentarmos take pra 1000, ainda fica capped em pedidos
      // recentes — payload SSR fica previsível e useMemo de filter dentro
      // do client não trava em mobile lento.
      prisma.order.findMany({
        take: 50,
        where: { createdAt: { gte: thirtyDaysAgo() } },
        include: { items: true },
        orderBy: { createdAt: "desc" },
      }),
      prisma.ingredient.findMany({
        orderBy: [{ category: "asc" }, { position: "asc" }],
      }),
      prisma.user.findMany({
        orderBy: [{ role: "asc" }, { name: "asc" }],
        select: { id: true, name: true, role: true, createdAt: true },
      }),
      getEventSessionStatus(),
      prisma.product.findMany({
        include: { sizes: { orderBy: { position: "asc" } } },
        orderBy: [{ position: "asc" }, { name: "asc" }],
      }),
      prisma.eventSession.findMany({
        orderBy: { openedAt: "desc" },
        include: { _count: { select: { orders: true } } },
      }),
      prisma.promotion.findMany({ orderBy: { createdAt: "desc" } }),
    ]);

  const todayOrders = todayOrdersRaw.map(serializeOrder);
  const recentOrders = recentOrdersRaw.map(serializeOrder);
  const products = productsRaw.map(serializeProduct);
  const promotions = promotionsRaw.map(serializePromotion);
  const events = eventsRaw.map((s) => ({
    id: s.id,
    name: s.name,
    openedAt: s.openedAt.toISOString(),
    openedBy: s.openedBy,
    closedAt: s.closedAt?.toISOString() ?? null,
    closedBy: s.closedBy,
    totalCents: s.totalCents ?? 0,
    orderCount: s._count.orders,
  }));

  return (
    <AdminClient
      todayOrders={todayOrders}
      recentOrders={recentOrders}
      initialIngredients={ingredients}
      initialUsers={users.map((u) => ({ ...u, createdAt: u.createdAt.toISOString() }))}
      initialEventStatus={eventStatus}
      initialProducts={products}
      initialEvents={events}
      initialPromotions={promotions}
    />
  );
}
