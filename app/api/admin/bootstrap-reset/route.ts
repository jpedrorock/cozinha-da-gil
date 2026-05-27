import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/admin/bootstrap-reset?token=<TOKEN>
 *
 * Reset de emergência da tabela User. Apaga todos os usuários e recria
 * Gil admin com PIN 2699 (padrão atual do seed).
 *
 * Uso: SOMENTE quando Gil perdeu acesso e não consegue logar via UI
 * pra trocar próprio PIN. Cenário típico: prod com PIN legado (1234)
 * e localmente atualizou pra 2699 sem propagar.
 *
 * Proteção: requer header `Authorization: Bearer <TOKEN>` ou query
 * param `?token=<TOKEN>` que case com a env var `BOOTSTRAP_RESET_TOKEN`.
 * Sem essa env var configurada, endpoint sempre retorna 503 ("disabled").
 *
 * Workflow recomendado:
 *   1. No Coolify (ou .env do servidor), adicione:
 *      BOOTSTRAP_RESET_TOKEN=<string aleatória longa, ex: openssl rand -base64 32>
 *   2. Redeploy/restart container pra env var carregar
 *   3. Chame o endpoint com `curl -X POST https://.../api/admin/bootstrap-reset?token=<TOKEN>`
 *   4. **REMOVA a env var** depois (segurança — endpoint volta a 503)
 *   5. Próximo PR/sprint: deletar esse endpoint do código
 *
 * Por que NÃO tem auth de sessão: justamente porque o user não consegue
 * autenticar. Bootstrapping um sistema travado exige bypass controlado.
 * O token longo no env var é a única barreira.
 *
 * Idempotente: roda 2x sem efeito adicional (apaga + recria sempre).
 *
 * Seguro de deletar quando: prod estabilizar e Gil estiver logando OK.
 */
export async function POST(request: Request) {
  const expected = process.env.BOOTSTRAP_RESET_TOKEN;
  if (!expected || expected.length < 16) {
    // Endpoint só "existe" quando env var configurada (mínimo 16 chars
    // pra evitar tokens triviais). Sem isso, retorna 503 — mesma
    // resposta que daria se a rota nem existisse.
    return NextResponse.json(
      { error: "Endpoint desabilitado. Configure BOOTSTRAP_RESET_TOKEN." },
      { status: 503 },
    );
  }

  const url = new URL(request.url);
  const queryToken = url.searchParams.get("token");
  const authHeader = request.headers.get("authorization") ?? "";
  const bearerToken = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : null;

  const provided = bearerToken ?? queryToken;
  if (!provided || provided !== expected) {
    return NextResponse.json({ error: "Token inválido." }, { status: 401 });
  }

  // Conta users antes pra reportar no resultado
  const beforeCount = await prisma.user.count();

  // Apaga TODOS os users (não tem FK constraint — Order.operator é string
  // snapshot, não foreign key; histórico de pedidos preservado).
  await prisma.user.deleteMany({});

  // Recria Gil admin PIN 2699 (padrão atual do seed.ts)
  const passwordHash = await bcrypt.hash("2699", 10);
  const gil = await prisma.user.create({
    data: { name: "Gil", role: "admin", passwordHash },
  });

  return NextResponse.json({
    ok: true,
    message: `Reset feito. ${beforeCount} user(s) apagado(s). Gil admin recriado com PIN 2699.`,
    created: { id: gil.id, name: gil.name, role: gil.role },
  });
}
