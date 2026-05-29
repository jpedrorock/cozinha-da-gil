import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serializeOrder } from "@/lib/orders";
import { broadcast } from "@/lib/sse";
import { requireRole } from "@/lib/session";
import type { OrderStatus, Prisma } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_STATUSES: OrderStatus[] = ["EM_PREPARO", "PRONTO", "ENTREGUE", "CANCELADO"];

/**
 * Máquina de estados de pedido — define quais transições são válidas.
 * Bloqueia revert (ENTREGUE → PEDIDO_FEITO), re-cancel, etc.
 * P1 do audit: evita timestamps inconsistentes em concorrência.
 */
const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PEDIDO_FEITO: ["EM_PREPARO", "CANCELADO"],
  EM_PREPARO: ["PRONTO", "CANCELADO"],
  PRONTO: ["ENTREGUE", "CANCELADO"],
  ENTREGUE: [], // terminal
  CANCELADO: [], // terminal
};

function asString(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

export async function PATCH(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const auth = await requireRole(["atendente", "cozinha", "admin"]);
  if (auth instanceof NextResponse) return auth;

  const id = Number.parseInt(params.id, 10);
  if (Number.isNaN(id)) {
    return NextResponse.json({ error: "ID inválido." }, { status: 400 });
  }

  let body: { status?: unknown; operator?: unknown; reason?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const status = body.status as OrderStatus;
  if (!VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: "Status inválido." }, { status: 400 });
  }

  // Valida transição
  const existing = await prisma.order.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
  }
  const allowed = TRANSITIONS[existing.status];
  if (!allowed.includes(status)) {
    // Audit-Crit C #19: INVALID_TRANSITION code + incluí current/attempted
    // pra frontend mostrar mensagem mais útil ou abrir tela do pedido.
    return NextResponse.json(
      {
        error: `Transição inválida: ${existing.status} → ${status}. ${
          allowed.length === 0
            ? "Pedido já encerrado."
            : `Estados válidos: ${allowed.join(", ")}.`
        }`,
        code: "INVALID_TRANSITION",
        currentStatus: existing.status,
        attemptedStatus: status,
      },
      { status: 409 },
    );
  }

  // Regra de negócio: atendente só cancela ANTES do preparo.
  // Cozinha/admin podem cancelar mid-preparo (ingrediente acabou etc.).
  if (
    status === "CANCELADO" &&
    existing.status === "EM_PREPARO" &&
    auth.role === "atendente"
  ) {
    return NextResponse.json(
      {
        error:
          "Pedido em preparo. Só cozinha ou admin pode cancelar agora — peça pra eles.",
      },
      { status: 403 },
    );
  }

  const operator = asString(body.operator) ?? auth.name ?? "—";
  const reason = asString(body.reason);
  const now = new Date();

  const data: Prisma.OrderUpdateInput = { status };
  if (status === "EM_PREPARO") {
    data.preparedBy = operator;
    data.preparedAt = now;
  } else if (status === "PRONTO") {
    data.readyBy = operator;
    data.readyAt = now;
  } else if (status === "ENTREGUE") {
    data.deliveredBy = operator;
    data.deliveredAt = now;
  } else if (status === "CANCELADO") {
    data.cancelledBy = operator;
    data.cancelledAt = now;
    data.cancelReason = reason;
  }

  try {
    const order = await prisma.order.update({
      where: { id },
      data,
      include: { items: true },
    });

    // CRM: se cancelado, decrementa agregados do Customer linkado.
    // Senão fica somando "cliente gastou X" pra pedidos que nem aconteceram.
    if (status === "CANCELADO" && order.customerId) {
      const finalCents = Math.max(
        0,
        order.items.reduce((s, it) => s + it.unitPrice * it.quantity, 0) - (order.discountCents ?? 0),
      );
      await prisma.customer.update({
        where: { id: order.customerId },
        data: {
          totalOrders: { decrement: 1 },
          totalSpentCents: { decrement: finalCents },
        },
      });
    }

    const serialized = serializeOrder(order);
    broadcast("order:updated", serialized);

    return NextResponse.json(serialized);
  } catch {
    return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
  }
}
