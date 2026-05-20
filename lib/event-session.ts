import { prisma } from "@/lib/prisma";
import type { EventSession } from "@prisma/client";

/**
 * Retorna a sessão de caixa aberta atual (closedAt = null) ou null
 * se nenhuma estiver aberta.
 */
export async function getCurrentEventSession(): Promise<EventSession | null> {
  return prisma.eventSession.findFirst({
    where: { closedAt: null },
    orderBy: { openedAt: "desc" },
  });
}

/**
 * Status simplificado pro frontend — substitui o DayStatus antigo.
 */
export type EventSessionStatus = {
  open: boolean;
  id: string | null;
  name: string | null;
  eventDate: string | null;
  openedAt: string | null;
  openedBy: string | null;
};

export async function getEventSessionStatus(): Promise<EventSessionStatus> {
  const session = await getCurrentEventSession();
  if (!session) {
    return { open: false, id: null, name: null, eventDate: null, openedAt: null, openedBy: null };
  }
  return {
    open: true,
    id: session.id,
    name: session.name,
    eventDate: session.eventDate?.toISOString() ?? null,
    openedAt: session.openedAt.toISOString(),
    openedBy: session.openedBy,
  };
}

/**
 * Calcula totalCents (sem cancelados) de todos os pedidos da sessão.
 * Usado no fechamento pra snapshot.
 */
export async function computeSessionTotal(sessionId: string): Promise<number> {
  const orders = await prisma.order.findMany({
    where: {
      eventSessionId: sessionId,
      status: { not: "CANCELADO" },
    },
    include: { items: true },
  });
  return orders.reduce(
    (sum, o) =>
      sum + o.items.reduce((s, it) => s + it.unitPrice * it.quantity, 0),
    0,
  );
}
