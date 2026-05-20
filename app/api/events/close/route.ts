import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { backupDatabase } from "@/lib/backup";
import { computeSessionTotal, getCurrentEventSession } from "@/lib/event-session";
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

  let body: { operator?: unknown };
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const operator = asString(body.operator) ?? "—";

  const current = await getCurrentEventSession();
  if (!current) {
    return NextResponse.json(
      { error: "Não tem caixa aberto pra fechar." },
      { status: 404 },
    );
  }

  const totalCents = await computeSessionTotal(current.id);

  const closed = await prisma.eventSession.update({
    where: { id: current.id },
    data: {
      closedAt: new Date(),
      closedBy: operator,
      totalCents,
    },
  });

  broadcast("event:closed", {
    id: closed.id,
    name: closed.name,
    closedAt: closed.closedAt?.toISOString() ?? null,
    closedBy: closed.closedBy,
    totalCents: closed.totalCents,
  });

  // Backup automático ao fechar caixa — snapshot do dev.db em prisma/backups/.
  // Não bloqueia a resposta; só loga falha se houver. Falha de backup nunca
  // deve impedir o fechamento de caixa.
  const sessionLabel = closed.name ? `close-${closed.name}` : `close-${closed.id.slice(0, 8)}`;
  const backup = await backupDatabase(sessionLabel);
  if (!backup.ok) {
    console.error(`[BACKUP] Falha ao salvar backup do caixa ${closed.id}:`, backup.error);
  } else {
    console.log(`[BACKUP] Caixa ${closed.id} → ${backup.path} (${backup.bytes} bytes)`);
  }

  return NextResponse.json({
    id: closed.id,
    name: closed.name,
    openedAt: closed.openedAt.toISOString(),
    openedBy: closed.openedBy,
    closedAt: closed.closedAt?.toISOString() ?? null,
    closedBy: closed.closedBy,
    totalCents: closed.totalCents,
    backup: backup.ok ? { path: backup.path, bytes: backup.bytes } : null,
  });
}
