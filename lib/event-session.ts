import "server-only";
import { prisma } from "@/lib/prisma";
import type { EventSession } from "@prisma/client";

// Re-exporta tipos e helpers puros pra back-compat com server pages
// que ainda importam tudo daqui. Client components devem usar
// `@/lib/event-session-shared` diretamente — não esse arquivo.
export { isStaleEventSession, type EventSessionStatus } from "@/lib/event-session-shared";

import type { EventSessionStatus } from "@/lib/event-session-shared";

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
