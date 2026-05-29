import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { serializeOrder } from "@/lib/orders";
import { getEventSessionStatus } from "@/lib/event-session";
import { getSession } from "@/lib/session";
import { MonitorClient } from "./MonitorClient";

export const dynamic = "force-dynamic";

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * /admin/monitor — view mobile pra Gil monitorar evento sem entrar no
 * admin completo. Tela cheia, sem chrome, KPIs gigantes + lista live.
 *
 * Auth: admin only. Sem role admin → redirect pra login.
 *
 * Initial data via SSR pra primeira pintura ser instantânea; daí SSE
 * mantém atualizado em tempo real.
 */
export default async function MonitorPage() {
  const session = await getSession();
  if (!session.userId || session.role !== "admin") {
    redirect("/");
  }

  const [eventStatus, todayOrdersRaw] = await Promise.all([
    getEventSessionStatus(),
    prisma.order.findMany({
      where: { createdAt: { gte: startOfToday() } },
      include: { items: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const todayOrders = todayOrdersRaw.map(serializeOrder);

  return <MonitorClient eventStatus={eventStatus} initialOrders={todayOrders} />;
}
