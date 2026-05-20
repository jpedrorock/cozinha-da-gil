import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentEventSession } from "@/lib/event-session";
import { broadcast } from "@/lib/sse";
import { requireRole } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function asString(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

export async function POST(request: Request) {
  const auth = await requireRole(["admin"]);
  if (auth instanceof NextResponse) return auth;

  let body: { operator?: unknown; name?: unknown; eventDate?: unknown };
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const operator = asString(body.operator) ?? "—";
  const name = asString(body.name);
  // eventDate opcional — formato ISO (YYYY-MM-DD do <input type="date">
  // ou ISO completo). Se inválido, ignora.
  let eventDate: Date | null = null;
  const rawDate = asString(body.eventDate);
  if (rawDate) {
    const d = new Date(rawDate);
    if (!isNaN(d.getTime())) eventDate = d;
  }

  // Já tem sessão aberta? Retorna ela em vez de criar nova.
  const existing = await getCurrentEventSession();
  if (existing) {
    return NextResponse.json(
      {
        error: "Já tem caixa aberto. Feche antes de abrir outro.",
        current: {
          id: existing.id,
          name: existing.name,
          eventDate: existing.eventDate?.toISOString() ?? null,
          openedAt: existing.openedAt.toISOString(),
          openedBy: existing.openedBy,
        },
      },
      { status: 409 },
    );
  }

  const session = await prisma.eventSession.create({
    data: { openedBy: operator, name, eventDate },
  });

  broadcast("event:opened", {
    id: session.id,
    name: session.name,
    eventDate: session.eventDate?.toISOString() ?? null,
    openedAt: session.openedAt.toISOString(),
    openedBy: session.openedBy,
  });

  return NextResponse.json(
    {
      id: session.id,
      name: session.name,
      eventDate: session.eventDate?.toISOString() ?? null,
      openedAt: session.openedAt.toISOString(),
      openedBy: session.openedBy,
    },
    { status: 201 },
  );
}
