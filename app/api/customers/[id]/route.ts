import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serializeOrder } from "@/lib/orders";
import { requireRole } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/customers/[id]
 * Retorna o customer + últimos 20 pedidos (mais recentes).
 * Auth: admin.
 */
export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const auth = await requireRole(["admin"]);
  if (auth instanceof NextResponse) return auth;

  const customer = await prisma.customer.findUnique({ where: { id: params.id } });
  if (!customer) {
    return NextResponse.json({ error: "Cliente não encontrado." }, { status: 404 });
  }

  const orders = await prisma.order.findMany({
    where: { customerId: params.id },
    include: { items: true },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return NextResponse.json({ customer, orders: orders.map(serializeOrder) });
}

/**
 * PATCH /api/customers/[id]
 * Atualiza name, notes, optInMarketing, optInNotifications.
 * Outros campos (phone, agregados) são imutáveis via API — derivados de pedidos.
 */
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  const auth = await requireRole(["admin"]);
  if (auth instanceof NextResponse) return auth;

  let body: {
    name?: unknown;
    notes?: unknown;
    optInMarketing?: unknown;
    optInNotifications?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const data: {
    name?: string;
    notes?: string | null;
    optInMarketing?: boolean;
    optInNotifications?: boolean;
  } = {};

  if (typeof body.name === "string" && body.name.trim().length > 0) {
    data.name = body.name.trim().slice(0, 100);
  }
  if (body.notes === null) {
    data.notes = null;
  } else if (typeof body.notes === "string") {
    const trimmed = body.notes.trim();
    data.notes = trimmed.length > 0 ? trimmed.slice(0, 500) : null;
  }
  if (typeof body.optInMarketing === "boolean") {
    data.optInMarketing = body.optInMarketing;
  }
  if (typeof body.optInNotifications === "boolean") {
    data.optInNotifications = body.optInNotifications;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nada pra atualizar." }, { status: 400 });
  }

  try {
    const updated = await prisma.customer.update({ where: { id: params.id }, data });
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Cliente não encontrado." }, { status: 404 });
  }
}

/**
 * DELETE /api/customers/[id]
 * Soft delete — seta deletedAt. Mantém Order.customerId pra histórico.
 * Cliente fica oculto da lista CRM mas aparece em relatórios.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const auth = await requireRole(["admin"]);
  if (auth instanceof NextResponse) return auth;

  try {
    await prisma.customer.update({
      where: { id: params.id },
      data: { deletedAt: new Date() },
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Cliente não encontrado." }, { status: 404 });
  }
}
