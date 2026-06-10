import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { backupDatabase } from "@/lib/db-backup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Frase EXATA que o admin tem que digitar pra confirmar wipe destrutivo.
 *
 * Combinada com Gil (06/06/2026). Mudança aqui é breaking — UI mostra
 * a mesma string pra usuário digitar. Validamos server-side também (não
 * só client-side) pra defesa em camadas. Case-sensitive.
 */
const CONFIRM_PHRASE = "APAGAR TUDO NA COZINHA DA GIL";

/**
 * POST /api/admin/danger-zone/wipe
 *
 * Apaga TUDO de operação: pedidos, items, eventos de caixa, logs de
 * broadcast. **MANTÉM** cardápio, ingredientes, usuários, clientes (CRM),
 * config PIX. Combinado com Gil.
 *
 * Antes de apagar, faz backup do dev.db em `backups/wipe-<timestamp>.db`.
 * Se Gil clicar errado, restaurar via `cp backups/wipe-... dev.db` (ou
 * pedir pro Claude restaurar).
 *
 * Auth: admin only.
 *
 * Body: { confirmPhrase: string }
 *   - Deve ser EXATAMENTE `APAGAR TUDO NA COZINHA DA GIL` (case-sensitive).
 *   - Falha com 400 e código `INVALID_PHRASE` se não bater.
 */
export async function POST(request: Request) {
  const auth = await requireRole(["admin"]);
  if (auth instanceof NextResponse) return auth;

  let body: { confirmPhrase?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const phrase = typeof body.confirmPhrase === "string" ? body.confirmPhrase : "";
  if (phrase !== CONFIRM_PHRASE) {
    return NextResponse.json(
      {
        error: "Frase de confirmação não bate com a esperada.",
        code: "INVALID_PHRASE",
      },
      { status: 400 },
    );
  }

  // Backup ANTES de qualquer DELETE. Se backup falhar, não apaga nada.
  let backupPath: string;
  try {
    backupPath = await backupDatabase("wipe");
  } catch (err) {
    console.error("[danger-zone] backup falhou:", err);
    return NextResponse.json(
      {
        error:
          "Não consegui fazer backup do banco antes de apagar. Operação abortada.",
        code: "BACKUP_FAILED",
      },
      { status: 500 },
    );
  }

  // Apaga em transação — se algum delete falhar, nada é apagado.
  // Ordem: BroadcastLog → OrderItem → Order → EventSession.
  // OrderItem antes de Order (FK cascade já cobre mas explícito é mais claro).
  // EventSession por último porque Order tem FK opcional pra ela.
  const result = await prisma.$transaction(async (tx) => {
    const broadcastLogs = await tx.broadcastLog.deleteMany({});
    const orderItems = await tx.orderItem.deleteMany({});
    const orders = await tx.order.deleteMany({});
    const events = await tx.eventSession.deleteMany({});
    return {
      broadcastLogs: broadcastLogs.count,
      orderItems: orderItems.count,
      orders: orders.count,
      events: events.count,
    };
  });

  console.warn(
    `[danger-zone] WIPE EXECUTADO por admin. Backup: ${backupPath}. Apagados:`,
    result,
  );

  return NextResponse.json({
    ok: true,
    backupPath,
    deleted: result,
  });
}
