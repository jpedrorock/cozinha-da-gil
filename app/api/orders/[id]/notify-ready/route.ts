import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { broadcast } from "@/lib/sse";
import { serializeOrder } from "@/lib/orders";
import { requireRole } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/orders/[id]/notify-ready
 *
 * Marca que o atendente avisou o cliente via WhatsApp que o pedido tá pronto.
 * NÃO envia mensagem — Gil clica o botão "Avisar" no card que abre wa.me;
 * esse endpoint só registra que ela clicou (audit + idempotência visual).
 *
 * Validação:
 *   - Order deve existir
 *   - Order deve ter clientPhone (sem fone não faz sentido marcar)
 *   - Order deve estar em status PRONTO (avisar antes do preparo é bug)
 *
 * Endpoint separado do PATCH /api/orders/[id] porque esse último é a
 * máquina-de-estados de status. Notificar não muda status — mistura quebra
 * a lógica de transições.
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  const auth = await requireRole(["atendente", "admin"]);
  if (auth instanceof NextResponse) return auth;

  const id = Number(params.id);
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ error: "ID inválido." }, { status: 400 });
  }

  let body: { operator?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }
  const operator =
    typeof body.operator === "string" && body.operator.trim().length > 0
      ? body.operator.trim()
      : "—";

  const existing = await prisma.order.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
  }
  if (!existing.clientPhone) {
    return NextResponse.json(
      { error: "Pedido sem telefone — não dá pra avisar." },
      { status: 422 },
    );
  }
  if (existing.status !== "PRONTO") {
    return NextResponse.json(
      { error: "Só dá pra avisar pedidos prontos." },
      { status: 409 },
    );
  }
  // Idempotente — se já avisou antes, retorna o estado atual sem erro.
  if (existing.notifiedReadyAt) {
    const order = await prisma.order.findUnique({
      where: { id },
      include: { items: true },
    });
    return NextResponse.json(serializeOrder(order!));
  }

  const updated = await prisma.order.update({
    where: { id },
    data: {
      notifiedReadyAt: new Date(),
      notifiedReadyBy: operator,
    },
    include: { items: true },
  });

  const serialized = serializeOrder(updated);
  broadcast("order:updated", serialized);

  return NextResponse.json(serialized);
}
