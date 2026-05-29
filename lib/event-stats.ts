/**
 * Estatísticas por evento (EventSession) — lógica pura pro comparativo do
 * admin. Separada do endpoint pra ser testável sem Prisma.
 *
 * Agrega os pedidos de UM evento em: faturamento, nº de pedidos, ticket
 * médio, hora de pico e item campeão (topping/sabor mais pedido).
 * Pedidos CANCELADO não entram em nada.
 */
import { parseExtras } from "@/lib/orders";

export type EventStatItem = {
  kind: string;
  toppings: string; // JSON array (salgado/macarrão/combo)
  flavor: string | null; // sabor único (doce)
  unitPrice: number;
  quantity: number;
};

export type EventStatOrder = {
  createdAt: Date | string;
  status: string;
  items: EventStatItem[];
};

export type EventStats = {
  orderCount: number;
  revenueCents: number;
  avgTicketCents: number;
  /** Hora (0–23) com mais pedidos. null se não houve pedido. Empate → hora mais cedo. */
  peakHour: number | null;
  /** Topping/sabor mais pedido (por quantidade). null se nenhum item com ingrediente. */
  topItem: { name: string; count: number } | null;
};

export function computeEventStats(orders: EventStatOrder[]): EventStats {
  const active = orders.filter((o) => o.status !== "CANCELADO");

  const revenueCents = active.reduce(
    (s, o) => s + o.items.reduce((a, i) => a + i.unitPrice * i.quantity, 0),
    0,
  );
  const orderCount = active.length;
  const avgTicketCents = orderCount > 0 ? Math.round(revenueCents / orderCount) : 0;

  // Hora de pico
  const hourCounts = new Array(24).fill(0) as number[];
  for (const o of active) {
    const h = new Date(o.createdAt).getHours();
    if (h >= 0 && h < 24) hourCounts[h] += 1;
  }
  let peakHour: number | null = null;
  let peakN = 0;
  for (let h = 0; h < 24; h++) {
    if (hourCounts[h] > peakN) {
      peakN = hourCounts[h];
      peakHour = h;
    }
  }

  // Item campeão — toppings (salgado/macarrão/combo) + sabor (doce), por quantidade
  const counts: Record<string, number> = {};
  for (const o of active) {
    for (const it of o.items) {
      const qty = it.quantity || 1;
      if (it.kind === "salgado" || it.kind === "macarrao" || it.kind === "combo") {
        for (const t of parseExtras(it.toppings)) counts[t] = (counts[t] ?? 0) + qty;
      } else if (it.kind === "doce" && it.flavor) {
        counts[it.flavor] = (counts[it.flavor] ?? 0) + qty;
      }
    }
  }
  let topItem: { name: string; count: number } | null = null;
  for (const [name, count] of Object.entries(counts)) {
    if (!topItem || count > topItem.count) topItem = { name, count };
  }

  return { orderCount, revenueCents, avgTicketCents, peakHour, topItem };
}
