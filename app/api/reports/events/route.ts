import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { computeEventStats } from "@/lib/event-stats";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/reports/events — comparativo entre eventos (EventSession).
 *
 * Retorna os últimos 30 eventos (mais recentes primeiro) com os agregados
 * de cada um: faturamento, nº de pedidos, ticket médio, hora de pico e
 * item campeão (topping/sabor mais pedido). Admin only.
 *
 * Rota estática (sem [param]) — agregação read-only, reusa computeEventStats.
 */
export async function GET() {
  const auth = await requireRole(["admin"]);
  if (auth instanceof NextResponse) return auth;

  const sessions = await prisma.eventSession.findMany({
    orderBy: { openedAt: "desc" },
    take: 30,
    include: { orders: { include: { items: true } } },
  });

  const events = sessions.map((s) => ({
    id: s.id,
    name: s.name,
    eventDate: s.eventDate ? s.eventDate.toISOString() : null,
    openedAt: s.openedAt.toISOString(),
    closedAt: s.closedAt ? s.closedAt.toISOString() : null,
    openedBy: s.openedBy,
    open: s.closedAt === null,
    ...computeEventStats(s.orders),
  }));

  return NextResponse.json({ events });
}
