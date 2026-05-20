import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serializeOrder } from "@/lib/orders";
import { generateReportPDF } from "@/lib/pdf-report";
import { requireRole } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/reports/pdf
 *   ?eventSessionId=XXX → relatório de UM caixa (preferido)
 *   ?date=YYYY-MM-DD     → relatório de UM dia
 *   ?from=&to=           → range arbitrário
 *
 * Retorna PDF binário com Content-Disposition pra download.
 * Admin only.
 */
export async function GET(request: Request) {
  const auth = await requireRole(["admin"]);
  if (auth instanceof NextResponse) return auth;

  const url = new URL(request.url);
  const eventSessionId = url.searchParams.get("eventSessionId");
  const dateStr = url.searchParams.get("date");
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  type Where = {
    eventSessionId?: string;
    createdAt?: { gte: Date; lt?: Date; lte?: Date };
  };
  const where: Where = {};
  let title = "";
  let subtitle: string | undefined;

  if (eventSessionId) {
    where.eventSessionId = eventSessionId;
    const session = await prisma.eventSession.findUnique({ where: { id: eventSessionId } });
    if (session) {
      title = session.name ?? "Caixa sem nome";
      const refDate = session.eventDate ?? session.openedAt;
      title += ` — ${refDate.toLocaleDateString("pt-BR")}`;
      subtitle = session.closedAt
        ? `Aberto por ${session.openedBy} · Fechado por ${session.closedBy ?? "—"} às ${session.closedAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`
        : `Aberto por ${session.openedBy} · Em andamento`;
    }
  } else if (dateStr) {
    const start = new Date(dateStr);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    where.createdAt = { gte: start, lt: end };
    title = `Dia ${start.toLocaleDateString("pt-BR")}`;
  } else if (from && to) {
    where.createdAt = { gte: new Date(from), lte: new Date(`${to}T23:59:59.999Z`) };
    title = `Período ${new Date(from).toLocaleDateString("pt-BR")} → ${new Date(to).toLocaleDateString("pt-BR")}`;
  } else {
    // default: hoje
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    where.createdAt = { gte: today, lt: tomorrow };
    title = `Hoje ${today.toLocaleDateString("pt-BR")}`;
  }

  const orders = await prisma.order.findMany({
    where,
    include: { items: true },
    orderBy: { createdAt: "asc" },
  });

  const pdf = await generateReportPDF({
    title,
    subtitle,
    orders: orders.map(serializeOrder),
  });

  const filenameBase = title
    .replace(/[^a-zA-Z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .toLowerCase();
  return new NextResponse(pdf as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="cozinha-da-gil-${filenameBase}.pdf"`,
      "Content-Length": String(pdf.length),
    },
  });
}
