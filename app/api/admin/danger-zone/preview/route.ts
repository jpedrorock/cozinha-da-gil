import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/danger-zone/preview
 *
 * Retorna contagens das tabelas que `POST /wipe` vai apagar. UI mostra
 * pro Gil antes do botão "Apagar permanente" pra ela ter dimensão do
 * estrago. ZERO efeito colateral — só read.
 *
 * Auth: admin only.
 */
export async function GET() {
  const auth = await requireRole(["admin"]);
  if (auth instanceof NextResponse) return auth;

  const [orders, orderItems, events, broadcastLogs] = await Promise.all([
    prisma.order.count(),
    prisma.orderItem.count(),
    prisma.eventSession.count(),
    prisma.broadcastLog.count(),
  ]);

  return NextResponse.json({
    orders,
    orderItems,
    events,
    broadcastLogs,
    // Quanto NÃO vai mexer — pra UI deixar claro que cardápio + usuários
    // + clientes (CRM) permanecem.
    preserves: {
      products: await prisma.product.count(),
      ingredients: await prisma.ingredient.count(),
      users: await prisma.user.count(),
      customers: await prisma.customer.count(),
    },
  });
}
