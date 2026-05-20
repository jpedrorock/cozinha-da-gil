import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/customers/[id]/broadcast-log
 *
 * Registra que Gil clicou "abrir wa.me" pra esse cliente num fluxo de broadcast.
 * NÃO envia mensagem — só log de auditoria. Confirmar entrega real precisaria
 * WhatsApp Business API.
 *
 * Body: { message, campaignId?, operator }
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  const auth = await requireRole(["admin"]);
  if (auth instanceof NextResponse) return auth;

  let body: { message?: unknown; campaignId?: unknown; operator?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const message = typeof body.message === "string" ? body.message.trim() : "";
  const operator = typeof body.operator === "string" && body.operator.trim() ? body.operator.trim() : "—";
  const campaignId =
    typeof body.campaignId === "string" && body.campaignId.trim() ? body.campaignId.trim() : null;

  if (message.length === 0) {
    return NextResponse.json({ error: "Mensagem vazia." }, { status: 400 });
  }

  // Confirma que cliente existe (e não foi soft-deletado)
  const customer = await prisma.customer.findUnique({ where: { id: params.id } });
  if (!customer || customer.deletedAt) {
    return NextResponse.json({ error: "Cliente não encontrado." }, { status: 404 });
  }

  const log = await prisma.broadcastLog.create({
    data: {
      customerId: params.id,
      message: message.slice(0, 2000),
      sentBy: operator,
      campaignId,
    },
  });

  return NextResponse.json(log);
}
