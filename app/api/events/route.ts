import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/events — lista todas as sessões pra dropdown do admin.
 * Mais recente primeiro. Inclui totalCents do snapshot (se já fechada)
 * ou calculado on-the-fly (se ainda aberta).
 */
export async function GET() {
  const sessions = await prisma.eventSession.findMany({
    orderBy: { openedAt: "desc" },
    include: {
      _count: { select: { orders: true } },
    },
  });

  // Pra sessões abertas, computa total ao vivo
  const result = await Promise.all(
    sessions.map(async (s) => {
      let total = s.totalCents;
      if (s.closedAt === null) {
        const orders = await prisma.order.findMany({
          where: { eventSessionId: s.id, status: { not: "CANCELADO" } },
          include: { items: true },
        });
        total = orders.reduce(
          (sum, o) =>
            sum + o.items.reduce((x, it) => x + it.unitPrice * it.quantity, 0),
          0,
        );
      }
      return {
        id: s.id,
        name: s.name,
        openedAt: s.openedAt.toISOString(),
        openedBy: s.openedBy,
        closedAt: s.closedAt?.toISOString() ?? null,
        closedBy: s.closedBy,
        totalCents: total ?? 0,
        orderCount: s._count.orders,
      };
    }),
  );

  return NextResponse.json(result);
}
