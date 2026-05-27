import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sseStats } from "@/lib/sse";
import { getCurrentEventSession } from "@/lib/event-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const startupTime = Date.now();

/**
 * GET /api/health — ping leve pro Gil bookmarkar no celular dela e
 * confirmar "o servidor tá vivo?" durante o evento. Também é o endpoint
 * que o Coolify (ou qualquer monitor externo) consulta pra saber se
 * deve reiniciar o container.
 *
 * Status code:
 *   200 → app saudável (DB respondendo)
 *   503 → algo crítico tá quebrado (DB inacessível). Lista de problemas
 *         em `problems[]`. Coolify configurado pra fazer health check
 *         neste endpoint vai reiniciar automaticamente quando ver 503.
 *
 * Body (sempre o mesmo shape, mesmo em 503 — facilita debugging):
 * - ok: boolean (espelha o status)
 * - dbOk, dbLatencyMs: SQLite respondeu? Quanto demorou?
 * - sse: { count, oldestAgeMs, maxAgeMs } — clientes conectados
 * - session: { id, name, openedBy, openedAt } | null — caixa aberto
 * - uptimeSec: quanto tempo o servidor tá rodando
 * - serverTime: ISO timestamp atual
 * - problems: string[] — vazio se ok; descrições legíveis se !ok
 *
 * Pública (sem auth) — é só info de saúde, sem dados sensíveis.
 *
 * Coolify config: aponta health check pra `/api/health` com intervalo
 * 30s, timeout 5s, retries 3. Documentado em README "Deploy" + "Saúde".
 */
export async function GET() {
  const now = Date.now();
  const problems: string[] = [];

  let dbOk = false;
  let dbLatencyMs = -1;
  try {
    const t = performance.now();
    await prisma.$queryRawUnsafe("SELECT 1;");
    dbLatencyMs = Math.round(performance.now() - t);
    dbOk = true;
  } catch (err) {
    dbOk = false;
    problems.push(
      `DB inacessível: ${err instanceof Error ? err.message : String(err)}`,
    );
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
  } catch (err) {
    // Não trata como crítico — health continua "ok" se só essa query falhou.
    // Mas registra problema pra Gil ver no body.
    problems.push(
      `Falha ao ler caixa atual: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  // Critério de saúde: DB acessível é o único hard requirement. Se cair,
  // app não consegue gravar pedidos → cliente vai embora. Coolify deve
  // restart. Tudo o resto é informativo.
  const status = dbOk ? 200 : 503;

  return NextResponse.json(
    {
      ok: dbOk,
      dbOk,
      dbLatencyMs,
      sse,
      session,
      uptimeSec: Math.floor((now - startupTime) / 1000),
      serverTime: new Date(now).toISOString(),
      problems,
    },
    { status },
  );
}
