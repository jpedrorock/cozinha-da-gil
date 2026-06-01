import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serializeOrder } from "@/lib/orders";
import { isValidPublicTokenFormat } from "@/lib/public-token";

// Endpoint público (sem auth) pro link de acompanhamento do cliente.
// Token aleatório no path = security through randomness (10 chars base62 ≈
// 59 bits). Sem auth porque o cliente não tem login — o token É o segredo.
//
// Retorna OrderView serializado: items, status, total, datas. O cliente
// renderiza tudo. Não vazamos dado sensível (PIN de operador etc) porque
// OrderView só contém o que já vai pra atendente/cozinha.

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  // Rejeição cedo: token mal formado nunca matcha. Evita query desnecessária
  // e mensagem genérica do Prisma vazando shape do schema.
  if (!isValidPublicTokenFormat(token)) {
    return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
  }

  const order = await prisma.order.findUnique({
    where: { publicToken: token },
    include: { items: true },
  });

  if (!order) {
    return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
  }

  return NextResponse.json(serializeOrder(order));
}
