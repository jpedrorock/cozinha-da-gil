import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sseStats } from "@/lib/sse";
import { getCurrentEventSession } from "@/lib/event-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const startupTime = Date.now();

/**
 * GET /api/health — ping leve pro Gil bookmarkar no celular dela e
 * confirmar "o servidor tá vivo?" durante o evento.
 *
 * Retorna:
 * - ok: tudo bem
 * - dbOk: SQLite respondeu uma query
 * - sse: stats dos clientes conectados
 * - session: caixa aberto?
 * - uptimeSec: quanto tempo o servidor tá rodando
 *
 * Pública (sem auth) — é só info de saúde.
 */
export async function GET() {
  const now = Date.now();
  let dbOk = false;
  let dbLatencyMs = -1;
  try {
    const t = performance.now();
    await prisma.$queryRawUnsafe("SELECT 1;");
    dbLatencyMs = Math.round(performance.now() - t);
    dbOk = true;
  } catch {
    dbOk = false;
  }

  const sse = sseStats();
  let session = null;
  try {
    const s = await getCurrentEventSession();
    if (s) {
      session = {
        id: s.id,
        name: s.name,
        openedBy: s.openedBy,
        openedAt: s.openedAt.toISOString(),
      };
    }
  } catch {
    // ignora — health não deve falhar inteiro por isso
  }

  const problems: string[] = [];
  if (!dbOk) problems.push("db_unavailable");

  const body = {
    status: problems.length === 0 ? "ok" : "degraded",
    db: dbOk,
    dbLatencyMs,
    sse: { connections: sse.count },
    session,
    uptimeSec: Math.floor((now - startupTime) / 1000),
    serverTime: new Date(now).toISOString(),
    ...(problems.length > 0 ? { problems } : {}),
  };

  return NextResponse.json(body, { status: problems.length === 0 ? 200 : 503 });
}
